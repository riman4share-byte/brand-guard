-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 1: Detection v1 (Domains + CT + Inbox + Alerts)
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Sections 6-9, 13)
-- ============================================================================

-- 1. Detector runs (every detection run is recorded)
create table if not exists public.detector_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  detector text not null,                 -- 'detect-domains', 'detect-ct', 'enrich', 'score', 'liveness'
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','failed','timeout')),
  stats jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_detector_runs_brand on public.detector_runs(brand_id, started_at desc);
create index if not exists idx_detector_runs_status on public.detector_runs(status);

-- 2. Notification channels (Telegram, email, WhatsApp, push)
create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('telegram','email','whatsapp','push')),
  target text not null,                   -- chat id / address / phone / VAPID endpoint
  min_score int not null default 60 check (min_score between 0 and 100),
  digest boolean not null default false,  -- daily digest vs instant
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notif_channels_ws on public.notification_channels(workspace_id);

-- 3. Allowlist entries (known resellers/partners — hard override to score 0)
-- Stored as JSONB on brands.allowlist already; add a convenience view
create or replace view public.brand_allowlist as
select b.id as brand_id, b.workspace_id, jsonb_array_elements_text(b.allowlist) as entry
from public.brands b;

-- 4. RLS for new tables
alter table public.detector_runs enable row level security;
alter table public.notification_channels enable row level security;

revoke all on public.detector_runs from anon;
revoke all on public.notification_channels from anon;

create policy "detector_runs_members_read" on public.detector_runs
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "detector_runs_staff_insert" on public.detector_runs
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "detector_runs_staff_update" on public.detector_runs
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "notif_channels_members_read" on public.notification_channels
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "notif_channels_owner_insert" on public.notification_channels
  for insert to authenticated
  with check (public.member_role(workspace_id) = 'owner');

create policy "notif_channels_owner_update" on public.notification_channels
  for update to authenticated
  using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

create policy "notif_channels_owner_delete" on public.notification_channels
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- 5. Scoring function (server-side explainable scoring per Section 7)
create or replace function public.score_candidate(
  p_brand_id uuid,
  p_kind text,
  p_platform text,
  p_url text,
  p_handle text,
  p_domain_created_at timestamptz,
  p_signals jsonb
) returns int
language plpgsql stable as $$
declare
  score int := 0;
  is_allowlisted boolean := false;
  official_domains text[];
  official_handles jsonb;
  days_since_creation int;
  brand_name text;
begin
  select name, official_domains, official_handles into brand_name, official_domains, official_handles
  from public.brands where id = p_brand_id;

  -- Allowlist hard override
  is_allowlisted := coalesce(p_signals->>'allowlisted', 'false') = 'true';
  if is_allowlisted then return 0; end if;

  -- Exact brand name/alias in domain/handle (+25)
  if coalesce(p_signals->>'exact_name_match', 'false') = 'true' then score := score + 25; end if;

  -- Edit distance <= 2 from official (+20)
  if coalesce(p_signals->>'edit_distance_le2', 'false') = 'true' then score := score + 20; end if;

  -- Homoglyph/transliteration match (+20)
  if coalesce(p_signals->>'homoglyph_match', 'false') = 'true' then score := score + 20; end if;

  -- Brand keywords + shop/official/outlet/sale (+10)
  if coalesce(p_signals->>'keyword_combo', 'false') = 'true' then score := score + 10; end if;

  -- Domain registered < 30 days (+20), < 90 days (+10)
  if p_domain_created_at is not null then
    days_since_creation := extract(day from (now() - p_domain_created_at));
    if days_since_creation < 30 then score := score + 20;
    elsif days_since_creation < 90 then score := score + 10;
    end if;
  end if;

  -- Privacy-protected / bulk registrar / cheap TLD (+5)
  if coalesce(p_signals->>'cheap_registrar', 'false') = 'true' then score := score + 5; end if;

  -- Page contains brand name, logo hash match, or copied product images (+20 to +30)
  if coalesce(p_signals->>'page_contains_brand', 'false') = 'true' then score := score + 20; end if;
  if coalesce(p_signals->>'logo_hash_match', 'false') = 'true' then score := score + 30; end if;
  if coalesce(p_signals->>'image_hash_match', 'false') = 'true' then score := score + 25; end if;

  -- Page has checkout/WhatsApp contact not in official list (+10)
  if coalesce(p_signals->>'checkout_or_contact', 'false') = 'true' then score := score + 10; end if;

  -- Shown phone != official phone (+15)
  if coalesce(p_signals->>'phone_mismatch', 'false') = 'true' then score := score + 15; end if;

  -- Reported by customer (+30)
  if coalesce(p_signals->>'customer_report', 'false') = 'true' then score := score + 30; end if;

  -- Same registrant/nameserver/IP as confirmed case (+15)
  if coalesce(p_signals->>'clustering_match', 'false') = 'true' then score := score + 15; end if;

  -- Fan/news/review page (-15)
  if coalesce(p_signals->>'fan_page', 'false') = 'true' then score := score - 15; end if;

  -- Clamp to 0..100
  score := greatest(0, least(100, score));
  return score;
end;
$$;

-- 6. Update GAPS.md tracking (done in file, not DB)
comment on table public.detector_runs is 'Every detection run is recorded with status, stats, and errors for monitoring.';
comment on table public.notification_channels is 'Per-workspace alert channels (Telegram, email, WhatsApp, push) with min score and digest settings.';
