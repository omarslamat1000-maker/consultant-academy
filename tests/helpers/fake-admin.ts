// ============================================================
// عميل Supabase وهمي في الذاكرة للاختبارات (يدعم السلاسل المستخدمة في الخدمات)
// ============================================================
import type { AdminClient } from "../../server/supabase-admin.ts";

type Row = Record<string, any>;

export interface FakeUser {
  id: string;
  email: string;
}

export class FakeAdmin {
  tables = new Map<string, Row[]>();
  users = new Map<string, FakeUser>(); // token -> user
  rpcResults: Record<string, unknown> = { consume_rate_limit: true };
  rpcCalls: { fn: string; args: any }[] = [];

  constructor() {
    for (const t of ["profiles", "roles", "modules", "lessons", "question_bank", "learning_progress", "quiz_attempts", "generated_cases", "attempts", "mastery_scores", "case_followups", "ai_providers", "audit_logs", "prompt_templates", "ai_metrics"]) this.tables.set(t, []);
  }

  seed(table: string, rows: Row[]): void {
    this.rows(table).push(...rows.map((r) => ({ ...r })));
  }
  rows(table: string): Row[] {
    let t = this.tables.get(table);
    if (!t) {
      t = [];
      this.tables.set(table, t);
    }
    return t;
  }

  get auth() {
    const self = this;
    return {
      async getUser(token: string) {
        const u = self.users.get(token);
        return u ? { data: { user: { id: u.id, email: u.email } }, error: null } : { data: { user: null }, error: { message: "invalid" } };
      },
      admin: {
        async listUsers() {
          return { data: { users: [...self.users.values()].map((u) => ({ id: u.id, email: u.email, created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString(), last_sign_in_at: null })) }, error: null };
        },
      },
    };
  }

  async rpc(fn: string, args: any) {
    this.rpcCalls.push({ fn, args });
    const r = this.rpcResults[fn];
    if (r instanceof Error) return { data: null, error: { message: r.message } };
    return { data: r, error: null };
  }

  from(table: string) {
    return new Query(this, table);
  }

  asClient(): AdminClient {
    return this as unknown as AdminClient;
  }
}

let idCounter = 1;
function newId(): string {
  const n = String(idCounter++).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}

class Query implements PromiseLike<any> {
  private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private filters: ((r: Row) => boolean)[] = [];
  private payload: Row | Row[] | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private singleMode: "single" | "maybe" | null = null;
  private wantSelect = false;
  private countExact = false;
  private headOnly = false;
  private conflict: string | null = null;

  private admin: FakeAdmin;
  private table: string;

  constructor(admin: FakeAdmin, table: string) {
    this.admin = admin;
    this.table = table;
  }

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") this.wantSelect = true;
    else this.wantSelect = true;
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(p: Row | Row[]) {
    this.op = "insert";
    this.payload = p;
    return this;
  }
  update(p: Row) {
    this.op = "update";
    this.payload = p;
    return this;
  }
  upsert(p: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = p;
    this.conflict = opts?.onConflict ?? "id";
    return this;
  }
  delete(_opts?: { count?: string }) {
    this.op = "delete";
    this.countExact = Boolean(_opts?.count);
    return this;
  }
  eq(col: string, v: any) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  in(col: string, vs: any[]) {
    this.filters.push((r) => vs.includes(r[col]));
    return this;
  }
  gte(col: string, v: any) {
    this.filters.push((r) => r[col] >= v);
    return this;
  }
  not(col: string, _op: string, v: any) {
    this.filters.push((r) => !(r[col] === v || (v === null && r[col] == null)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = { col, asc: opts?.ascending ?? true };
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }
  async execSingle() {
    this.singleMode = "single";
    return this.run();
  }
  // supabase-js: .single() returns the builder (thenable)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  singleImpl() {
    this.singleMode = "single";
    return this;
  }

  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((r) => this.filters.every((f) => f(r)));
  }

  private finish(rows: Row[]) {
    let out = rows;
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
    }
    if (this.limitN !== null) out = out.slice(0, this.limitN);
    if (this.singleMode === "single") return out[0] ? { data: out[0], error: null } : { data: null, error: { message: "no rows" } };
    if (this.singleMode === "maybe") return { data: out[0] ?? null, error: null };
    if (this.headOnly) return { data: null, error: null, count: out.length };
    return { data: out, error: null, count: this.countExact ? out.length : null };
  }

  private async run(): Promise<any> {
    const all = this.admin.rows(this.table);
    if (this.op === "select") return this.finish(this.applyFilters(all));
    if (this.op === "insert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const inserted = items.map((p) => ({ id: newId(), created_at: new Date().toISOString(), ...p }));
      all.push(...inserted);
      return this.wantSelect ? this.finish(inserted) : { data: null, error: null };
    }
    if (this.op === "update") {
      const targets = this.applyFilters(all);
      for (const t of targets) Object.assign(t, this.payload);
      return this.wantSelect ? this.finish(targets) : { data: null, error: null };
    }
    if (this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const keys = (this.conflict ?? "id").split(",").map((s) => s.trim());
      const out: Row[] = [];
      for (const p of items) {
        const existing = all.find((r) => keys.every((k) => r[k] === p[k]));
        if (existing) {
          Object.assign(existing, p);
          out.push(existing);
        } else {
          const row = { id: newId(), created_at: new Date().toISOString(), ...p };
          all.push(row);
          out.push(row);
        }
      }
      return this.wantSelect ? this.finish(out) : { data: null, error: null };
    }
    if (this.op === "delete") {
      const targets = this.applyFilters(all);
      for (const t of targets) all.splice(all.indexOf(t), 1);
      return { data: null, error: null, count: targets.length };
    }
    return { data: null, error: { message: "unsupported" } };
  }

  then<T1 = any, T2 = never>(onfulfilled?: ((v: any) => T1 | PromiseLike<T1>) | null, onrejected?: ((r: any) => T2 | PromiseLike<T2>) | null): PromiseLike<T1 | T2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

// دعم .single() كما في supabase-js
(Query.prototype as any).single = function (this: Query) {
  return (this as any).singleImpl();
};

export function makeRequest(path: string, body: unknown, token?: string, method = "POST"): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}
