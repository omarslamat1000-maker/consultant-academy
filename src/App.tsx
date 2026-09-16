// ============================================================
// التوجيه والحراسة: تسجيل الدخول أولًا، ثم لوحة التقدم مباشرة
// ============================================================
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { Loading } from "./components/ui.tsx";
import { useAuth } from "./context/AuthContext.tsx";
import { AdminLayout } from "./pages/admin/AdminLayout.tsx";
import { AdminAudit } from "./pages/admin/AdminAudit.tsx";
import { AdminCases } from "./pages/admin/AdminCases.tsx";
import { AdminModules } from "./pages/admin/AdminModules.tsx";
import { AdminPrompts } from "./pages/admin/AdminPrompts.tsx";
import { AdminProvider } from "./pages/admin/AdminProvider.tsx";
import { AdminQuestions } from "./pages/admin/AdminQuestions.tsx";
import { AdminStats } from "./pages/admin/AdminStats.tsx";
import { AdminUsers } from "./pages/admin/AdminUsers.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import { HistoryPage } from "./pages/HistoryPage.tsx";
import { LibraryPage } from "./pages/LibraryPage.tsx";
import { LoginPage, ResetPasswordPage } from "./pages/LoginPage.tsx";
import { MasteryPage } from "./pages/MasteryPage.tsx";
import { ModulePage } from "./pages/ModulePage.tsx";
import { PathPage } from "./pages/PathPage.tsx";
import { ProfilePage } from "./pages/ProfilePage.tsx";
import { SimulatorPage } from "./pages/SimulatorPage.tsx";

function AdminGuard({ children }: { children: React.ReactElement }) {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/" replace />;
  return children;
}

export function App() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Loading label="جارٍ تجهيز المنصة…" />
      </div>
    );
  }
  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/path" element={<PathPage />} />
        <Route path="/modules/:id" element={<ModulePage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/mastery" element={<MasteryPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          }
        >
          <Route index element={<AdminStats />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="modules" element={<AdminModules />} />
          <Route path="questions" element={<AdminQuestions />} />
          <Route path="cases" element={<AdminCases />} />
          <Route path="prompts" element={<AdminPrompts />} />
          <Route path="provider" element={<AdminProvider />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
