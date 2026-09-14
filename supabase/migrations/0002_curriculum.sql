-- ============================================================
-- 0002: المنهج التدريبي — الوحدات، الدروس، بنك الأسئلة، التقدم، محاولات الاختبارات
-- ============================================================

create table if not exists academy.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  level text not null check (level in ('beginner','intermediate','expert','advanced_expert')),
  order_index int not null default 0,
  content jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_modules_order on academy.modules(level, order_index);
create trigger trg_modules_updated before update on academy.modules
  for each row execute function academy.set_updated_at();

create table if not exists academy.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references academy.modules(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lessons_module on academy.lessons(module_id, order_index);
create trigger trg_lessons_updated before update on academy.lessons
  for each row execute function academy.set_updated_at();

create table if not exists academy.question_bank (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references academy.modules(id) on delete cascade,
  skill text not null,
  level text not null check (level in ('beginner','intermediate','expert','advanced_expert')),
  question_type text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer jsonb not null default 'null'::jsonb,
  explanation text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_question_bank_module on academy.question_bank(module_id);
create trigger trg_question_bank_updated before update on academy.question_bank
  for each row execute function academy.set_updated_at();

create table if not exists academy.learning_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references academy.modules(id) on delete cascade,
  lesson_id uuid references academy.lessons(id) on delete set null,
  best_score numeric(5,2) not null default 0,
  attempts_count int not null default 0,
  completed boolean not null default false,
  last_activity_at timestamptz not null default now(),
  unique (user_id, module_id)
);
create index if not exists idx_progress_user on academy.learning_progress(user_id);

-- سجل كل محاولة اختبار قصير (مطلوب لقاعدة "70% في ثلاثة اختبارات")
create table if not exists academy.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id uuid not null references academy.modules(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  answers jsonb not null default '[]'::jsonb,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_attempts_user on academy.quiz_attempts(user_id, created_at desc);
