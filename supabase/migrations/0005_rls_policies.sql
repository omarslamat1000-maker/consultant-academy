-- ============================================================
-- 0005: سياسات أمان الصفوف (RLS)
-- المبدأ: المستخدم يرى بياناته فقط، المسؤول يُحدَّد عبر academy.is_admin() (جدول أدوار محمي)،
-- الكتابة على الجداول التقييمية تتم خادميًا فقط (service_role) ولا تُمنح للواجهة.
-- كل سياسة UPDATE تحتوي USING و WITH CHECK. لا توجد سياسة عامة TO authenticated بلا شرط ملكية.
-- ============================================================

-- ---------- profiles ----------
alter table academy.profiles enable row level security;

create policy profiles_select_own on academy.profiles
  for select to authenticated
  using (id = (select auth.uid()) or academy.is_admin());

create policy profiles_update_own on academy.profiles
  for update to authenticated
  using (id = (select auth.uid()) or academy.is_admin())
  with check (id = (select auth.uid()) or academy.is_admin());

-- حماية حقل المستوى: لا يغيّره إلا الخادم (service_role) أو المسؤول
create or replace function academy.protect_profile_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.level is distinct from old.level
     and auth.uid() is not null
     and not academy.is_admin() then
    raise exception 'level can only be changed by the platform';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_profile_level on academy.profiles;
create trigger trg_protect_profile_level before update on academy.profiles
  for each row execute function academy.protect_profile_level();

-- ---------- roles ----------
alter table academy.roles enable row level security;

create policy roles_select_own on academy.roles
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());

create policy roles_admin_insert on academy.roles
  for insert to authenticated
  with check (academy.is_admin());

create policy roles_admin_update on academy.roles
  for update to authenticated
  using (academy.is_admin())
  with check (academy.is_admin());

create policy roles_admin_delete on academy.roles
  for delete to authenticated
  using (academy.is_admin() and user_id <> (select auth.uid()));

-- ---------- modules / lessons ----------
alter table academy.modules enable row level security;
create policy modules_select_published on academy.modules
  for select to authenticated
  using (is_published or academy.is_admin());
create policy modules_admin_insert on academy.modules
  for insert to authenticated with check (academy.is_admin());
create policy modules_admin_update on academy.modules
  for update to authenticated using (academy.is_admin()) with check (academy.is_admin());
create policy modules_admin_delete on academy.modules
  for delete to authenticated using (academy.is_admin());

alter table academy.lessons enable row level security;
create policy lessons_select_published on academy.lessons
  for select to authenticated
  using (academy.is_admin() or exists (select 1 from academy.modules m where m.id = lessons.module_id and m.is_published));
create policy lessons_admin_insert on academy.lessons
  for insert to authenticated with check (academy.is_admin());
create policy lessons_admin_update on academy.lessons
  for update to authenticated using (academy.is_admin()) with check (academy.is_admin());
create policy lessons_admin_delete on academy.lessons
  for delete to authenticated using (academy.is_admin());

-- ---------- question_bank ----------
-- الجدول الكامل (مع الإجابة الصحيحة) للمسؤول فقط. المتدرب يقرأ عبر عرض آمن بلا إجابات،
-- والتصحيح يتم خادميًا عبر /api/quiz/submit
alter table academy.question_bank enable row level security;
create policy question_bank_admin_select on academy.question_bank
  for select to authenticated using (academy.is_admin());
create policy question_bank_admin_insert on academy.question_bank
  for insert to authenticated with check (academy.is_admin());
create policy question_bank_admin_update on academy.question_bank
  for update to authenticated using (academy.is_admin()) with check (academy.is_admin());
create policy question_bank_admin_delete on academy.question_bank
  for delete to authenticated using (academy.is_admin());

create or replace view academy.question_bank_public
with (security_invoker = false)
as
  select q.id, q.module_id, q.skill, q.level, q.question_type, q.question, q.options, q.created_at
  from academy.question_bank q
  join academy.modules m on m.id = q.module_id
  where q.is_published and m.is_published and (select auth.uid()) is not null;
revoke all on academy.question_bank_public from public, anon;
grant select on academy.question_bank_public to authenticated, service_role;

-- ---------- ai_providers_public: عرض وصفي بلا أي حقل سري، للمسؤول فقط ----------
create or replace view academy.ai_providers_public
with (security_invoker = false)
as
  select p.id, p.provider, p.model, p.temperature, p.max_output_tokens, p.key_hint, p.is_active,
         p.last_tested_at, p.last_test_ok, p.created_at, p.updated_at,
         coalesce(cb.display_name, '') as created_by_name,
         coalesce(ub.display_name, '') as updated_by_name
  from academy.ai_providers p
  left join academy.profiles cb on cb.id = p.created_by
  left join academy.profiles ub on ub.id = p.updated_by
  where academy.is_admin();
revoke all on academy.ai_providers_public from public, anon;
grant select on academy.ai_providers_public to authenticated, service_role;

-- ---------- learning_progress / quiz_attempts ----------
alter table academy.learning_progress enable row level security;
create policy progress_select_own on academy.learning_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());

alter table academy.quiz_attempts enable row level security;
create policy quiz_attempts_select_own on academy.quiz_attempts
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());

-- ---------- generated_cases / attempts / mastery / followups ----------
alter table academy.generated_cases enable row level security;
create policy cases_select_own on academy.generated_cases
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());
create policy cases_admin_review_update on academy.generated_cases
  for update to authenticated
  using (academy.is_admin())
  with check (academy.is_admin());

alter table academy.attempts enable row level security;
create policy attempts_select_own on academy.attempts
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());
create policy attempts_admin_human_score on academy.attempts
  for update to authenticated
  using (academy.is_admin())
  with check (academy.is_admin());

alter table academy.mastery_scores enable row level security;
create policy mastery_select_own on academy.mastery_scores
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());

alter table academy.case_followups enable row level security;
create policy followups_select_own on academy.case_followups
  for select to authenticated
  using (user_id = (select auth.uid()) or academy.is_admin());

-- ---------- audit_logs / ai_metrics / prompt_templates ----------
alter table academy.audit_logs enable row level security;
create policy audit_admin_select on academy.audit_logs
  for select to authenticated using (academy.is_admin());

alter table academy.ai_metrics enable row level security;
create policy ai_metrics_admin_select on academy.ai_metrics
  for select to authenticated using (academy.is_admin());

alter table academy.prompt_templates enable row level security;
create policy prompts_admin_select on academy.prompt_templates
  for select to authenticated using (academy.is_admin());
create policy prompts_admin_insert on academy.prompt_templates
  for insert to authenticated with check (academy.is_admin());
create policy prompts_admin_update on academy.prompt_templates
  for update to authenticated using (academy.is_admin()) with check (academy.is_admin());
create policy prompts_admin_delete on academy.prompt_templates
  for delete to authenticated using (academy.is_admin());

-- anon: لا وصول إلى أي جدول من جداول الأكاديمية
revoke all on all tables in schema academy from anon;
alter default privileges in schema academy revoke all on tables from anon;
