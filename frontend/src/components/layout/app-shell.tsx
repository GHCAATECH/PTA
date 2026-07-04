import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  School,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { useAuth } from "../../features/auth/auth-context";
import { cn, initials } from "../../lib/utils";
import { useSettings } from "../../hooks/use-data";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Students", icon: GraduationCap, to: "/students" },
  { label: "Record payment", icon: WalletCards, to: "/payments/new" },
  { label: "Payments", icon: ReceiptText, to: "/payments" },
  { label: "Reports", icon: BarChart3, to: "/reports" },
  { label: "Academic setup", icon: BookOpen, to: "/setup", admin: true },
  { label: "Users", icon: Users, to: "/users", admin: true },
  { label: "Settings", icon: Settings, to: "/settings", admin: true },
];
const titles: Record<string, [string, string]> = {
  "/dashboard": ["Dashboard", "Hereâ€™s how PTA collections are performing."],
  "/students": ["Students", "Manage student records and payment standing."],
  "/payments/new": [
    "Record payment",
    "Capture a payment already received from a parent.",
  ],
  "/payments": ["Payments", "Search receipts and review collection history."],
  "/reports": ["Reports", "Analyse, filter, and export collection records."],
  "/setup": ["Academic setup", "Manage years, classes, and PTA fee amounts."],
  "/users": ["User management", "Control staff access and roles."],
  "/settings": ["School settings", "Receipt branding and school information."],
};

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const { profile, signOut } = useAuth(),
    { theme, setTheme } = useTheme(),
    location = useLocation(),
    navigate = useNavigate(),
    settings = useSettings();
  const [title, subtitle] = titles[location.pathname] ?? [
    "PTA Manager",
    "School fee collection workspace",
  ];
  const logout = async () => {
    setMobileOpen(false);
    await signOut();
  };
  const sidebar = (
    <>
      <div className="flex h-[76px] items-center gap-3 border-b border-slate-200/70 px-4 dark:border-white/8">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
          <School size={21} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">
              {settings.data?.pta_name ?? "School PTA"}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Collection Manager
            </p>
          </div>
        )}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto grid h-10 w-10 place-items-center rounded-xl lg:hidden"
          aria-label="Close menu"
        >
          <X size={19} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation
          .filter((i) => !i.admin || profile?.role === "administrator")
          .map(({ label, icon: Icon, to }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/7 dark:hover:text-white",
                  collapsed && "justify-center px-2",
                )
              }
            >
              <Icon size={19} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
      </nav>
      <div className="border-t border-slate-200/70 p-3 dark:border-white/8">`r`n        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-white/5",
            collapsed && "justify-center",
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {initials(profile?.full_name ?? "User")}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{profile?.full_name}</p>
              <p className="truncate text-[11px] capitalize text-slate-500">
                {profile?.role}
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className={cn(
            "mt-2 w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10",
            collapsed && "px-0",
          )}
          onClick={logout}
          title="Logout"
        >
          <LogOut size={17} />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#090d18]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200/70 bg-white/90 backdrop-blur-xl transition-[width] lg:flex dark:border-white/8 dark:bg-slate-950/85",
          collapsed ? "w-[76px]" : "w-[244px]",
        )}
      >
        {sidebar}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-24 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-800"
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            size={14}
            className={cn("transition", collapsed && "rotate-180")}
          />
        </button>
      </aside>
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(290px,88vw)] flex-col bg-white shadow-2xl lg:hidden dark:bg-slate-950">
            {sidebar}
          </aside>
        </>
      )}
      <div
        className={cn(
          "min-w-0 transition-[padding]",
          collapsed ? "lg:pl-[76px]" : "lg:pl-[244px]",
        )}
      >
        <header className="sticky top-0 z-30 flex min-h-[76px] items-center gap-3 border-b border-slate-200/70 bg-[#f7f8fc]/85 px-4 backdrop-blur-xl sm:px-6 dark:border-white/8 dark:bg-[#090d18]/85">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white lg:hidden dark:border-white/10 dark:bg-slate-900"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-extrabold tracking-tight sm:text-xl">
              {title}
            </h1>
            <p className="hidden truncate text-xs text-slate-500 sm:block dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/students")}
            className="hidden h-11 max-w-xs items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 md:flex dark:border-white/10 dark:bg-slate-900"
          >
            <Search size={17} />
            <span className="text-xs">Search students</span>
          </button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <div className="hidden h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 sm:flex dark:border-white/10 dark:bg-slate-900">
            <UserRound size={17} className="text-indigo-600" />
            <span className="max-w-24 truncate text-xs font-semibold">
              {profile?.full_name?.split(" ")[0]}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={logout}
            aria-label="Logout"
            title="Logout"
          >
            <LogOut size={18} />
          </Button>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
