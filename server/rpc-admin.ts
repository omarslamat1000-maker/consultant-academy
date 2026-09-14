// ============================================================
// عميل خدمي بديل عن service_role: يترجم سلاسل supabase-js (from().select().eq()…) إلى
// استدعاء واحد للدالة academy.svc_query المحمية بسر خادمي (FUNCTIONS_SERVICE_SECRET)
// يستخدم المفتاح القابل للنشر فقط؛ السر لا يغادر الخادم ولا يُسجَّل
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequestToken } from "./request-context.ts";

type Row = Record<string, any>;
type Filter = { col: string; op: "eq" | "in" | "gte" | "lte" | "is" | "not_is"; value?: unknown };

interface QueryPlan {
  op: "select" | "insert" | "update" | "upsert" | "delete" | "count";
  table: string;
  filters: Filter[];
  order?: { col: string; asc: boolean };
  limit?: number;
  rows?: Row[];
  set?: Row;
  conflict?: string[];
}

export class ServiceQuery implements PromiseLike<any> {
  private plan: QueryPlan;
  private mode: "single" | "maybe" | null = null;
  private wantRows = false;
  private countExact = false;
  private readonly exec: (plan: QueryPlan) => Promise<any>;

  constructor(table: string, exec: (plan: QueryPlan) => Promise<any>) {
    this.plan = { op: "select", table, filters: [] };
    this.exec = exec;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    this.wantRows = true;
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.plan.op = "count";
    return this;
  }
  insert(rows: Row | Row[]) {
    this.plan.op = "insert";
    this.plan.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  update(set: Row) {
    this.plan.op = "update";
    this.plan.set = set;
    return this;
  }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.plan.op = "upsert";
    this.plan.rows = Array.isArray(rows) ? rows : [rows];
    this.plan.conflict = (opts?.onConflict ?? "id").split(",").map((s) => s.trim());
    return this;
  }
  delete(opts?: { count?: string }) {
    this.plan.op = "delete";
    this.countExact = Boolean(opts?.count);
    return this;
  }
  eq(col: string, value: unknown) {
    this.plan.filters.push({ col, op: "eq", value });
    return this;
  }
  in(col: string, values: unknown[]) {
    this.plan.filters.push({ col, op: "in", value: values });
    return this;
  }
  gte(col: string, value: unknown) {
    this.plan.filters.push({ col, op: "gte", value });
    return this;
  }
  lte(col: string, value: unknown) {
    this.plan.filters.push({ col, op: "lte", value });
    return this;
  }
  not(col: string, op: string, value: unknown) {
    if (op === "is" && value === null) this.plan.filters.push({ col, op: "not_is" });
    else throw new Error("unsupported not() filter in service client");
    return this;
  }
  is(col: string, value: unknown) {
    if (value === null) this.plan.filters.push({ col, op: "is" });
    else this.plan.filters.push({ col, op: "eq", value });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.plan.order = { col, asc: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.plan.limit = n;
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    this.plan.limit = 1;
    return this;
  }
  single() {
    this.mode = "single";
    this.plan.limit = 1;
    return this;
  }

  private async run(): Promise<any> {
    try {
      const res = await this.exec(this.plan);
      if (this.plan.op === "count") return { data: null, error: null, count: Number(res.count ?? 0) };
      if (this.plan.op === "delete") return { data: null, error: null, count: Number(res.count ?? 0) };
      const rows: Row[] = res.rows ?? [];
      if (this.mode === "single") return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "no rows", code: "PGRST116" } };
      if (this.mode === "maybe") return { data: rows[0] ?? null, error: null };
      if (!this.wantRows && this.plan.op !== "select") return { data: null, error: null };
      return { data: rows, error: null, count: this.countExact ? rows.length : null };
    } catch (err) {
      return { data: null, error: { message: err instanceof Error ? err.message : String(err), code: "svc" }, count: null };
    }
  }

  then<T1 = any, T2 = never>(onfulfilled?: ((v: any) => T1 | PromiseLike<T1>) | null, onrejected?: ((r: any) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export interface ServiceClientOptions {
  url: string;
  anonKey: string;
  secret: string;
}

/** يبني عميلًا بواجهة supabase-js الفرعية المستخدمة في الخدمات، مبنيًا على svc_query */
export function createServiceClient(opts: ServiceClientOptions) {
  const sb: SupabaseClient<any, "academy", any> = createClient(opts.url, opts.anonKey, {
    db: { schema: "academy" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }) as SupabaseClient<any, "academy", any>;

  async function call(q: Record<string, unknown>): Promise<any> {
    // البوابة الأولى: جلسة مستخدم مصادق (الدالة ممنوحة لدور authenticated فقط)؛ البوابة الثانية: السر الخادمي
    const token = getRequestToken();
    let builder = sb.rpc("svc_query", { p_secret: opts.secret, p_q: q });
    if (token) builder = builder.setHeader("Authorization", `Bearer ${token}`);
    const { data, error } = await builder;
    if (error) throw new Error(error.message);
    return data ?? {};
  }

  const exec = (plan: QueryPlan) => {
    const q: Record<string, unknown> = { op: plan.op, table: plan.table, filters: plan.filters.map((f) => ({ col: f.col, op: f.op, value: f.value ?? null })) };
    if (plan.order) q.order = plan.order;
    if (plan.limit !== undefined) q.limit = plan.limit;
    if (plan.rows) q.rows = plan.rows;
    if (plan.set) q.set = plan.set;
    if (plan.conflict) q.conflict = plan.conflict;
    return call(q);
  };

  return {
    from(table: string) {
      return new ServiceQuery(table, exec);
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "consume_rate_limit") {
        try {
          const r = await call({ op: "rate_limit", bucket: args.p_bucket, limit: args.p_limit, window: args.p_window_seconds });
          return { data: r.ok === true, error: null };
        } catch (err) {
          return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
        }
      }
      return sb.rpc(fn, args);
    },
    auth: {
      getUser: (token: string) => sb.auth.getUser(token),
      admin: {
        async listUsers({ page = 1, perPage = 50 }: { page?: number; perPage?: number } = {}) {
          try {
            const r = await call({ op: "list_users", page, per_page: perPage });
            return { data: { users: (r.rows ?? []) as any[] }, error: null };
          } catch (err) {
            return { data: { users: [] as any[] }, error: { message: err instanceof Error ? err.message : String(err) } };
          }
        },
      },
    },
  };
}
