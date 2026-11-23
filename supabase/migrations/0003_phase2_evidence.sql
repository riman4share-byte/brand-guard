-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 2: Evidence & Tracking
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Sections 9, 11, 18)
-- ============================================================================

-- 1. Capture jobs queue (worker polls this)
create table if not exists public.capture_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  url text not null,
  status text not null default 'queued' check (status in ('queued','processing','done','failed','cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  error text,
  priority int not null default 2 check (priority between 1 and 3),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_capture_jobs_status on public.capture_jobs(status, priority desc, created_at);
create index if not exists idx_capture_jobs_case on public.capture_jobs(case_id);

-- 2. SLA timers (follow-up schedule per case)
create table if not exists public.sla_timers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  platform text not null,
  followup_days int[] not null default '{3,7,14}',
  next_followup_at timestamptz not null,
  last_checked_at timestamptz,
  escalated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sla_timers_next on public.sla_timers(next_followup_at) where not escalated;

-- 3. RLS for new tables
alter table public.capture_jobs enable row level security;
alter table public.sla_timers enable row level security;

revoke all on public.capture_jobs from anon;
revoke all on public.sla_timers from anon;

create policy "capture_jobs_members_read" on public.capture_jobs
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "capture_jobs_staff_insert" on public.capture_jobs
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "capture_jobs_staff_update" on public.capture_jobs
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "sla_timers_members_read" on public.sla_timers
  for select to authenticated
  using (public.member_role(workspace_id) is not null);

create policy "sla_timers_staff_insert" on public.sla_timers
  for insert to authenticated
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "sla_timers_staff_update" on public.sla_timers
  for update to authenticated
  using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

-- 4. Update case_events types documentation
comment on table public.case_events is 'Append-only timeline. Types: status_change, reported, followup, evidence_added, note, liveness, capture_requested, capture_completed, sla_overdue, reopened, escalated.';

-- 5. Function: create capture job for a case (called when confirming a candidate)
create or replace function public.request_capture(
  p_workspace_id uuid,
  p_case_id uuid,
  p_candidate_id uuid,
  p_url text,
  p_priority int default 2
) returns uuid
language plpgsql security definer as $$
declare
  v_job_id uuid;
begin
  if public.member_role(p_workspace_id) not in ('owner','staff') then
    raise exception 'Permission denied';
  end if;
  insert into public.capture_jobs (workspace_id, case_id, candidate_id, url, priority)
  values (p_workspace_id, p_case_id, p_candidate_id, p_url, p_priority)
  returning id into v_job_id;
  return v_job_id;
end;
$$;

-- 6. Function: update case live_status and propose removal
create or replace function public.update_case_liveness(
  p_case_id uuid,
  p_live_status text,
  p_details jsonb default '{}'
) returns void
language plpgsql security definer as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.cases where id = p_case_id;
  if v_ws is null or public.member_role(v_ws) not in ('owner','staff') then
    raise exception 'Permission denied';
  end if;
  update public.cases
  set live_status = p_live_status,
      last_checked_at = now(),
      updated_at = now()
  where id = p_case_id;

  insert into public.case_events (workspace_id, case_id, type, data)
  values (v_ws, p_case_id, 'liveness', jsonb_build_object('status', p_live_status, 'details', p_details));
end;
$$;

-- 7. Function: create SLA timer for a reported case
create or replace function public.create_sla_timer(
  p_workspace_id uuid,
  p_case_id uuid,
  p_platform text,
  p_followup_days int[] default '{3,7,14}'
) returns uuid
language plpgsql security definer as $$
declare
  v_timer_id uuid;
  v_next timestamptz;
begin
  if public.member_role(p_workspace_id) not in ('owner','staff') then
    raise exception 'Permission denied';
  end if;
  v_next := now() + (p_followup_days[1] || 3) * interval '1 day';
  insert into public.sla_timers (workspace_id, case_id, platform, followup_days, next_followup_at)
  values (p_workspace_id, p_case_id, p_platform, p_followup_days, v_next)
  returning id into v_timer_id;
  return v_timer_id;
end;
$$;
