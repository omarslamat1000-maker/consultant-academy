-- ============================================================
-- 0007: قناة خدمية بديلة عن service_role
-- تسمح للوظائف الخادمية بالعمل بالمفتاح القابل للنشر فقط + سر خادمي (FUNCTIONS_SERVICE_SECRET)
-- الدالة SECURITY DEFINER تتحقق من السر (مخزَّن في مخطط خاص غير مكشوف) ثم تنفذ عمليات مقيّدة على جداول academy
-- ============================================================

create schema if not exists academy_private;
revoke all on schema academy_private from public, anon, authenticated;

create table if not exists academy_private.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on academy_private.settings from public, anon, authenticated;

-- الدالة الرئيسة: تنفيذ استعلام مهيكل (select / insert / update / upsert / delete / count / list_users)
create or replace function academy.svc_query(p_secret text, p_q jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_op text := p_q ->> 'op';
  v_table text := p_q ->> 'table';
  v_rel regclass;
  v_where text := '';
  v_order text := '';
  v_limit text := '';
  v_set text := '';
  v_cols text := '';
  v_conflict text := '';
  v_sql text;
  v_rows jsonb := '[]'::jsonb;
  v_count bigint := 0;
  f jsonb;
  v_keys text[];
  v_allowed text[] := array['profiles','roles','modules','lessons','question_bank','learning_progress','quiz_attempts','generated_cases','attempts','mastery_scores','case_followups','ai_providers','audit_logs','prompt_templates','ai_metrics'];
begin
  -- البوابة الأولى: جلسة مستخدم مصادق
  if auth.uid() is null then
    raise exception 'authenticated session required' using errcode = '28000';
  end if;
  -- البوابة الثانية: السر الخادمي (مقارنة تجزئة SHA-256)
  select value into v_secret from academy_private.settings where key = 'functions_service_secret';
  if v_secret is null or p_secret is null or length(p_secret) < 32
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') <> encode(extensions.digest(v_secret, 'sha256'), 'hex') then
    raise exception 'unauthorized service call' using errcode = '28000';
  end if;

  if v_op = 'list_users' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'created_at', u.created_at,
      'email_confirmed_at', u.email_confirmed_at, 'last_sign_in_at', u.last_sign_in_at)), '[]'::jsonb)
    into v_rows
    from (select * from auth.users order by created_at desc
          limit coalesce((p_q ->> 'per_page')::int, 50)
          offset (coalesce((p_q ->> 'page')::int, 1) - 1) * coalesce((p_q ->> 'per_page')::int, 50)) u;
    return jsonb_build_object('rows', v_rows);
  end if;

  if v_op = 'rate_limit' then
    return jsonb_build_object('ok', academy.consume_rate_limit(p_q ->> 'bucket', (p_q ->> 'limit')::int, (p_q ->> 'window')::int));
  end if;

  if v_table is null or not (v_table = any (v_allowed)) then
    raise exception 'table not allowed' using errcode = '42501';
  end if;
  v_rel := format('academy.%I', v_table)::regclass;

  -- المرشحات: [{col, op, value}] مع op ∈ eq, in, gte, lte, is, not_is
  for f in select * from jsonb_array_elements(coalesce(p_q -> 'filters', '[]'::jsonb)) loop
    v_where := v_where || case when v_where = '' then ' where ' else ' and ' end;
    case f ->> 'op'
      when 'eq' then v_where := v_where || format('to_jsonb(t.%I) = %L::jsonb', f ->> 'col', (f -> 'value')::text);
      when 'in' then v_where := v_where || format('to_jsonb(t.%I) <@ %L::jsonb', f ->> 'col', (f -> 'value')::text);
      when 'gte' then v_where := v_where || format('t.%I >= %L', f ->> 'col', f ->> 'value');
      when 'lte' then v_where := v_where || format('t.%I <= %L', f ->> 'col', f ->> 'value');
      when 'is' then v_where := v_where || format('t.%I is null', f ->> 'col');
      when 'not_is' then v_where := v_where || format('t.%I is not null', f ->> 'col');
      else raise exception 'filter op not allowed';
    end case;
  end loop;

  if p_q ? 'order' then
    v_order := format(' order by t.%I %s', p_q -> 'order' ->> 'col', case when coalesce((p_q -> 'order' ->> 'asc')::boolean, true) then 'asc' else 'desc' end);
  end if;
  if p_q ? 'limit' then
    v_limit := format(' limit %s', (p_q ->> 'limit')::int);
  end if;

  if v_op in ('insert', 'upsert') then
    -- قائمة الأعمدة من مفاتيح الصف الأول حتى تُطبَّق القيم الافتراضية (id, created_at…) على الأعمدة غير المرسلة
    select array_agg(key) into v_keys from jsonb_object_keys((p_q -> 'rows') -> 0) as key;
    select string_agg(format('%I', k2), ', ') into v_cols from unnest(v_keys) k2;
  end if;

  if v_op = 'select' then
    v_sql := format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from (select * from %s t%s%s%s) t', v_rel, v_where, v_order, v_limit);
    execute v_sql into v_rows;
    return jsonb_build_object('rows', v_rows);
  elsif v_op = 'count' then
    v_sql := format('select count(*) from %s t%s', v_rel, v_where);
    execute v_sql into v_count;
    return jsonb_build_object('count', v_count);
  elsif v_op = 'insert' then
    v_sql := format('with ins as (insert into %s (%s) select %s from jsonb_populate_recordset(null::%s, %L::jsonb) returning *) select coalesce(jsonb_agg(to_jsonb(ins)), ''[]''::jsonb) from ins', v_rel, v_cols, v_cols, v_rel, (p_q -> 'rows')::text);
    execute v_sql into v_rows;
    return jsonb_build_object('rows', v_rows);
  elsif v_op = 'upsert' then
    select string_agg(format('%I = excluded.%I', k2, k2), ', ') into v_set from unnest(v_keys) k2;
    select string_agg(format('%I', c), ', ') into v_conflict from jsonb_array_elements_text(p_q -> 'conflict') c;
    v_sql := format('with ins as (insert into %s (%s) select %s from jsonb_populate_recordset(null::%s, %L::jsonb) on conflict (%s) do update set %s returning *) select coalesce(jsonb_agg(to_jsonb(ins)), ''[]''::jsonb) from ins', v_rel, v_cols, v_cols, v_rel, (p_q -> 'rows')::text, v_conflict, v_set);
    execute v_sql into v_rows;
    return jsonb_build_object('rows', v_rows);
  elsif v_op = 'update' then
    select string_agg(format('%I = (jsonb_populate_record(null::%s, %L::jsonb)).%I', key, v_rel, (p_q -> 'set')::text, key), ', ')
      into v_set from jsonb_object_keys(p_q -> 'set') as key;
    if v_where = '' then raise exception 'update without filter not allowed'; end if;
    v_sql := format('with upd as (update %s t set %s%s returning *) select coalesce(jsonb_agg(to_jsonb(upd)), ''[]''::jsonb) from upd', v_rel, v_set, v_where);
    execute v_sql into v_rows;
    return jsonb_build_object('rows', v_rows);
  elsif v_op = 'delete' then
    if v_where = '' then raise exception 'delete without filter not allowed'; end if;
    v_sql := format('with del as (delete from %s t%s returning *) select count(*) from del', v_rel, v_where);
    execute v_sql into v_count;
    return jsonb_build_object('count', v_count);
  end if;
  raise exception 'op not allowed';
end;
$$;

revoke all on function academy.svc_query(text, jsonb) from public, anon;
-- تُستدعى فقط بجلسة مستخدم مصادق (JWT) + السر الخادمي: بوابتان مستقلتان
grant execute on function academy.svc_query(text, jsonb) to authenticated, service_role;

-- ضبط السر: يُنفَّذ مرة واحدة بقيمة مولَّدة عشوائيًا (32 بايت) توضع نفسها في FUNCTIONS_SERVICE_SECRET على Netlify
-- insert into academy_private.settings (key, value) values ('functions_service_secret', '<SECRET>')
--   on conflict (key) do update set value = excluded.value, updated_at = now();
