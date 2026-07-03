import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/app-shell";
import { useAuth } from "./features/auth/auth-context";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Students from "./pages/students";
import StudentProfile from "./pages/student-profile";
import RecordPayment from "./pages/record-payment";
import Payments from "./pages/payments";
import Reports from "./pages/reports";
import Setup from "./pages/setup";
import UsersPage from "./pages/users";
import { SettingsPage } from "./pages/simple-pages";
import StudentLogin from "./pages/student-login";
import StudentPortal from "./pages/student-portal";
const Loader = () => (
  <div className="grid min-h-[50vh] place-items-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
  </div>
);
function PublicHome() {
  const { profile, studentAccount, loading } = useAuth();
  if (loading) return <Loader />;
  if (profile) return <Navigate to="/dashboard" replace />;
  if (studentAccount) return <Navigate to="/student" replace />;
  return <StudentLogin />;
}
function Protected() {
  const { profile, studentAccount, loading, demo } = useAuth();
  if (loading) return <Loader />;
  if (studentAccount) return <Navigate to="/student" replace />;
  if (!profile && !demo) return <Navigate to="/staff-login" replace />;
  return <AppShell />;
}
function StudentProtected() {
  const { profile, studentAccount, loading } = useAuth();
  if (loading) return <Loader />;
  if (profile) return <Navigate to="/dashboard" replace />;
  if (!studentAccount) return <Navigate to="/" replace />;
  return <StudentPortal />;
}
function AdminOnly({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  return profile?.role === "administrator" ? (
    children
  ) : (
    <Navigate to="/dashboard" replace />
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/student-login" element={<Navigate to="/" replace />} />
      <Route path="/staff-login" element={<Login />} />
      <Route path="/login" element={<Navigate to="/staff-login" replace />} />
      <Route path="/student" element={<StudentProtected />} />
      <Route element={<Protected />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="payments/new" element={<RecordPayment />} />
        <Route path="payments" element={<Payments />} />
        <Route path="reports" element={<Reports />} />
        <Route
          path="setup"
          element={
            <AdminOnly>
              <Setup />
            </AdminOnly>
          }
        />
        <Route
          path="users"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="settings"
          element={
            <AdminOnly>
              <SettingsPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
