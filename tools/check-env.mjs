// ============================================================
// فحص جاهزية البيئة: يطبع جدولًا بحالة كل متغير دون كشف القيم
// الاستخدام: node tools/check-env.mjs   (يقرأ .env إن وُجد)
// ============================================================
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"));

const rows = [
  ["VITE_SUPABASE_URL", "الواجهة", true, "رابط مشروع Supabase"],
  ["VITE_SUPABASE_ANON_KEY", "الواجهة", true, "المفتاح القابل للنشر (anon / sb_publishable_)"],
  ["SUPABASE_URL", "الوظائف", true, "رابط المشروع نفسه"],
  ["SUPABASE_SERVICE_ROLE_KEY", "الوظائف", false, "Supabase → Settings → API Keys → service_role (سري) — أو بديله FUNCTIONS_SERVICE_SECRET"],
  ["FUNCTIONS_SERVICE_SECRET", "الوظائف", false, "سر القناة الخدمية (الترحيل 0007) — بديل عن service_role"],
  ["CONFIG_ENCRYPTION_KEY", "الوظائف", false, "32 بايت base64 لحفظ مفاتيح الذكاء من التطبيق"],
  ["GEMINI_API_KEY", "الوظائف", false, "بديل اختياري عن الحفظ من التطبيق"],
];

let missingRequired = 0;
const hasDbAccess = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.FUNCTIONS_SERVICE_SECRET?.trim());
console.log("\nجاهزية البيئة — أكاديمية المستشار\n");
for (const [name, scope, required, hint] of rows) {
  const v = process.env[name]?.trim();
  let status = v ? "✓ مضبوط" : required ? "✗ مفقود" : "– اختياري";
  if (name === "VITE_SUPABASE_ANON_KEY" && v && /service_role|sb_secret_/.test(v)) status = "‼ خطأ: هذا مفتاح سري ولا يجوز وضعه في الواجهة";
  if (name === "SUPABASE_SERVICE_ROLE_KEY" && v && /sb_publishable_/.test(v)) status = "‼ خطأ: هذا مفتاح قابل للنشر وليس service_role";
  if (name === "CONFIG_ENCRYPTION_KEY" && v) {
    const ok = /^[0-9a-fA-F]{64}$/.test(v) || Buffer.from(v, "base64").length === 32;
    if (!ok) status = "‼ خطأ: يجب أن يكون 32 بايت (base64 أو hex)";
  }
  if (!v && required) missingRequired++;
  console.log(`${status.padEnd(44)} ${name.padEnd(28)} [${scope}] ${hint}`);
}
console.log("");
if (!hasDbAccess) {
  console.log("⚠ لا يوجد SUPABASE_SERVICE_ROLE_KEY ولا FUNCTIONS_SERVICE_SECRET: تعمل الواجهة لكن مسارات /api/* تعيد خطأ.");
  missingRequired++;
}
if (missingRequired) {
  console.log(`⚠ ${missingRequired} متغير(ات) مطلوبة مفقودة.`);
  process.exitCode = 1;
} else {
  console.log(`✓ جميع المتغيرات المطلوبة مضبوطة (اتصال الوظائف عبر ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ? "service_role" : "القناة الخدمية"}).`);
}
