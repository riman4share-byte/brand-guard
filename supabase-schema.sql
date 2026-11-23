-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 0 Security & Multi-Tenant Foundation
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Sections 4 & 5)
-- Rules:
--   1. Every table has RLS enabled.
--   2. ZERO policies use `using (true)` or grant direct access to `anon`.
--   3. `evidence` and `case_events` are immutable (append-only: no update/delete).
--   4. Public customer reports enter ONLY via the `submit-report` Edge Function
--      using the service_role key.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. Multi-tenant core: Workspaces & Members
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','staff','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function public.member_role(ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where workspace_id = ws and user_id = auth.uid()
$$;

-- 2. Client Brands & Assets
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  name_ar text,
  aliases text[] not null default '{}',
  keywords text[] not null default '{}',
  official_domains text[] not null default '{}',
  official_handles jsonb not null default '{}',
  official_phones text[] not null default '{}',
  trademark_no text,
  license_no text,
  countries text[] not null default '{AE}',
  logo_path text,
  allowlist jsonb not null default '[]',
  public_slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brands_workspace on public.brands(workspace_id);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('logo','product')),
  storage_path text not null,
  phash text,
  created_at timestamptz not null default now()
);

-- 3. Detection Candidates (Suspected — human must confirm before becoming a Case)
create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  kind text not null check (kind in ('domain','account','phone','ad','listing','other')),
  platform text,
  url text,
  handle text,
  title text,
  normalized_key text not null,
  source text not null,
  score int not null default 0 check (score >= 0 and score <= 100),
  signals jsonb not null default '{}',
  status text not null default 'new' check (status in ('new','confirmed','dismissed','allowlisted')),
  dismissed_reason text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (workspace_id, brand_id, normalized_key)
);

create index if not exists idx_candidates_ws_status on public.candidates(workspace_id, status);

-- 4. Confirmed Impersonation Cases
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  kind text not null check (kind in ('profile','domain','phone','ad','listing','account','other')),
  platform text,
  url text,
  handle text,
  status text not null default 'detected'
    check (status in ('detected','evidence_ready','reported','under_review','escalated','removed','rejected','closed')),
  priority int not null default 2 check (priority between 1 and 3),
  ref_id text,
  reported_at timestamptz,
  last_checked_at timestamptz,
  live_status text,
  rdap jsonb,
  notes text,
  source text default 'internal',
  reporter_contact text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cases_ws_brand on public.cases(workspace_id, brand_id);

-- 5. Append-Only Case Events Timeline (Immutable)
create table if not exists public.case_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}',
  actor uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_events_case on public.case_events(case_id);

-- 6. Immutable Evidence Store
create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  kind text not null check (kind in ('screenshot','html','pdf','whois','dns','video','upload')),
  storage_path text not null,
  sha256 text not null,
  source_url text,
  captured_at timestamptz not null default now(),
  capture_method text not null default 'user-upload',
  tsa_token text,
  archive_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_case on public.evidence(case_id);

-- 7. Public Customer Reports (Inserted ONLY by submit-report Edge Function via service_role)
create table if not exists public.customer_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  url text not null,
  kind text default 'account',
  platform text default 'other',
  handle text,
  description text,
  contact text,
  files jsonb not null default '[]',
  ip_hash text not null,
  status text not null default 'new' check (status in ('new','triaged','dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_reports_ip_time on public.customer_reports(ip_hash, created_at);

-- 8. Audit Log (Append-Only)
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — Strict Multi-Tenant Isolation, ZERO Anon Access
-- ============================================================================

-- Remove any legacy permissive tables/policies if present
drop policy if exists "Allow workspace access on hares_cases" on public.hares_cases;
drop policy if exists "Allow workspace access on hares_settings" on public.hares_settings;

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.brands enable row level security;
alter table public.brand_assets enable row level security;
alter table public.candidates enable row level security;
alter table public.cases enable row level security;
alter table public.case_events enable row level security;
alter table public.evidence enable row level security;
alter table public.customer_reports enable row level security;
alter table public.audit_log enable row level security;

-- Revoke direct anon privileges on all application tables
revoke all on public.workspaces from anon;
revoke all on public.members from anon;
revoke all on public.brands from anon;
revoke all on public.brand_assets from anon;
revoke all on public.candidates from anon;
revoke all on public.cases from anon;
revoke all on public.case_events from anon;
revoke all on public.evidence from anon;
revoke all on public.customer_reports from anon;
revoke all on public.audit_log from anon;

-- WORKSPACES Policies
create policy "workspaces_read" on public.workspaces
  for select to authenticated
  using (public.member_role(id) is not null);

create policy "workspaces_insert" on public.workspaces
  for insert to authenticated
  with check (auth.uid() is not null);

create policy "workspaces_update" on public.workspaces
  for update to authenticated
  using (public.member_role(id) = 'owner')
  with check (public.member_role(id) = 'owner');

create policy "workspaces_delete" on public.workspaces
  for delete to authenticated
  using (public.member_role(id) = 'owner');

-- MEMBERS Policies
create policy "members_read" on public.members
  for select to authenticated
  using (public.member_role(workspace_id) is not null or user_id = auth.uid());

create policy "members_owner_insert" on public.members
  for insert to authenticated
  with check (
    public.member_role(workspace_id) = 'owner'
    or (user_id = auth.uid() and role = 'owner' and not exists (select 1 from public.members m where m.workspace_id = members.workspace_id))
  );

create policy "members_owner_update" on public.members
  for update to authenticated
  using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

create policy "members_owner_delete" on public.members
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- BRANDS Policies
create policy "brands_members_read" on public.brands
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "brands_staff_insert" on public.brands
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "brands_staff_update" on public.brands
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "brands_owner_delete" on public.brands
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- BRAND_ASSETS Policies
create policy "brand_assets_members_read" on public.brand_assets
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "brand_assets_staff_insert" on public.brand_assets
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "brand_assets_owner_delete" on public.brand_assets
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- CANDIDATES Policies
create policy "candidates_members_read" on public.candidates
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "candidates_staff_insert" on public.candidates
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "candidates_staff_update" on public.candidates
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "candidates_owner_delete" on public.candidates
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- CASES Policies
create policy "cases_members_read" on public.cases
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "cases_staff_insert" on public.cases
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "cases_staff_update" on public.cases
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "cases_owner_delete" on public.cases
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- CASE_EVENTS Policies (Immutable: Select & Insert ONLY; NO Update or Delete)
create policy "case_events_members_read" on public.case_events
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "case_events_staff_insert" on public.case_events
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

-- EVIDENCE Policies (Immutable: Select & Insert ONLY; NO Update or Delete)
create policy "evidence_members_read" on public.evidence
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "evidence_staff_insert" on public.evidence
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

-- CUSTOMER_REPORTS Policies (Authenticated workspace members read/update status; anon has NO policy)
create policy "customer_reports_members_read" on public.customer_reports
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "customer_reports_staff_update" on public.customer_reports
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "customer_reports_owner_delete" on public.customer_reports
  for delete to authenticated
  using (public.member_role(workspace_id) = 'owner');

-- AUDIT_LOG Policies (Immutable: Select & Insert ONLY)
create policy "audit_log_members_read" on public.audit_log
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "audit_log_staff_insert" on public.audit_log
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));
