// ============================================================
// التحقق من Supabase JWT والدور — لا نثق بأي دور أو مستوى مرسل من الواجهة
// ============================================================
import { getAdminClient, type AdminClient } from "./supabase-admin.ts";
import { Errors } from "./respond.ts";
import type { Level, Role, SectorKey, TrackKey } from "../shared/types.ts";

export interface AuthedUser {
  id: string;
  email: string | null;
  role: Role;
  level: Level;
  display_name: string;
  preferred_sector: SectorKey | null;
  track: TrackKey | null;
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) return null;
  const token = m[1].trim();
  // حد أقصى معقول لطول الرمز
  if (token.length < 20 || token.length > 4096) return null;
  return token;
}

/** يتحقق من JWT عبر Supabase Auth ويقرأ الدور من جدول الأدوار المحمي (وليس من user_metadata) */
export async function requireUser(req: Request, admin: AdminClient = getAdminClient()): Promise<AuthedUser> {
  const token = getBearerToken(req);
  if (!token) throw Errors.unauthorized();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Errors.unauthorized();
  const uid = data.user.id;

  const [{ data: roleRow }, { data: profile }] = await Promise.all([
    admin.from("roles").select("role").eq("user_id", uid).maybeSingle(),
    admin.from("profiles").select("level, display_name, preferred_sector, track").eq("id", uid).maybeSingle(),
  ]);

  // ضمان وجود الملف والدور (في حال أُنشئ المستخدم قبل تفعيل المشغّل)
  if (!profile) {
    await admin.from("profiles").upsert({ id: uid, display_name: data.user.email?.split("@")[0] ?? "" }, { onConflict: "id" });
  }
  if (!roleRow) {
    await admin.from("roles").upsert({ user_id: uid, role: "learner" }, { onConflict: "user_id" });
  }

  return {
    id: uid,
    email: data.user.email ?? null,
    role: (roleRow?.role as Role | undefined) ?? "learner",
    level: (profile?.level as Level | undefined) ?? "beginner",
    display_name: profile?.display_name ?? "",
    preferred_sector: (profile?.preferred_sector as SectorKey | null | undefined) ?? null,
    track: (profile?.track as TrackKey | null | undefined) ?? null,
  };
}

export async function requireAdmin(req: Request, admin: AdminClient = getAdminClient()): Promise<AuthedUser> {
  const user = await requireUser(req, admin);
  if (user.role !== "admin") throw Errors.forbidden();
  return user;
}
