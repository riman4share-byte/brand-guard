-- ============================================================================
-- Brand Guard (حارس العلامة) — Phase 5: Reporting Automation & Escalation
-- Reference: BRAND-GUARD-PLATFORM-BLUEPRINT.md (Sections 10, 14, P5)
-- ============================================================================

-- 1. Report templates registry (versioned per platform × kind × language)
create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  platform text not null,
  kind text not null,
  lang text not null check (lang in ('ar','en')),
  body text not null,
  form_url text,
  form_url_last_verified_at timestamptz,
  version int not null default 1,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_templates_lookup on public.report_templates(platform, kind, lang, version desc);

-- 2. Platform form URL health checks
create table if not exists public.form_url_checks (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  url text not null,
  status_code int,
  is_alive boolean,
  checked_at timestamptz not null default now(),
  error text
);

-- 3. Repeat offender tracking (links new cases to prior ones)
create table if not exists public.repeat_offenders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  operator_key text not null,             -- shared registrant/IP/phone/handle pattern
  case_ids uuid[] not null default '{}',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  case_count int not null default 1,
  unique (workspace_id, brand_id, operator_key)
);

-- 4. Analytics snapshots (monthly KPIs per brand)
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 5. Escalation ladder (per case kind)
create table if not exists public.escalation_steps (
  id uuid primary key default gen_random_uuid(),
  case_kind text not null,
  step_order int not null,
  step_name text not null,
  step_name_ar text,
  action_type text not null check (action_type in ('platform_form','platform_appeal','registrar_abuse','hosting_abuse','cloudflare_abuse','safe_browsing','local_authority','udrp','legal_counsel')),
  description text,
  description_ar text,
  url_template text,
  unique (case_kind, step_order)
);

-- Seed default escalation ladder for domain cases
insert into public.escalation_steps (case_kind, step_order, step_name, step_name_ar, action_type, description, description_ar) values
  ('domain', 1, 'Registrar Abuse Report', 'بلاغ لمسجّل النطاق', 'registrar_abuse', 'Email the domain registrar abuse department to suspend the domain.', 'مراسلة قسم الانتهاكات في شركة تسجيل النطاق لتعليق النطاق.'),
  ('domain', 2, 'Hosting Provider Abuse', 'بلاغ لمستضيف الموقع', 'hosting_abuse', 'Report to the hosting provider abuse contact.', 'الإبلاغ إلى قسم الانتهاكات في شركة الاستضافة.'),
  ('domain', 3, 'Cloudflare Abuse (if proxied)', 'بلاغ Cloudflare', 'cloudflare_abuse', 'Submit abuse report to Cloudflare if domain is proxied.', 'تقديم بلاغ انتهاكات إلى Cloudflare إذا كان النطاق hinter Cloudflare.'),
  ('domain', 4, 'Google Safe Browsing', 'Google Safe Browsing', 'safe_browsing', 'Report phishing/deceptive site to trigger browser warnings.', 'الإبلاغ عن موقع تصيّد لتفعيل تحذير المتصفحات.'),
  ('domain', 5, 'Local Authority (TDRA/CST)', 'جهة محلية (TDRA/CST)', 'local_authority', 'Escalate to local telecom authority for domain blocking.', 'تصعيد إلى هيئة الاتصالات المحلية لحجب النطاق.'),
  ('domain', 6, 'UDRP / Legal Counsel', 'UDRP / مستشار قانوني', 'legal_counsel', 'File UDRP complaint or engage legal counsel for high-value cases.', 'تقديم شكوى UDRP أو الاستعانة بمستشار قانوني للحالات عالية القيمة.')
on conflict (case_kind, step_order) do nothing;

-- Seed default escalation ladder for account cases
insert into public.escalation_steps (case_kind, step_order, step_name, step_name_ar, action_type, description, description_ar) values
  ('profile', 1, 'Platform Impersonation Form', 'نموذج انتحال الهوية', 'platform_form', 'Submit via platform official impersonation form.', 'تقديم عبر نموذج انتحال الهوية الرسمي للمنصة.'),
  ('profile', 2, 'Platform Trademark Form', 'نموذج انتهاك العلامة', 'platform_form', 'Submit via platform official trademark form.', 'تقديم عبر نموذج انتهاك العلامة التجارية oficial للمنصة.'),
  ('profile', 3, 'Platform Appeal / Rejection Follow-up', 'متابعة / استئناف', 'platform_appeal', 'Follow up or appeal if the initial report was rejected.', 'متابعة أو استئناف إذا تم رفض البلاغ الأولي.'),
  ('profile', 4, 'Local Authority (Police/DED/SAIP)', 'جهة محلية', 'local_authority', 'Escalate to local police or IP authority.', 'تصعيد إلى الشرطة أو هيئة الملكية الفكرية.')
on conflict (case_kind, step_order) do nothing;

-- 6. RLS for new tables
alter table public.report_templates enable row level security;
alter table public.form_url_checks enable row level security;
alter table public.repeat_offenders enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.escalation_steps enable row level security;

revoke all on public.report_templates from anon;
revoke all on public.form_url_checks from anon;
revoke all on public.repeat_offenders from anon;
revoke all on public.analytics_snapshots from anon;
revoke all on public.escalation_steps from anon;

create policy "report_templates_members_read" on public.report_templates
  for select to authenticated using (public.member_role(workspace_id) is not null or workspace_id is null);
create policy "report_templates_staff_insert" on public.report_templates
  for insert to authenticated with check (public.member_role(workspace_id) in ('owner','staff') or workspace_id is null);
create policy "report_templates_staff_update" on public.report_templates
  for update to authenticated using (public.member_role(workspace_id) in ('owner','staff') or workspace_id is null)
  with check (public.member_role(workspace_id) in ('owner','staff') or workspace_id is null);

create policy "repeat_offenders_members_read" on public.repeat_offenders
  for select to authenticated using (public.member_role(workspace_id) is not null);
create policy "repeat_offenders_staff_insert" on public.repeat_offenders
  for insert to authenticated with check (public.member_role(workspace_id) in ('owner','staff'));
create policy "repeat_offenders_staff_update" on public.repeat_offenders
  for update to authenticated using (public.member_role(workspace_id) in ('owner','staff'))
  with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "analytics_snapshots_members_read" on public.analytics_snapshots
  for select to authenticated using (public.member_role(workspace_id) is not null);
create policy "analytics_snapshots_staff_insert" on public.analytics_snapshots
  for insert to authenticated with check (public.member_role(workspace_id) in ('owner','staff'));

create policy "escalation_steps_read" on public.escalation_steps
  for select to authenticated using (true);
create policy "escalation_steps_owner_write" on public.escalation_steps
  for all to authenticated using (public.member_role(
    (select workspace_id from public.brands limit 1)
  ) = 'owner');
