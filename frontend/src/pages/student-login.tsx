import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  School,
} from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/auth-context";
import { useSettings } from "../hooks/use-data";

export default function StudentLogin() {
  const { studentAccount, profile, signInStudent } = useAuth();
  const settings = useSettings();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const brandName = settings.data?.pta_name?.trim() || "School PTA";

  if (studentAccount) return <Navigate to="/student" replace />;
  if (profile) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[.95fr_1.05fr] dark:bg-slate-950">
      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 inline-flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
              <School />
            </div>
            <div>
              <p className="font-extrabold">{brandName}</p>
              <p className="text-xs text-slate-500">Student Portal</p>
            </div>
          </Link>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
            <GraduationCap size={27} />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight">
            Student sign in
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use your Student ID and the portal password issued by the school
            administrator.
          </p>
          <form
            className="mt-7 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const d = new FormData(e.currentTarget);
              try {
                await signInStudent(
                  String(d.get("student_id")),
                  String(d.get("password")),
                );
                nav("/student");
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Unable to sign in",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              <span className="label">Student ID</span>
              <input
                className="field font-mono uppercase"
                name="student_id"
                required
                autoComplete="username"
                placeholder="APS/26/001"
              />
            </label>
            <label>
              <span className="label">Password</span>
              <div className="relative">
                <input
                  className="field pr-12"
                  type={show ? "text" : "password"}
                  name="password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-1 top-0 grid h-11 w-11 place-items-center text-slate-400"
                  aria-label="Toggle password visibility"
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <Button className="w-full" disabled={busy}>
              {busy ? (
                "Signing in…"
              ) : (
                <>
                  Open my portal <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <LockKeyhole size={14} /> Contact the school office if you forgot
            your password.
          </p>
          <p className="mt-8 text-center text-xs text-slate-500">
            Staff member?{" "}
            <Link to="/login" className="font-bold text-indigo-600">
              Staff sign in
            </Link>
          </p>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-500 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="subtle-grid absolute inset-0 opacity-30" />
        <div className="relative max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-indigo-200">
            Your PTA account
          </p>
          <h2 className="mt-5 text-4xl font-extrabold leading-tight">
            Receipts, balances, and payment history—in one calm place.
          </h2>
          <p className="mt-5 max-w-lg leading-7 text-indigo-100">
            See exactly what has been paid, what remains, and download official
            receipts whenever you need them.
          </p>
        </div>
      </section>
    </div>
  );
}
