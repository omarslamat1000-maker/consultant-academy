-- ============================================================
-- 0004: مزودو الذكاء الاصطناعي (مشفّر)، سجل العمليات، حدود المعدل، قوالب Prompts، مقاييس الذكاء
-- ============================================================

-- الجدول يحتوي أسرارًا مشفّرة (AES-256-GCM) لا يمكن فكها إلا خادميًا بمفتاح CONFIG_ENCRYPTION_KEY.
-- يُمنع الوصول إليه كليًا من anon/authenticated (لا امتيازات ولا سياسات). service_role فقط.
create table if not exists academy.ai_providers (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini')),
  model text not null default 'gemini-2.5-flash',
  temperature numeric(3,2) not null default 0.70 check (temperature >= 0 and temperature <= 2),
  max_output_tokens int not null default 8192 check (max_output_tokens between 256 and 65536),
  encrypted_secret text not null,
  secret_iv text not null,
  auth_tag text not null,
  key_hint text not null default '',
  is_active boolean not null default true,
  last_tested_at timestamptz,
  last_test_ok boolean,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_ai_providers_updated before update on academy.ai_providers
  for each row execute function academy.set_updated_at();
revoke all on academy.ai_providers from public, anon, authenticated;
alter table academy.ai_providers enable row level security;
-- لا سياسات عمدًا: service_role يتجاوز RLS، وأي دور آخر لا يملك امتيازات أصلًا

-- ---------- audit_logs ----------
create table if not exists academy.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_created on academy.audit_logs(created_at desc);

-- ---------- rate_limits ----------
create table if not exists academy.rate_limits (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);
revoke all on academy.rate_limits from public, anon, authenticated;
alter table academy.rate_limits enable row level security;

-- دالة استهلاك حد المعدل (تُستدعى من الوظائف الخادمية بمفتاح service_role فقط)
create or replace function academy.consume_rate_limit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into academy.rate_limits (bucket, count, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set count = case when academy.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                     then 1 else academy.rate_limits.count + 1 end,
        window_start = case when academy.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                     then now() else academy.rate_limits.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function academy.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function academy.consume_rate_limit(text, int, int) to service_role;

-- ---------- prompt_templates (إصدارات Prompts قابلة للإدارة) ----------
create table if not exists academy.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key in ('case-generator-system-prompt','case-evaluator-system-prompt','follow-up-interviewer-prompt','adaptive-recommendation-prompt','question-generator-prompt')),
  version text not null,
  content text not null,
  is_active boolean not null default false,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, version)
);
create unique index if not exists idx_prompt_active on academy.prompt_templates(key) where is_active;
create trigger trg_prompt_templates_updated before update on academy.prompt_templates
  for each row execute function academy.set_updated_at();

-- ---------- ai_metrics (قياس جودة الذكاء الاصطناعي) ----------
create table if not exists academy.ai_metrics (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('generate','evaluate','follow_up','recommend','test')),
  prompt_version text not null default '',
  model text not null default '',
  json_valid boolean not null default true,
  repaired boolean not null default false,
  regenerated boolean not null default false,
  duplicate_rejected boolean not null default false,
  similarity numeric(4,3),
  latency_ms int not null default 0,
  error_code text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_metrics_created on academy.ai_metrics(created_at desc);
revoke all on academy.ai_metrics from public, anon;
