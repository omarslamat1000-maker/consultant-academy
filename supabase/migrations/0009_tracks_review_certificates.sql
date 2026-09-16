-- ============================================================
-- 0009: المسارات حسب الدور، بطاقات المراجعة المتباعدة، سجل الترقيات (للشهادات)
-- ============================================================

-- المسار المهني المفضل (يعيد ترتيب الوحدات ويثقّل القطاعات)
alter table academy.profiles
  add column if not exists track text check (track in ('pmo_manager','performance_analyst','transformation_consultant'));

-- بطاقات المراجعة المتباعدة (Spaced Repetition) للأسئلة التي أخطأ فيها المتدرب
create table if not exists academy.review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references academy.question_bank(id) on delete cascade,
  due_at timestamptz not null default now(),
  interval_days int not null default 1,
  streak int not null default 0,
  reviews int not null default 0,
  last_result boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create index if not exists idx_review_cards_due on academy.review_cards(user_id, due_at);
create trigger trg_review_cards_updated before update on academy.review_cards
  for each row execute function academy.set_updated_at();
alter table academy.review_cards enable row level security;
create policy review_cards_select_own on academy.review_cards
  for select to authenticated using (user_id = (select auth.uid()) or academy.is_admin());
-- الكتابة خادمية فقط (التصحيح على الخادم)

-- سجل الترقيات بين المستويات (أساس الشهادات)
create table if not exists academy.level_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('beginner','intermediate','expert','advanced_expert')),
  achieved_at timestamptz not null default now(),
  unique (user_id, level)
);
alter table academy.level_history enable row level security;
create policy level_history_select_own on academy.level_history
  for select to authenticated using (user_id = (select auth.uid()) or academy.is_admin());

-- إدراج المستوى الأول لكل الملفات القائمة (تاريخ الانضمام)
insert into academy.level_history (user_id, level, achieved_at)
select id, 'beginner', created_at from academy.profiles
on conflict (user_id, level) do nothing;

revoke all on academy.review_cards, academy.level_history from anon;
