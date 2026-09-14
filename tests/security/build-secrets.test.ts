// ============================================================
// التأكد من عدم وجود أسرار في المستودع أو حزمة البناء
// ============================================================
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("فحص الأسرار", () => {
  it("سكربت check-secrets لا يكتشف أسرارًا في المستودع", () => {
    const out = execFileSync(process.execPath, [join(root, "tools", "check-secrets.mjs")], { encoding: "utf8" });
    expect(out).toMatch(/لا أسرار/);
  });
  it("حزمة البناء (dist) لا تحتوي مفاتيح خادمية إن وُجدت", () => {
    const dist = join(root, "dist");
    if (!existsSync(dist)) return;
    for (const f of walk(dist).filter((f) => /\.(js|html|css|map)$/.test(f))) {
      const text = readFileSync(f, "utf8");
      // ملاحظة: مكتبة supabase-js تحتوي النصين "service_role" و"sb_secret_" في تحذيراتها الداخلية؛ نبحث عن مفاتيح فعلية لا عن البادئة
      expect(text, f).not.toMatch(/sb_secret_[0-9A-Za-z_-]{10,}/);
      expect(text, f).not.toMatch(/eyJ[0-9A-Za-z_-]{20,}\.eyJ[0-9A-Za-z_-]*c2VydmljZV9yb2xl[0-9A-Za-z_-]*\./);
      expect(text, f).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
      // اسم المتغير قد يظهر في نص إرشادي للمسؤول؛ ما يُمنع هو القيمة أو استدعاء Gemini من المتصفح
      expect(text, f).not.toMatch(/generativelanguage\.googleapis\.com/);
      expect(text, f).not.toMatch(/x-goog-api-key/);
    }
  });
  it(".env مستبعد من Git و.env.example بلا قيم حقيقية", () => {
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gi).toMatch(/^\.env$/m);
    const ex = readFileSync(join(root, ".env.example"), "utf8");
    expect(ex).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
    expect(ex).not.toMatch(/eyJ[0-9A-Za-z_-]{30,}/);
  });
});
