-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 3: Social, Ads, Phones, Customers
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Sections 6, 8, 12, 18)
-- ============================================================================

-- 1. Sweep coverage log (tracks manual sweep dates per platform per brand)
create table if not exists public.sweep_coverage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,
  last_swept_at timestamptz not null default now(),
  items_checked int not null default 0,
  suspects_found int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, brand_id, platform)
);

-- 2. Phone number normalization helper (E.164)
create or replace function public.normalize_phone(raw text) returns text
language plpgsql immutable as $$
declare
  digits text;
begin
  if raw is null or trim(raw) = '' then return null; end if;
  -- Strip everything except digits and leading +
  digits := regexp_replace(trim(raw), '[^0-9+]', '', 'g');
  -- If starts with 00, replace with +
  if digits like '00%' then
    digits := '+' || substr(digits, 3);
  end if;
  -- If no country code (starts with 0), assume UAE (+971)
  if digits ~ '^0[0-9]+$' and length(digits) >= 9 then
    digits := '+971' || substr(digits, 2);
  end if;
  -- If no + prefix and 9+ digits, assume UAE
  if digits !~ '^\+' and length(digits) >= 9 then
    digits := '+971' || digits;
  end if;
  return digits;
end;
$$;

-- 3. Provider budget tracking (SERP/scraping provider usage per workspace)
create table if not exists public.provider_budget (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,                 -- 'serpapi', 'apify', 'brightdata', 'tineye'
  queries_used int not null default 0,
  queries_limit int not null default 1000,
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider, period_start)
);

-- 4. Public verify page data (brand public_slug → official channels)
-- Already in brands table (public_slug). Add a view for fast public lookup.
create or replace view public.brand_verify_page as
select
  b.id,
  b.name,
  b.name_ar,
  b.official_domains,
  b.official_handles,
  b.official_phones,
  b.logo_path,
  b.countries,
  b.allowlist,
  w.name as workspace_name
from public.brands b
join public.workspaces w on w.id = b.workspace_id
where b.public_slug is not null;

-- 5. RLS for new tables
alter table public.sweep_coverage enable row level security;
alter table public.provider_budget enable row level security;

revoke all on public.sweep_coverage from anon;
revoke all on public.provider_budget from anon;

create policy "sweep_coverage_members_read" on public.sweep_coverage
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "sweep_coverage_staff_insert" on public.sweep_coverage
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "sweep_coverage_staff_update" on public.sweep_coverage
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "provider_budget_members_read" on public.provider_budget
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "provider_budget_owner_insert" on public.provider_budget
  for insert to authenticated
  with check (public.member_role(workspace_id) = 'owner');

create policy "provider_budget_owner_update" on public.provider_budget
  for update to authenticated
  using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

-- 6. Phone mismatch detection helper
create or replace function public.check_phone_mismatch(
  p_brand_id uuid,
  p_phone text
) returns boolean
language plpgsql stable as $$
declare
  normalized text;
  official text[];
begin
  normalized := public.normalize_phone(p_phone);
  select official_phones into official from public.brands where id = p_brand_id;
  if official is null or array_length(official, 1) is null then return false; end if;
  -- Normalize official phones too
  return not (normalized = any (select public.normalize_phone(p) from unnest(official) as p));
end;
$$;
