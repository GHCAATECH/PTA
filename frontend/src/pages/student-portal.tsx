import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LogOut,
  Printer,
  ReceiptText,
  School,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useAuth } from "../features/auth/auth-context";
import { api } from "../lib/api";
import { printReceipt } from "../lib/print-receipt";
import { supabase } from "../lib/supabase";
import { money, shortDate } from "../lib/utils";
import type { Payment } from "../types";

async function loadPortal(studentId: string) {
  const { data: year, error: yearError } = await supabase
    .from("academic_years")
    .select("*")
    .eq("is_active", true)
    .single();
  if (yearError) throw yearError;

  const [
    { data: student, error: studentError },
    { data: summary, error: summaryError },
    { data: payments, error: paymentsError },
    { data: fee, error: feeError },
    { data: settings },
  ] = await Promise.all([
    supabase
      .from("students")
      .select("*, classes(name)")
      .eq("id", studentId)
      .single(),
    supabase
      .from("student_fee_summary")
      .select("*")
      .eq("student_id", studentId)
      .eq("academic_year_id", year.id)
      .single(),
    supabase
      .from("payment_receipts")
      .select("*")
      .eq("student_id", studentId)
      .order("payment_date", { ascending: false }),
    supabase
      .from("pta_fees")
      .select("amount")
      .eq("academic_year_id", year.id)
      .single(),
    supabase.from("school_settings").select("*").eq("id", true).maybeSingle(),
  ]);

  if (studentError) throw studentError;
  if (summaryError) throw summaryError;
  if (paymentsError) throw paymentsError;
  if (feeError) throw feeError;

  return { year, student, summary, payments: payments ?? [], settings, fee };
}

