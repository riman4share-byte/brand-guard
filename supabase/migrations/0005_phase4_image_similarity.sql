-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 4: Image & Visual Similarity
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Section 6, D7, P4)
-- ============================================================================

-- 1. Brand assets already exist (brand_assets table from P0). Add pHash column if missing.
-- (phash column already exists in 0001 migration)

-- 2. Image comparison results (stores pHash distance between brand assets and candidate images)
create table if not exists public.image_matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  brand_asset_id uuid references public.brand_assets(id) on delete set null,
  candidate_image_url text not null,
  candidate_phash text,
  brand_phash text,
  hamming_distance int,
  similarity_score int check (similarity_score between 0 and 100),
  match_type text check (match_type in ('exact','near','partial','none')),
  created_at timestamptz not null default now()
);

create index if not exists idx_image_matches_candidate on public.image_matches(candidate_id);
create index if not exists idx_image_matches_brand on public.image_matches(brand_id);

-- 3. pHash computation helper (DCT-based, simplified for SQL)
-- Note: Full pHash requires DCT which is done in the worker (TypeScript).
-- This function just stores and compares pre-computed hashes.
create or replace function public.hamming_distance(hash1 text, hash2 text) returns int
language plpgsql immutable as $$
declare
  d int := 0;
  i int;
  len int;
begin
  if hash1 is null or hash2 is null then return 999; end if;
  if length(hash1) != length(hash2) then return 999; end if;
  len := length(hash1);
  for i in 1..len loop
    if substr(hash1, i, 1) != substr(hash2, i, 1) then
      d := d + 1;
    end if;
  end loop;
  return d;
end;
$$;

-- 4. RLS for image_matches
alter table public.image_matches enable row level security;
revoke all on public.image_matches from anon;

create policy "image_matches_members_read" on public.image_matches
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "image_matches_staff_insert" on public.image_matches
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

-- 5. TinEye adapter config (stored per workspace)
create table if not exists public.provider_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('tineye','serpapi','apify','brightdata','resend','postmark','telegram')),
  api_key_encrypted text,                -- encrypted at rest (use Supabase Vault in production)
  enabled boolean not null default true,
  monthly_limit int default 1000,
  queries_used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

alter table public.provider_configs enable row level security;
revoke all on public.provider_configs from anon;

create policy "provider_configs_members_read" on public.provider_configs
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "provider_configs_owner_insert" on public.provider_configs
  for insert to authenticated
  with check (public.member_role(workspace_id) = 'owner');

create policy "provider_configs_owner_update" on public.provider_configs
  for update to authenticated
  using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

create policy "provider_configs_owner_delete" on public.provider_configs
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');
