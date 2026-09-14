# دليل النشر على Netlify

## 1. ربط المستودع
- ادفع المشروع إلى GitHub/GitLab (تأكد أن `.env` مستبعد — `npm run check:secrets`).
- في Netlify: **Add new site → Import from Git**. الإعدادات تُقرأ من `netlify.toml`:
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Functions: `netlify/functions` (esbuild)

## 2. متغيرات البيئة (Site settings → Environment variables)
| المتغير | النطاق | الوصف |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Build | رابط المشروع |
| `VITE_SUPABASE_ANON_KEY` | Build | المفتاح القابل للنشر فقط |
| `SUPABASE_URL` | Functions | رابط المشروع |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions | **سري** — الوظائف فقط |
| `CONFIG_ENCRYPTION_KEY` | Functions | **سري** — مفتاح التشفير الرئيس (32 بايت base64) |
| `GEMINI_API_KEY` | Functions (اختياري) | بديل عند عدم الربط من التطبيق |
| `GEMINI_MODEL` | Functions (اختياري) | النموذج الافتراضي للبديل |
| `ALLOWED_ORIGIN` | Functions (اختياري) | لتفعيل CORS لأصل آخر؛ افتراضيًا نفس الأصل |

استخدم خاصية **Secret** في Netlify للمتغيرات السرية.

## 3. نشر Preview قبل Production
- افتح Pull Request → Netlify ينشئ **Deploy Preview** تلقائيًا.
- تحقق في المعاينة: تسجيل الدخول، المسار التدريبي (12 وحدة)، توليد حالة، التقييم، السجل، لوحة المسؤول، `/api/health` (يعيد `{ok, supabase, ai}`).
- بعد الاعتماد ادمج إلى الفرع الرئيس → Production.

## 4. بعد النشر
- أضف رابط الموقع إلى Supabase **Auth → URL Configuration** (Site URL وRedirect URLs بما فيها `/reset-password`).
- عيّن أول مسؤول (SQL في دليل Supabase) ثم اربط Gemini من لوحة المسؤول.
- راقب سجلات الوظائف من Netlify → Functions (لا تحتوي أسرارًا؛ الأخطاء مُنقّاة).

## 5. المسارات
جميع مسارات `/api/*` تُخدم بالوظائف عبر `config.path`؛ بقية المسارات تعود إلى `index.html` (SPA). ترويسات الأمان في `netlify.toml`.

## 6. التطوير المحلي
```bash
npm run dev       # Vite على 8220 مع proxy لـ /api
npm run dev:api   # tools/dev-api.ts على 8788 (يحمّل الوظائف نفسها بـ Node 22.18+/24)
```
أو باستخدام Netlify CLI: `npx netlify-cli dev` (يشغّل الواجهة والوظائف معًا).
