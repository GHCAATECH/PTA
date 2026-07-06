import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  GraduationCap,
  ReceiptText,
  Printer,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../features/auth/auth-context";
import { useDashboardDetails, useDashboardStats } from "../hooks/use-data";
import {
  demoPayments,
  demoStats,
  demoStudents,
  demoYears,
  monthlyData as demoMonthly,
} from "../lib/demo-data";
import { isDemoMode } from "../lib/supabase";
import { money, shortDate } from "../lib/utils";
import type { DashboardStats, Payment } from "../types";
import { printReceipt } from "../lib/print-receipt";

const tones: Record<string, string> = {
  indigo:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300",
  emerald:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
};
const emptyStats: DashboardStats = {
  total_students: 0,
  total_expected: 0,
  total_collected: 0,
  outstanding: 0,
  total_debt: 0,
  fully_paid: 0,
  owing: 0,
  today_collected: 0,
};

export default function Dashboard() {
  const { profile } = useAuth(),
    statsQuery = useDashboardStats(),
    detailsQuery = useDashboardDetails();
  const loading =
    !isDemoMode && (statsQuery.isLoading || detailsQuery.isLoading);
  if (loading) return <DashboardSkeleton />;
  const stats = isDemoMode ? demoStats : (statsQuery.data ?? emptyStats),
    details = detailsQuery.data,
    year = isDemoMode
      ? demoYears[0].year
      : (details?.year.year ?? "Active academic year");
  const payments = (
    isDemoMode
      ? demoPayments
      : (details?.payments ?? []).map((p: any) => ({
          ...p,
          amount_paid: Number(p.amount_paid),
          total_paid: Number(p.total_paid),
          outstanding_balance: Number(p.outstanding_balance),
        }))
  ) as Payment[];
  const states = isDemoMode
    ? demoStudents.map((s) => ({
        class_name: s.class_name,
        payment_status: s.payment_status,
      }))
    : (details?.students ?? []);
  const recent = [...payments]
    .sort(
      (a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime(),
    )
    .slice(0, 5);
  const monthly = isDemoMode ? demoMonthly : buildMonthly(payments),
    classes = buildClasses(payments),
    statusData = [
      {
        name: "Paid",
        value: states.filter((s) => s.payment_status === "PAID").length,
        color: "#4f46e5",
      },
      {
        name: "Part paid",
        value: states.filter((s) => s.payment_status === "PARTIALLY PAID")
          .length,
        color: "#38bdf8",
      },
      {
        name: "Unpaid",
        value: states.filter((s) => s.payment_status === "UNPAID").length,
        color: "#f59e0b",
      },
    ];
  const rate = stats.total_expected
      ? Math.round((stats.total_collected / stats.total_expected) * 100)
      : 0,
    firstName = profile?.full_name?.split(" ")[0] ?? "Administrator";
  const metrics = [
    {
      label: "Total students",
      value: stats.total_students,
      detail: `${year} session`,
      icon: GraduationCap,
      tone: "indigo",
    },
    {
      label: "Expected fees",
      value: money(stats.total_expected),
      detail: "Configured PTA fees",
      icon: CircleDollarSign,
      tone: "blue",
    },
    {
      label: "Total collected",
      value: money(stats.total_collected),
      detail: `${rate}% collection rate`,
      icon: Banknote,
      tone: "emerald",
    },
    {
      label: "Outstanding",
      value: money(stats.outstanding),
      detail: "Unpaid balance from previous semesters",
      icon: WalletCards,
      tone: "amber",
    },
    {
      label: "Total debt",
      value: money(stats.total_debt),
      detail: "Active expected fees plus previous outstanding",
      icon: ReceiptText,
      tone: "rose",
    },
    {
      label: "Fully paid",
      value: stats.fully_paid,
      detail: "Students with zero balance",
      icon: CheckCircle2,
      tone: "teal",
    },
    {
      label: "Students owing",
      value: stats.owing,
      detail: "Needs follow-up",
      icon: UsersRound,
      tone: "rose",
    },
  ];
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-500 p-5 text-white shadow-xl shadow-indigo-500/15 sm:p-7">
        <div className="subtle-grid absolute inset-0 opacity-30" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="mb-3 bg-white/15 text-white">
              <CalendarDays size={12} /> Active year · {year}
            </Badge>
            <h2 className="max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">
              Good morning, {firstName}.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-indigo-100">
              Today’s collections are{" "}
              <strong className="text-white">
                {money(stats.today_collected)}
              </strong>
              . Your current collection rate is {rate}%.
            </p>
          </div>
          <Link
            to="/payments/new"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5"
          >
            Record a payment <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone]}`}
              >
                <Icon size={19} />
              </div>
              {tone === "rose" ? (
                <ArrowDownRight size={16} className="text-rose-500" />
              ) : (
                <ArrowUpRight size={16} className="text-emerald-500" />
              )}
            </div>
            <p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="mt-1 truncate text-xl font-extrabold tracking-tight">
              {value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
          </Card>
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.45fr_.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Collection trend</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Actual monthly payments for {year}
              </p>
            </div>
            <Badge>
              <TrendingUp size={13} />
              {payments.length} receipts
            </Badge>
          </CardHeader>
          <CardContent className="h-72">
            {monthly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthly}
                  margin={{ top: 16, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="amount" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#6366f1"
                        stopOpacity={0.35}
                      />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#94a3b8"
                    opacity={0.18}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    fill="url(#amount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Payment status</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                All students in {year}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mx-auto h-44 max-w-xs">
              {states.length ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={4}
                      strokeWidth={0}
                    >
                      {statusData.map((x) => (
                        <Cell key={x.name} fill={x.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {statusData.map((x) => (
                <div key={x.name} className="text-center">
                  <div
                    className="mx-auto mb-1 h-2 w-2 rounded-full"
                    style={{ background: x.color }}
                  />
                  <p className="text-[11px] text-slate-500">{x.name}</p>
                  <p className="text-sm font-extrabold">{x.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent payments</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Latest receipts captured by your team
              </p>
            </div>
            <Link className="text-xs font-bold text-indigo-600" to="/payments">
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {recent.length ? (
              <div className="divide-y divide-slate-100 dark:divide-white/7">
                {recent.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                      <ReceiptText size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {p.student_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {p.receipt_number} · {p.class_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold">
                        {money(p.amount_paid)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {shortDate(p.payment_date)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Print receipt"
                      onClick={() => printReceipt(p)}
                    >
                      <Printer size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-14 text-center text-sm text-slate-500">
                No payments recorded for this academic year.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Collections by class</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Actual receipts grouped by class
              </p>
            </div>
          </CardHeader>
          <CardContent className="h-[285px]">
            {classes.length ? (
              <ResponsiveContainer>
                <BarChart data={classes} margin={{ left: -25 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="#94a3b8"
                    opacity={0.16}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Bar dataKey="amount" fill="#6366f1" radius={[7, 7, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
function buildMonthly(payments: Payment[]) {
  const map = new Map<
    string,
    { month: string; amount: number; time: number }
  >();
  for (const p of payments) {
    const d = new Date(p.payment_date),
      key = `${d.getFullYear()}-${d.getMonth()}`,
      old = map.get(key);
    map.set(key, {
      month: d.toLocaleDateString("en-GH", { month: "short" }),
      amount: (old?.amount ?? 0) + Number(p.amount_paid),
      time: d.getFullYear() * 12 + d.getMonth(),
    });
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}
function buildClasses(payments: Payment[]) {
  const map = new Map<string, number>();
  for (const p of payments)
    map.set(p.class_name, (map.get(p.class_name) ?? 0) + Number(p.amount_paid));
  return [...map]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}
function ChartEmpty() {
  return (
    <div className="grid h-full place-items-center text-center text-xs text-slate-500">
      No live data available yet.
    </div>
  );
}
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-40 animate-pulse rounded-2xl bg-indigo-100 dark:bg-indigo-500/10" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card
            key={i}
            className="h-40 animate-pulse bg-slate-100 dark:bg-white/[.04]"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="h-80 animate-pulse bg-slate-100 dark:bg-white/[.04]" />
        <Card className="h-80 animate-pulse bg-slate-100 dark:bg-white/[.04]" />
      </div>
    </div>
  );
}
