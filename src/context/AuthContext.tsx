// ============================================================
// سياق المصادقة — Supabase Auth في الوضع الكامل، مستخدم محلي في الوضع التجريبي
// ============================================================
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ProfileRecord, Role } from "../../shared/types.ts";
import { IS_DEMO } from "../lib/config.ts";
import { data } from "../lib/data.ts";
import { getSupabase } from "../lib/supabase.ts";

export interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthState {
  loading: boolean;
  user: AuthUser | null;
  profile: ProfileRecord | null;
  role: Role;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  demoSignIn: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_ERRORS: Record<string, string> = {
  "Invalid login credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "Email not confirmed": "لم يتم تأكيد البريد الإلكتروني بعد. افتح رسالة التأكيد في بريدك.",
  "User already registered": "هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول.",
  "Password should be at least 6 characters": "كلمة المرور يجب ألا تقل عن 6 أحرف.",
  "Signup requires a valid password": "أدخل كلمة مرور صالحة.",
  "Unable to validate email address: invalid format": "صيغة البريد الإلكتروني غير صحيحة.",
  "Email rate limit exceeded": "تم تجاوز حد إرسال الرسائل. حاول لاحقًا.",
  "For security purposes, you can only request this after": "لأسباب أمنية، انتظر قليلًا قبل إعادة المحاولة.",
};

export function translateAuthError(msg: string): string {
  for (const [k, v] of Object.entries(AUTH_ERRORS)) if (msg.includes(k)) return v;
  if (/weak password|Password/i.test(msg)) return "كلمة المرور ضعيفة: استخدم 8 أحرف على الأقل مع أرقام.";
  return "تعذر إتمام العملية. تحقق من البيانات وحاول مرة أخرى.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [role, setRole] = useState<Role>("learner");
  const [demoActive, setDemoActive] = useState<boolean>(() => {
    try {
      return IS_DEMO && sessionStorage.getItem("ca-demo-signed-in") === "1";
    } catch {
      return false;
    }
  });

  const refreshProfile = useCallback(async () => {
    try {
      const p = await data.getProfile();
      setProfile(p.profile);
      setRole(p.role);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (IS_DEMO) {
      if (demoActive) {
        setUser({ id: "demo", email: "demo@local" });
        void refreshProfile().finally(() => setLoading(false));
      } else {
        setUser(null);
        setLoading(false);
      }
      return;
    }
    const sb = getSupabase();
    let mounted = true;
    sb.auth.getSession().then(({ data: d }) => {
      if (!mounted) return;
      const u = d.session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      if (u) void refreshProfile().finally(() => setLoading(false));
      else setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setUser(u ? { id: u.id, email: u.email ?? null } : null);
      if (u) void refreshProfile();
      else {
        setProfile(null);
        setRole("learner");
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [demoActive, refreshProfile]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      profile,
      role,
      isDemo: IS_DEMO,
      async signIn(email, password) {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw new Error(translateAuthError(error.message));
      },
      async signUp(email, password, displayName) {
        const { data: d, error } = await getSupabase().auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin } });
        if (error) throw new Error(translateAuthError(error.message));
        return { needsConfirmation: !d.session };
      },
      async signOut() {
        if (IS_DEMO) {
          try {
            sessionStorage.removeItem("ca-demo-signed-in");
          } catch {
            // تجاهل
          }
          setDemoActive(false);
          return;
        }
        await getSupabase().auth.signOut();
      },
      async resetPassword(email) {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw new Error(translateAuthError(error.message));
      },
      async updatePassword(password) {
        const { error } = await getSupabase().auth.updateUser({ password });
        if (error) throw new Error(translateAuthError(error.message));
      },
      refreshProfile,
      demoSignIn() {
        try {
          sessionStorage.setItem("ca-demo-signed-in", "1");
        } catch {
          // تجاهل
        }
        setLoading(true);
        setDemoActive(true);
      },
    }),
    [loading, user, profile, role, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
