// ============================================================
// إعدادات الواجهة — المفاتيح القابلة للنشر فقط (لا أسرار)
// ============================================================
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";

/** الوضع التجريبي عند عدم ربط Supabase: دروس وحالات ثابتة وتقييم محلي وحفظ في المتصفح */
export const IS_DEMO = !(SUPABASE_URL && SUPABASE_ANON_KEY);

export const APP_NAME = "أكاديمية المستشار";
export const APP_VERSION = "1.0.0";

/** اسم موقع Netlify (اختياري) لبناء روابط مباشرة إلى إعدادات المتغيرات */
export const NETLIFY_SITE_NAME = (import.meta.env.VITE_NETLIFY_SITE_NAME as string | undefined)?.trim() || "";
/** معرّف مشروع Supabase مشتق من الرابط لبناء روابط مباشرة إلى لوحة التحكم */
export const SUPABASE_PROJECT_REF = /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(SUPABASE_URL)?.[1] ?? "";
