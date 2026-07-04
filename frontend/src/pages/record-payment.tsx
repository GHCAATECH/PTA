import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Printer,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useAuth } from "../features/auth/auth-context";
import {
  useActiveYear,
  useCreatePayment,
  useStudents,
} from "../hooks/use-data";
import { generateReceipt } from "../lib/receipt";
import { api } from "../lib/api";
import { money } from "../lib/utils";
import type { Payment, Student } from "../types";

export default function RecordPayment() {
  const [params] = useSearchParams();
  const { profile } = useAuth(),
    students = useStudents(),
    year = useActiveYear(),
    create = useCreatePayment();
  const [student, setStudent] = useState<Student | null>(null),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [method, setMethod] = useState("cash"),
    [remarks, setRemarks] = useState(""),
    [override, setOverride] = useState(false),
    [saved, setSaved] = useState<Payment | null>(null),
    [printing, setPrinting] = useState(false);
  useEffect(() => {
    const id = params.get("student");
    if (id && students.data && !student)
      setStudent(students.data.find((s) => s.id === id) ?? null);
  }, [params, students.data, student]);
  const numeric = Number(amount) || 0,
    over = Boolean(student && numeric > student.balance),
    invalid =
      !student ||
      numeric <= 0 ||
      (over && (!override || profile?.role !== "administrator"));
  const submit = async () => {
    if (!student || !year.data) return;
    try {
      const p = await create.mutateAsync({
        student_id: student.id,
        academic_year_id: year.data.id,
        amount: numeric,
        date,
        method,
        remarks,
        override,
      });
      const created = Array.isArray(p) ? p[0] : p;
      const receipt: Payment = await api.payment(created.id).catch(() => ({
        ...created,
        student_name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number,
        class_name: student.class_name,
        academic_year: year.data.year,
        received_by_name: profile?.full_name ?? "",
        amount_paid: Number(created.amount_paid),
        total_paid: student.total_paid + numeric,
        outstanding_balance: Math.max(0, student.balance - numeric),
      }));
      void api.notifyPaymentSms(created.id)
        .then((result) => {
          if (result.skipped) {
            if (result.reason === "sms_disabled") return;
            toast.message(`SMS not sent: ${result.reason ?? "skipped"}`);
            return;
          }
          toast.success("Parent SMS alert sent");
        })
        .catch((error) =>
          toast.error(
            error instanceof Error
              ? `Payment saved, but SMS failed: ${error.message}`
              : "Payment saved, but SMS failed",
          ),
        );
      setSaved(receipt);
      toast.success("Payment recorded successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment could not be recorded",
      );
    }
  };
  if (students.isLoading || year.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  if (saved)
    return (
      <Card className="mx-auto max-w-xl overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-center text-white">
          <CheckCircle2 className="mx-auto" size={46} />
          <h2 className="mt-4 text-2xl font-extrabold">Payment recorded</h2>
          <p className="mt-1 text-sm text-emerald-50">
            Receipt {saved.receipt_number} was generated successfully.
          </p>
        </div>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <Line label="Student" value={saved.student_name} />
            <Line label="Amount received" value={money(saved.amount_paid)} />
            <Line
              label="New balance"
              value={money(saved.outstanding_balance)}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={printing}
              onClick={async () => {
                setPrinting(true);
                try {
                  await generateReceipt(saved);
                  toast.success("Receipt PDF downloaded");
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not generate receipt",
                  );
                } finally {
                  setPrinting(false);
                }
              }}
            >
              {printing ? (
                <Loader2 className="animate-spin" size={17} />
              ) : (
                <Printer size={17} />
              )}{" "}
              {printing ? "Preparing receipt…" : "Print receipt"}
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => {
                setSaved(null);
                setStudent(null);
                setAmount("");
                setRemarks("");
                setOverride(false);
              }}
            >
              Record another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        to="/payments"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
      >
        <ArrowLeft size={16} /> Payment history
      </Link>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Payment details</CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                Record money already received for {year.data?.year}. Balances include unpaid fees carried forward from earlier academic years.
              </p>
            </div>
            <WalletCards className="text-indigo-600" />
          </CardHeader>
          <CardContent className="space-y-5">
            <label>
              <span className="label">Select student</span>
              <select
                className="field"
                value={student?.id ?? ""}
                onChange={(e) =>
                  setStudent(
                    (students.data ?? []).find(
                      (s) => s.id === e.target.value,
                    ) ?? null,
                  )
                }
              >
                <option value="">Choose a student…</option>
                {(students.data ?? []).map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.first_name} {s.last_name} · {s.admission_number} ·{" "}
                    {s.class_name}
                  </option>
                ))}
              </select>
              {!students.data?.length && (
                <p className="mt-2 text-xs text-amber-600">
                  No student records are available. Add a student first.
                </p>
              )}
            </label>
            {student && (
              <>
                <div className="grid gap-3 rounded-2xl bg-indigo-50/60 p-4 sm:grid-cols-3 dark:bg-indigo-500/5">
                  <Info
                    label="Cumulative PTA fees"
                    value={money(student.fee)}
                  />
                  <Info label="Total paid" value={money(student.total_paid)} />
                  <Info
                    label="Outstanding balance"
                    value={money(student.balance)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="label">Amount received (GHS)</span>
                    <input
                      className="field font-bold"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="label">Payment date</span>
                    <input
                      className="field"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="label">Payment method</span>
                    <select
                      className="field"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="mobile_money">Mobile money</option>
                      <option value="bank_deposit">Bank deposit</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    <span className="label">Academic year</span>
                    <input
                      className="field"
                      value={year.data?.year ?? ""}
                      disabled
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="label">Remarks</span>
                    <textarea
                      className="field min-h-20 py-3"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                  </label>
                </div>
                {over && (
                  <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertCircle size={19} />
                    <div>
                      <strong>Amount exceeds the outstanding balance.</strong>
                      {profile?.role === "administrator" ? (
                        <label className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={override}
                            onChange={(e) => setOverride(e.target.checked)}
                          />{" "}
                          Approve administrator override
                        </label>
                      ) : (
                        <p className="mt-1 text-xs">
                          Only an administrator can approve this payment.
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={invalid || create.isPending}
                  onClick={submit}
                >
                  {create.isPending ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <ShieldCheck size={18} />
                  )}{" "}
                  Save payment securely
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Payment summary</CardTitle>
          </CardHeader>
          <CardContent>
            {student ? (
              <div className="space-y-4">
                <p className="font-bold">
                  {student.first_name} {student.last_name}
                </p>
                <p className="text-xs text-slate-500">
                  {student.admission_number} · {student.class_name}
                </p>
                <div className="border-t pt-4 dark:border-white/8">
                  <Line label="Amount received" value={money(numeric)} />
                  <Line
                    label="Total after payment"
                    value={money(student.total_paid + numeric)}
                  />
                  <Line
                    label="New balance"
                    value={money(Math.max(0, student.balance - numeric))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500">
                Select a student to continue.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className="mt-1 font-extrabold">{value}</p>
  </div>
);
const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="mb-3 flex justify-between gap-3 text-sm">
    <span className="text-slate-500">{label}</span>
    <strong>{value}</strong>
  </div>
);
