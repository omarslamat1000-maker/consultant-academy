-- ============================================================
-- أكاديمية المستشار — 0001: المخطط الأساسي، الملفات الشخصية، الأدوار
-- جميع جداول الأكاديمية في مخطط مستقل `academy` لعزلها عن أي تطبيق آخر يشارك المشروع نفسه
-- ============================================================

create schema if not exists academy;

-- كشف المخطط عبر Data API (PostgREST). يمكن أيضًا ضبطه من لوحة Supabase: Settings > API > Exposed schemas
-- ملاحظة: يُحافَظ على المخططات المكشوفة سابقًا (public, graphql_public)
do $$
declare
  current_schemas text;
begin
  select coalesce(
    (select split_part(cfg, '=', 2)
       from unnest((select rolconfig from pg_roles where rolname = 'authenticator')) cfg
      where cfg like 'pgrst.db_schemas=%'),
    'public, graphql_public') into current_schemas;
  if position('academy' in current_schemas) = 0 then
    execute format('alter role authenticator set pgrst.db_schemas = %L', current_schemas || ', academy');
  end if;
end $$;
notify pgrst, 'reload config';

grant usage on schema academy to anon, authenticated, service_role;
-- الامتيازات تُمنح على مستوى الجدول ثم تُقيَّد بسياسات RLS (لا سياسة = لا وصول)
alter default privileges in schema academy grant all on tables to anon, authenticated, service_role;
alter default privileges in schema academy grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema academy grant execute on functions to anon, authenticated, service_role;

-- دالة تحديث updated_at
create or replace function academy.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table if not exists academy.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  level text not null default 'beginner' check (level in ('beginner','intermediate','expert','advanced_expert')),
  preferred_sector text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on academy.profiles
  for each row execute function academy.set_updated_at();

-- ---------- roles ----------
-- الأدوار هي مصدر الحقيقة للتفويض (لا يُعتمد على user_metadata مطلقًا)
create table if not exists academy.roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'learner' check (role in ('admin','learner')),
  created_at timestamptz not null default now()
);

-- دالة التحقق من دور المسؤول: SECURITY DEFINER مقيّدة على auth.uid() فقط،
-- لا تقبل معاملات، ولا تُنفَّذ إلا للمستخدمين المصادق عليهم
create or replace function academy.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from academy.roles r
    where r.user_id = auth.uid() and r.role = 'admin'
  );
$$;
revoke all on function academy.is_admin() from public, anon;
grant execute on function academy.is_admin() to authenticated, service_role;

-- إنشاء الملف الشخصي ودور learner تلقائيًا عند تسجيل مستخدم جديد
create or replace function academy.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into academy.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  insert into academy.roles (user_id, role) values (new.id, 'learner')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_academy_new_user on auth.users;
create trigger trg_academy_new_user
  after insert on auth.users
  for each row execute function academy.handle_new_user();

-- تعبئة الملفات للمستخدمين الموجودين مسبقًا في المشروع نفسه (إن وجدوا)
insert into academy.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (id) do nothing;
insert into academy.roles (user_id, role)
select u.id, 'learner' from auth.users u
on conflict (user_id) do nothing;
