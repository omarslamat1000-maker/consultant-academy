# دليل إعداد Supabase

## 1. إنشاء المشروع
1. أنشئ مشروعًا في [Supabase](https://supabase.com) (أو استخدم مشروعًا قائمًا؛ جميع جداول الأكاديمية في مخطط مستقل `academy` فلا تتعارض مع تطبيقات أخرى في المشروع نفسه).
2. من **Settings → API** احتفظ بـ:
   - `Project URL` → `SUPABASE_URL` و`VITE_SUPABASE_URL`
   - المفتاح القابل للنشر (`sb_publishable_…` أو `anon`) → `VITE_SUPABASE_ANON_KEY`
   - مفتاح `service_role` (أو `sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY` **خادمي فقط** (Netlify Functions). لا يوضع في الواجهة أو Git أبدًا.

## 2. تنفيذ الترحيلات
نفّذ ملفات `supabase/migrations/` بالترتيب من **SQL Editor** أو عبر Supabase CLI:

```bash
supabase link --project-ref <ref>
supabase db push   # إن كنت تستخدم مجلد supabase/migrations مع CLI
```

| الملف | المحتوى |
| --- | --- |
| `0001_schema_profiles_roles.sql` | المخطط `academy`، كشفه عبر Data API، profiles، roles، `is_admin()`، مشغّل إنشاء الملف تلقائيًا |
| `0002_curriculum.sql` | modules, lessons, question_bank, learning_progress, quiz_attempts |
| `0003_cases_attempts_mastery.sql` | generated_cases, attempts, mastery_scores, case_followups |
| `0004_ai_providers_audit_ratelimit.sql` | ai_providers (مشفّر)، audit_logs، rate_limits + دالة الحد، prompt_templates، ai_metrics |
| `0005_rls_policies.sql` | سياسات RLS كاملة + العرضان الآمنان `question_bank_public` و`ai_providers_public` |
| `0006_seed_curriculum.sql` | تعبئة 12 وحدة و73 سؤالًا وقوالب Prompts (قابل لإعادة التنفيذ) |

> بديل للتعبئة بلا SQL: `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… node tools/seed-curriculum.ts` (يستخدم حساب مسؤول وسياسات RLS الإدارية).

## 3. كشف المخطط `academy` عبر Data API
الترحيل 0001 يضيف `academy` إلى `pgrst.db_schemas` تلقائيًا. إن ظهر خطأ `PGRST106` (schema not exposed) أضفه يدويًا من **Settings → API → Exposed schemas**: `public, graphql_public, academy`.

## 4. إعداد المصادقة
- **Authentication → Providers → Email**: مفعّل. يُنصح بإبقاء "Confirm email" مفعّلًا (المنصة تعرض رسالة تأكيد عربية واضحة).
- **Authentication → URL Configuration**: أضف رابط الموقع (`https://<site>.netlify.app`) إلى Site URL وRedirect URLs، وكذلك `https://<site>.netlify.app/reset-password`.
- قوالب البريد: يمكنك تعريبها من **Email Templates**.

## 5. تعيين أول مسؤول
بعد أن يسجّل المسؤول حسابه من الواجهة (وتأكيد البريد)، نفّذ في SQL Editor:

```sql
update academy.roles set role = 'admin'
where user_id = (select id from auth.users where email = 'admin@example.com');
```

بعدها يظهر رابط "لوحة المسؤول" ويمكنه إدارة الأدوار الأخرى من الواجهة.

## 6. التحقق
- من الواجهة: سجّل الدخول، افتح المسار التدريبي (يجب أن تظهر 12 وحدة).
- اختبار عزل البيانات (اختياري): أنشئ حسابين متدربين مؤكدين واضبط `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_USER_A_EMAIL/PASSWORD`, `TEST_USER_B_EMAIL/PASSWORD` ثم `npm test` لتشغيل `tests/security/rls-isolation.test.ts`.

## ملاحظات الأمان
- `ai_providers` و`rate_limits` بلا أي امتيازات لـ `anon`/`authenticated`؛ `service_role` فقط.
- `question_bank` (مع الإجابات) للمسؤول فقط؛ المتدرب يقرأ `question_bank_public` والتصحيح خادمي.
- تغيير `profiles.level` محمي بمشغّل: لا يغيّره إلا الخادم أو المسؤول.
- الدوال `SECURITY DEFINER` محدودة: `is_admin()` (بلا معاملات، تعتمد `auth.uid()`)، `handle_new_user()`، `consume_rate_limit()` (service_role فقط)، `protect_profile_level()`.
