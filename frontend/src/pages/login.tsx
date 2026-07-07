import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  School,
  ShieldCheck,
} from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/auth-context";
import { useSettings } from "../hooks/use-data";

export default function Login() {
  const { profile, studentAccount, signIn } = useAuth();
  const settings = useSettings();
  const nav = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const brandName = settings.data?.pta_name?.trim() || "School PTA";

  if (profile) return <Navigate to="/" replace />;
  if (studentAccount) return <Navigate to="/student" replace />;

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_.95fr] dark:bg-slate-950">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="subtle-grid absolute inset-0 opacity-30" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <School />
          </div>
          <div>
            <p className="font-extrabold">{brandName}</p>
            <p className="text-xs text-indigo-100">Collection Manager</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Every payment accounted for. Every receipt within reach.
          </h1>
          <p className="mt-5 max-w-lg leading-7 text-indigo-100">
            A secure workspace for your school team to record PTA payments,
            monitor balances, and prepare reliable reports.
          </p>
        </div>
        <p className="relative text-xs text-indigo-200">
          Secure access | Database-enforced permissions | Complete audit trail
        </p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-600 text-white">
              <School />
            </div>
            <div>
              <p className="font-extrabold">{brandName}</p>
              <p className="text-xs text-slate-500">Collection Manager</p>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">
            Staff portal
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Sign in with your administrator or accountant account.
          </p>
          <form
            className="mt-7 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const d = new FormData(e.currentTarget);
              try {
                await signIn(String(d.get("email")), String(d.get("password")));
                nav((location.state as { from?: string })?.from ?? "/");
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Unable to sign in",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              <span className="label">Email address</span>
              <input
                className="field"
                type="email"
                name="email"

                required
                autoComplete="email"
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
                "Signing in..."
              ) : (
                <>
                  Sign in securely <ArrowRight size={17} />
                </>
              )}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            or
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/student-login">
              <GraduationCap size={17} /> Go to student portal
            </Link>
          </Button>
          <p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500">
            <LockKeyhole size={13} /> Protected by Supabase Authentication
          </p>
        </div>
      </section>
    </div>
  );
}