export default function StudentPortal() {
  const { studentAccount, signOut } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [payAmount, setPayAmount] = useState("");

  const openPayment = useMutation({
    mutationFn: api.onlinePaymentLink,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(error.message),
  });
  const verifyPayment = useMutation({
    mutationFn: api.verifyOnlinePayment,
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["student-portal", studentAccount?.student_id] });
      toast.success(`Payment confirmed. Receipt ${result.receipt_number} recorded.`);
      nav("/student", { replace: true });
    },
    onError: (error) => {
      toast.error(error.message);
      nav("/student", { replace: true });
    },
  });

  const portal = useQuery({
    queryKey: ["student-portal", studentAccount?.student_id],
    queryFn: () => loadPortal(studentAccount!.student_id),
    enabled: Boolean(studentAccount),
  });

  const callbackReference = useMemo(
    () => params.get("reference") ?? params.get("trxref"),
    [params],
  );

  useEffect(() => {
    if (
      callbackReference &&
      !verifyPayment.isPending &&
      !verifyPayment.isSuccess &&
      !verifyPayment.isError
    ) {
      verifyPayment.mutate(callbackReference);
    }
  }, [callbackReference, verifyPayment]);

  if (portal.isLoading || verifyPayment.isPending)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
          {verifyPayment.isPending ? (
            <p className="mt-4 text-sm text-slate-500">
              Confirming your payment and updating your dashboard...
            </p>
          ) : null}
        </div>
      </div>
    );

  if (portal.isError || !portal.data)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-5 dark:bg-slate-950">
        <Card className="max-w-md">
          <EmptyState
            title="Portal unavailable"
            message="We could not load your student record. Please contact the school office."
          />
        </Card>
      </div>
    );

  const { student, summary, payments, year, settings } = portal.data;
  const studentName = `${student.first_name} ${student.last_name}`;
  const balance = Number(summary.outstanding_balance);
  const hasOutstandingBalance = balance > 0;
  const numericPayAmount = Number(payAmount) || 0;
  const payInvalid =
    !hasOutstandingBalance ||
    !Number.isFinite(numericPayAmount) ||
    numericPayAmount <= 0 ||
    numericPayAmount > balance;

  return (
    <div className="min-h-screen bg-[#f7f8fc] dark:bg-[#090d18]">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/8 dark:bg-slate-950/85">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-600 text-white">
            <School size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">
              {settings?.school_name ?? "Apex International School"}
            </p>
            <p className="text-[11px] text-slate-500">Student PTA Portal</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut size={15} />{" "}
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-5 text-white shadow-xl shadow-indigo-500/15 sm:p-7">
          <div className="subtle-grid absolute inset-0 opacity-30" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-xl font-extrabold backdrop-blur">
              {student.first_name[0]}
              {student.last_name[0]}
            </div>
            <div className="flex-1">
              <Badge className="bg-white/15 text-white">
                <CalendarDays size={12} />
                {year.year}
              </Badge>
              <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
                Welcome, {student.first_name}.
              </h1>
              <p className="mt-1 text-sm text-indigo-100">
                {student.admission_number} Ãƒâ€šÃ‚Â· {student.classes?.name}
              </p>
            </div>
          </div>
        </section>

        <section
          className={`grid gap-4 ${
            settings?.online_payment_enabled && hasOutstandingBalance
              ? "sm:grid-cols-2 xl:grid-cols-4"
              : "sm:grid-cols-3"
          }`}
        >
          <Summary
            icon={WalletCards}
            label="PTA fee"
            value={money(Number((summary as any).fee_amount ?? 0))}
          />
          <Summary
            icon={CheckCircle2}
            label="Total paid"
            value={money(Number(summary.total_paid))}
            tone="emerald"
          />
          <Summary
            icon={ReceiptText}
            label="Outstanding balance"
            value={money(balance)}
            tone="amber"
          />
          {settings?.online_payment_enabled && hasOutstandingBalance ? (
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/15">
              <div className="flex h-full flex-col justify-between gap-4 p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-2 text-indigo-100">
                    <ShieldCheck size={16} />
                    <span className="text-xs font-bold uppercase tracking-[.18em]">
                      Online payment
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-extrabold">
                    Pay from your dashboard
                  </p>
                  <p className="mt-1 text-sm text-indigo-100">
                    Enter any amount up to your outstanding balance, pay online,
                    and return here automatically after success.
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-indigo-100">
                      Amount to pay (GHS)
                    </span>
                    <input
                      className="field border-white/20 bg-white/95 font-bold text-slate-900"
                      type="number"
                      min="0.01"
                      max={balance.toFixed(2)}
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder={balance.toFixed(2)}
                    />
                  </label>
                  <div className="flex items-center justify-between text-[11px] text-indigo-100">
                    <span>Max allowed</span>
                    <strong>{money(balance)}</strong>
                  </div>
                  <Button
                    variant="outline"
                    disabled={openPayment.isPending || payInvalid}
                    className="w-full border-white/20 bg-white text-indigo-700 hover:bg-indigo-50"
                    onClick={() => openPayment.mutate(numericPayAmount)}
                  >
                    {openPayment.isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Opening...
                      </>
                    ) : (
                      <>
                        Pay {numericPayAmount > 0 ? money(numericPayAmount) : "online"}{" "}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Student information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Info icon={UserRound} label="Student" value={studentName} />
              <Info
                icon={GraduationCap}
                label="Class"
                value={student.classes?.name ?? "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}
              />
              <Info
                icon={CalendarDays}
                label="Academic year"
                value={year.year}
              />
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <p className="text-xs text-slate-500">Payment status</p>
                <Badge
                  className={`mt-2 ${
                    summary.payment_status === "PAID"
                      ? "bg-emerald-50 text-emerald-700"
                      : summary.payment_status === "UNPAID"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {summary.payment_status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Payment and receipt history</CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  Confirmed payments are recorded here and in the admin payment
                  page automatically.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {payments.length ? (
                <div className="divide-y divide-slate-100 dark:divide-white/7">
                  {payments.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex items-center gap-3 px-5 py-4 sm:px-6"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                        <ReceiptText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold">
                          {money(Number(payment.amount_paid))}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {payment.receipt_number} Ãƒâ€šÃ‚Â·{" "}
                          {shortDate(payment.payment_date)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          printReceipt({
                            id: payment.id,
                            student_id: student.id,
                            student_name: studentName,
                            admission_number: student.admission_number,
                            class_name: student.classes?.name ?? "",
                            academic_year: payment.academic_year ?? year.year,
                            amount_paid: Number(payment.amount_paid),
                            payment_date: payment.payment_date,
                            receipt_number: payment.receipt_number,
                            remarks: payment.remarks ?? "",
                            received_by_name:
                              payment.received_by_name ?? "School cashier",
                            total_paid: Number(payment.total_paid ?? summary.total_paid),
                            outstanding_balance: Number(
                              payment.outstanding_balance ??
                                summary.outstanding_balance,
                            ),
                          } as Payment)
                        }
                      >
                        <Printer size={14} />{" "}
                        <span className="hidden sm:inline">Receipt</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No payments yet"
                  message="Payments recorded by the school or confirmed online will appear here."
                />
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  tone = "indigo",
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  tone?: "indigo" | "emerald" | "amber";
}) {
  const style = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10",
  };
  return (
    <Card className="flex items-center gap-4 p-4 sm:p-5">
      <div
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style[tone]}`}
      >
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-extrabold">{value}</p>
      </div>
    </Card>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 text-slate-400" size={17} />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}
