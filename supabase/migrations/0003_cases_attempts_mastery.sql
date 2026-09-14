-- ============================================================
-- 0003: الحالات المولدة، المحاولات، درجات الإتقان، أسئلة المتابعة
-- ============================================================

create table if not exists academy.generated_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null,
  semantic_signature jsonb not null default '{}'::jsonb,
  title text not null,
  sector text not null,
  skill text not null,
  level text not null check (level in ('beginner','intermediate','expert','advanced_expert')),
  case_type text not null default 'candidate_led' check (case_type in ('interviewer_led','candidate_led')),
  content jsonb not null,
  prompt_version text not null,
  similarity_score numeric(4,3) not null default 0,
  status text not null default 'active' check (status in ('active','rejected_duplicate')),
  review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  is_reference_example boolean not null default false,
  source text not null default 'ai' check (source in ('ai','static','admin')),
  last_shown_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_cases_user_created on academy.generated_cases(user_id, created_at desc);
create index if not exists idx_cases_fingerprint on academy.generated_cases(fingerprint);
create index if not exists idx_cases_review on academy.generated_cases(review_status) where review_status = 'pending';

create table if not exists academy.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid references academy.generated_cases(id) on delete set null,
  case_fingerprint text not null default '',
  answer_text text not null,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  dimension_scores jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  evaluation_type text not null default 'ai' check (evaluation_type in ('ai','local')),
  human_score numeric(5,2) check (human_score is null or (human_score >= 0 and human_score <= 100)),
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_attempts_user_created on academy.attempts(user_id, created_at desc);
create index if not exists idx_attempts_case on academy.attempts(case_id);

create table if not exists academy.mastery_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null,
  score numeric(5,2) not null default 0 check (score >= 0 and score <= 100),
  evidence_count int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, skill)
);
create index if not exists idx_mastery_user on academy.mastery_scores(user_id);

-- سجل أسئلة المتابعة داخل الحالة (Interviewer-Led)
create table if not exists academy.case_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id uuid not null references academy.generated_cases(id) on delete cascade,
  turn_index int not null default 0,
  question text not null,
  user_answer text,
  assessment jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_followups_case on academy.case_followups(case_id, turn_index);
