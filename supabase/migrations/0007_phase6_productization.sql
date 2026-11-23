-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 6: Productization
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Sections 12, 16, P6)
-- ============================================================================

-- 1. White-label settings per workspace (logo, colors, domain, plan limits)
create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  logo_url text,
  primary_color text default '#0F5C7A',
  secondary_color text default '#101C2C',
  accent_color text default '#F2A541',
  custom_domain text,
  plan text not null default 'free' check (plan in ('free','starter','pro','enterprise')),
  max_brands int not null default 1,
  max_cases_per_brand int not null default 100,
  max_candidates_per_run int not null default 3000,
  max_images_per_case int not null default 10,
  max_storage_mb int not null default 500,
  features jsonb not null default '{"pwa_push":false,"white_label":false,"analytics":false,"monthly_pdf":false}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Onboarding progress tracking
create table if not exists public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step text not null check (step in ('brand_profile','official_channels','brand_assets','team_invite','first_scan','complete')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, step)
);

-- 3. PWA push subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id, endpoint)
);

-- 4. Health check log (platform status)
create table if not exists public.health_checks (
  id uuid primary key default gen_random_uuid(),
  check_name text not null,
  status text not null check (status in ('healthy','degraded','down')),
  latency_ms int,
  details jsonb default '{}',
  checked_at timestamptz not null default now()
);

create index if not exists idx_health_checks_name on public.health_checks(check_name, checked_at desc);

-- 5. RLS for new tables
alter table public.workspace_settings enable row level security;
alter table public.onboarding_progress enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.health_checks enable row level security;

revoke all on public.workspace_settings from anon;
revoke all on public.onboarding_progress from anon;
revoke all on public.push_subscriptions from anon;
revoke all on public.health_checks from anon;

create policy "workspace_settings_members_read" on public.workspace_settings
  for select to authenticated using (public.member_role(workspace_id) is not null);
create policy "workspace_settings_owner_write" on public.workspace_settings
  for all to authenticated using (public.member_role(workspace_id) = 'owner')
  with check (public.member_role(workspace_id) = 'owner');

create policy "onboarding_members_read" on public.onboarding_progress
  for select to authenticated using (public.member_role(workspace_id) is not null);
create policy "onboarding_members_write" on public.onboarding_progress
  for all to authenticated using (public.member_role(workspace_id) is not null)
  with check (public.member_role(workspace_id) is not null);

create policy "push_subscriptions_own" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "health_checks_read" on public.health_checks
  for select to authenticated using (true);
create policy "health_checks_insert" on public.health_checks
  for insert to authenticated with check (true);

-- 6. Default workspace settings on workspace creation
create or replace function public.create_default_workspace_settings()
returns trigger as $$
begin
  insert into public.workspace_settings (workspace_id) values (new.id) on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_create_workspace_settings on public.workspaces;
create trigger trg_create_workspace_settings
  after insert on public.workspaces
  for each row execute function public.create_default_workspace_settings();

-- 7. Plan limit enforcement function
create or replace function public.check_plan_limit(
  p_workspace_id uuid,
  p_resource text
) returns boolean
language plpgsql stable security definer as $$
declare
  v_settings record;
  v_count int;
begin
  select * into v_settings from public.workspace_settings where workspace_id = p_workspace_id;
  if v_settings is null then return true; end if;

  if p_resource = 'brands' then
    select count(*) into v_count from public.brands where workspace_id = p_workspace_id;
    return v_count < v_settings.max_brands;
  elsif p_resource = 'cases' then
    select count(*) into v_count from public.cases where workspace_id = p_workspace_id;
    return v_count < v_settings.max_cases_per_brand * v_settings.max_brands;
  elsif p_resource = 'storage' then
    -- Check total storage used (approximate)
    return true; -- Enforce in application layer
  end if;
  return true;
end;
$$;
