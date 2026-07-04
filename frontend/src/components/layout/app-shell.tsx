import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Archive,
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
  { label: "Archived students", icon: Archive, to: "/students/archived" },
  { label: "Record payment", icon: WalletCards, to: "/payments/new" },
  { label: "Payments", icon: ReceiptText, to: "/payments" },
  { label: "Reports", icon: BarChart3, to: "/reports" },
  { label: "Academic setup", icon: BookOpen, to: "/setup", admin: true },
  { label: "Users", icon: Users, to: "/users", admin: true },
  { label: "Settings", icon: Settings, to: "/settings", admin: true },
];
const titles: Record<string, [string, string]> = {
  "/dashboard": ["Dashboard", "Here’s how PTA collections are performing."],
  "/students": ["Students", "Manage active student records and progression by class family."],
  "/students/archived": ["Archived students", "View completed students who can still log in and clear balances."],
  "/payments/new": ["Record payment", "Capture a payment already received from a parent."],
  "/payments": ["Payments", "Search receipts and review collection history."],
  "/reports": ["Reports", "Analyse, filter, and export collection records."],
  "/setup": ["Academic setup", "Manage semesters, class families, and PTA fee amounts."],
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
            <p className="truncate text-sm font-extrabold">{settings.data?.pta_name ?? "School PTA"}</p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">Collection Manager</p>
          </div>
        )}
        <button onClick={() => setMobileOpen(false)} className="ml-auto grid h-10 w-10 place-items-center rounded-xl lg:hidden" aria-label="Close menu">
          <X size={19} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.filter((i) => !i.admin || profile?.role === "administrator").map(({ label, icon: Icon, to }) => (
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
      <div className="border-t border-slate-200/70 p-3 dark:border-white/8">
        <div className={cn("flex items-center gap-3 rounded-xl bg-slate-50 p-2 dark:bg-white/5", collapsed && "justify-center")}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {initials(profile?.full_name ?? "User")}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{profile?.full_name}</p>
              <p className="truncate text-[11px] capitalize text-slate-500">{profile?.role}</p>
            </div>
          )}
        </div>
        <Button variant="ghost" className={cn("mt-2 w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10", collapsed && "px-0")} onClick={logout} title="Logout">
          <LogOut size={17} />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#090d18]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200/70 bg-white/90 backdrop-blur-xl transition-[width] lg:flex dark:border-white/8 dark:bg-slate-950/85", collapsed ? "w-[76px]" : "w-[244px]")}>
        {sidebar}
        <button onClick={() => setCollapsed((v) => !v)} className="absolute -right-3 top-24 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-white/10 dark:bg-slate-800" aria-label="Toggle sidebar">
          <ChevronLeft size={14} className={cn("transition", collapsed && "rotate-180")} />
        </button>
      </aside>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[90vw] max-w-[270px] flex-col bg-white dark:bg-slate-950 lg:hidden">{sidebar}</aside>
        </>
      )}
      <div className={cn("transition-all", collapsed ? "lg:pl-[76px]" : "lg:pl-[244px]")}>
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/78 backdrop-blur-xl dark:border-white/8 dark:bg-slate-950/78">
          <div className="flex min-h-[76px] items-center gap-4 px-4 sm:px-6">
            <button onClick={() => setMobileOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 lg:hidden dark:border-white/8" aria-label="Open menu">
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-2xl font-extrabold tracking-tight">{title}</p>
              <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            <label className="relative hidden max-w-xs flex-1 xl:block">
              <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
              <input className="field pl-9" placeholder="Search overview and records" />
            </label>
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-slate-900/80" aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main className="px-4 py-5 sm:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
