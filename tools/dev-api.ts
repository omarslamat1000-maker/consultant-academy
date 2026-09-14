// ============================================================
// خادم API تطويري محلي يحاكي Netlify Functions (v2) — للتطوير والاختبار فقط
// يقرأ .env ثم يحمّل netlify/functions/*.mts ويوجّه الطلبات وفق config.path
// التشغيل: node tools/dev-api.ts   (Node 22.18+ / 24 مع Type Stripping المدمج)
// ============================================================
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (e) {
    console.warn("[dev-api] could not load .env:", e instanceof Error ? e.message : e);
  }
}

type Handler = (req: Request) => Promise<Response>;
const routes = new Map<string, Handler>();

export async function loadFunctions(): Promise<Map<string, Handler>> {
  const dir = join(root, "netlify", "functions");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".mts"))) {
    const mod = (await import(pathToFileURL(join(dir, file)).href)) as { default: Handler; config?: { path?: string } };
    const path = mod.config?.path;
    if (!path) continue;
    routes.set(path, mod.default);
  }
  return routes;
}

async function toRequest(req: IncomingMessage, port: number): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) headers.set(k, v.join(", "));
    else if (typeof v === "string") headers.set(k, v);
  }
  const method = req.method ?? "GET";
  return new Request(`http://127.0.0.1:${port}${req.url ?? "/"}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

async function send(res: ServerResponse, r: Response): Promise<void> {
  res.statusCode = r.status;
  r.headers.forEach((v, k) => res.setHeader(k, v));
  const buf = Buffer.from(await r.arrayBuffer());
  res.end(buf);
}

export async function startDevApi(port = Number(process.env.DEV_API_PORT ?? 8788)): Promise<{ close: () => void; port: number }> {
  await loadFunctions();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const handler = routes.get(url.pathname);
    if (!handler) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: { code: "not_found", message: "المسار غير موجود." } }));
      return;
    }
    try {
      const request = await toRequest(req, port);
      const response = await handler(request);
      await send(res, response);
    } catch (err) {
      console.error("[dev-api] handler crashed:", err instanceof Error ? err.message : err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: { code: "server_error", message: "حدث خطأ غير متوقع." } }));
    }
  });
  await new Promise<void>((resolveStart) => server.listen(port, "127.0.0.1", resolveStart));
  return { close: () => server.close(), port };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  startDevApi().then(({ port }) => {
    console.log(`[dev-api] listening on http://127.0.0.1:${port}`);
    console.log(`[dev-api] routes: ${[...routes.keys()].join(", ")}`);
    console.log(`[dev-api] supabase: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "configured" : "NOT configured (functions will return server_error)"}`);
  });
}
