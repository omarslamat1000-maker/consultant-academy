// ============================================================
// فحص الأسرار: يبحث في المستودع وملفات البناء عن أنماط مفاتيح حقيقية
// الاستخدام: node tools/check-secrets.mjs   (يفشل بكود 1 عند اكتشاف سر)
// ============================================================
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const root = resolve(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", ".git", ".netlify", "coverage"]);
const SKIP_FILES = new Set([".env", "check-secrets.mjs"]);
const TEXT_EXT = /\.(ts|tsx|mts|js|mjs|cjs|json|md|toml|sql|html|css|yml|yaml|txt|env|example)$/i;

const PATTERNS = [
  { name: "Google API key", re: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: "Supabase secret key", re: /sb_secret_[0-9A-Za-z_-]{10,}/g },
  { name: "Supabase service_role JWT", re: /eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{10,}/g, filter: (m) => decodeRole(m) === "service_role" },
  { name: "Private key block", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/g },
  { name: "Generic secret assignment", re: /(CONFIG_ENCRYPTION_KEY|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY)\s*=\s*["']?[A-Za-z0-9+/=_-]{24,}/g },
];

function decodeRole(jwt) {
  try {
    const payload = jwt.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (TEXT_EXT.test(name) && !SKIP_FILES.has(name) && !name.startsWith(".env.") || name === ".env.example") out.push(p);
  }
  return out;
}

const findings = [];
for (const file of walk(root)) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const p of PATTERNS) {
    const matches = text.match(p.re) ?? [];
    for (const m of matches) {
      if (p.filter && !p.filter(m)) continue;
      findings.push({ file: relative(root, file), pattern: p.name, sample: m.slice(0, 12) + "…" });
    }
  }
}

if (findings.length) {
  console.error("✖ اكتُشفت أسرار محتملة:");
  for (const f of findings) console.error(`  - ${f.file}: ${f.pattern} (${f.sample})`);
  process.exit(1);
} else {
  console.log("✓ لا أسرار مكتشفة في المستودع أو ملفات البناء.");
}
