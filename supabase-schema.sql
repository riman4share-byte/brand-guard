-- حارس العلامة (Brand Guard) — مخطط قاعدة بيانات Supabase (اختياري للمزامنة السحابية وبلاغات العملاء)
-- الصق هذا الكود في Supabase SQL Editor ثم اضغط Run.

create table if not exists public.hares_cases (
  id text primary key,
  workspace text not null default 'default',
  data jsonb not null,
  updated_at bigint not null default 0
);

create index if not exists idx_hares_cases_workspace on public.hares_cases (workspace);

create table if not exists public.hares_settings (
  workspace text primary key,
  data jsonb not null,
  updated_at bigint not null default 0
);

alter table public.hares_cases enable row level security;
alter table public.hares_settings enable row level security;

-- سياسة الوصول لمفتاح Anon ضمن مساحة العمل (Workspace)
drop policy if exists "Allow workspace access on hares_cases" on public.hares_cases;
create policy "Allow workspace access on hares_cases"
  on public.hares_cases
  for all
  using (true)
  with check (true);

drop policy if exists "Allow workspace access on hares_settings" on public.hares_settings;
create policy "Allow workspace access on hares_settings"
  on public.hares_settings
  for all
  using (true)
  with check (true);
