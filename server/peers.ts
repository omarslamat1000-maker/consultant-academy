// ============================================================
// مقارنة مجهولة بالأقران: تُجمَّع درجات الإتقان خادميًا وتُعاد نسبًا فقط (لا معرفات ولا أسماء)
// ============================================================
import { comparePeers, type PeerComparison } from "../shared/peers.ts";
import type { AuthedUser } from "./auth.ts";
import { Errors } from "./respond.ts";
import type { AdminClient } from "./supabase-admin.ts";

export async function buildPeerComparison(admin: AdminClient, user: AuthedUser): Promise<PeerComparison> {
  const { data, error } = await admin.from("mastery_scores").select("user_id, skill, score").limit(20000);
  if (error) throw Errors.server();
  const rows = ((data ?? []) as any[]).map((r) => ({ user_id: String(r.user_id), skill: String(r.skill), score: Number(r.score) }));
  return comparePeers(rows, user.id);
}
