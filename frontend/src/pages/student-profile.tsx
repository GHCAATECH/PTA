import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Printer,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { useAuth } from "../features/auth/auth-context";
import { useClasses } from "../hooks/use-data";
import { adminUsers } from "../lib/admin-users";
import { supabase } from "../lib/supabase";
import { printReceipt } from "../lib/print-receipt";
import { money, shortDate } from "../lib/utils";
import type { Payment, Student } from "../types";

async function loadStudent(id: string) {
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
    { data: account },
  ] = await Promise.all([
    supabase.from("students").select("*, classes(name)").eq("id", id).single(),
    supabase
      .from("student_fee_summary")
      .select("*")
      .eq("student_id", id)
      .eq("academic_year_id", year.id)
      .single(),
    supabase
      .from("payment_receipts")
      .select("*")
      .eq("student_id", id)
      .order("payment_date", { ascending: false }),
    supabase
      .from("pta_fees")
      .select("amount")
      .eq("academic_year_id", year.id)
      .single(),
    supabase
      .from("student_accounts")
      .select("user_id,created_at")
      .eq("student_id", id)
      .maybeSingle(),
  ]);
  if (studentError) throw studentError;
  if (summaryError) throw summaryError;
  if (paymentsError) throw paymentsError;
  if (feeError) throw feeError;
  return {
    year,
    student,
    summary,
    payments: (payments ?? []) as Payment[],
    fee,
    account,
  };
}
export default function StudentProfile() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [credentialsOpen, setCredentialsOpen] = useState(false),
    [editOpen, setEditOpen] = useState(false);
  const classes = useClasses();
  const queryClient = useQueryClient();
  const portal = useQuery({
    queryKey: ["student-profile", id],
    queryFn: () => loadStudent(id!),
    enabled: Boolean(id),
  });
  const credentials = useMutation({
    mutationFn: (password: string) =>
      adminUsers.setStudentCredentials(id!, password),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["student-profile", id] });
      setCredentialsOpen(false);
      toast.success(
        result.created
          ? "Student portal account created"
          : "Student portal password reset",
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const updateStudent = useMutation({
    mutationFn: async (values: Partial<Student>) => {
      const { error } = await supabase
        .from("students")
        .update(values)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setEditOpen(false);
      toast.success("Student record updated");
    },
    onError: (error) => toast.error(error.message),
  });
  if (portal.isLoading)
    return (
      <div className="grid min-h-[55vh] place-items-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  if (portal.isError || !portal.data)
    return (
      <Card className="p-8 text-center">
        <p className="font-bold">Student record unavailable</p>
        <p className="mt-2 text-sm text-slate-500">
          Return to the student list and try again.
        </p>
      </Card>
    );
  const { student: s, summary, payments, account } = portal.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/students"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft size={16} /> All students
        </Link>
        <div className="flex flex-wrap gap-2">
          {profile?.role === "administrator" && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil size={17} /> Edit student
              </Button>
              <Button
                variant="outline"
                onClick={() => setCredentialsOpen(true)}
              >
                <KeyRound size={17} />{" "}
                {account ? "Reset portal password" : "Create portal login"}
              </Button>
            </>
          )}
          <Button asChild>
            <Link to={`/payments/new?student=${s.id}`}>
              <WalletCards size={17} /> Record payment
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <Card>
          <CardContent className="pt-7">
            <div className="text-center">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-indigo-100 to-blue-100 text-2xl font-extrabold text-indigo-700 dark:from-indigo-500/20 dark:to-blue-500/20">
                {s.first_name[0]}
                {s.last_name[0]}
              </div>
              <h2 className="mt-4 text-xl font-extrabold">
                {s.first_name} {s.last_name}
              </h2>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {s.admission_number}
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Badge
                  className={
                    s.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }
                >
                  {s.status === "active"
                    ? "Active student"
                    : "Inactive student"}
                </Badge>
                {account && (
                  <Badge className="bg-indigo-50 text-indigo-700">
                    <ShieldCheck size={12} /> Portal enabled
                  </Badge>
                )}
              </div>
            </div>
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-5 text-sm dark:border-white/8">
              <Info
                icon={UserRound}
                label="Class"
                value={s.classes?.name ?? "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}
              />
              <Info
                icon={Phone}
                label="Parent"
                value={`${s.parent_name} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${s.parent_phone}`}
              />
              <Info icon={MapPin} label="Address" value={s.address ?? "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"} />
            </div>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary
              label="PTA fee"
              value={money(Number((summary as any).fee_amount ?? 0))}
            />
            <Summary
              label="Total paid"
              value={money(Number(summary.total_paid))}
              green
            />
            <Summary
              label="Balance"
              value={money(Number(summary.outstanding_balance))}
              amber
            />
          </div>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Payment history</CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  All receipts recorded for this student across academic years.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {payments.length ? (
                <div className="divide-y divide-slate-100 dark:divide-white/7">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-5 py-4 sm:px-6"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                        <ReceiptText size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{money(p.amount_paid)}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {p.receipt_number} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {p.academic_year} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â·{" "}
                          {shortDate(p.payment_date)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printReceipt(p)}
                      >
                        <Printer size={14} />{" "}
                        <span className="hidden sm:inline">Receipt</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-slate-500">
                  No payments recorded yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <CredentialsModal
        open={credentialsOpen}
        onOpenChange={setCredentialsOpen}
        studentId={s.admission_number}
        existing={Boolean(account)}
        busy={credentials.isPending}
        onSave={(password) => credentials.mutate(password)}
      />
      <EditStudentModal
        open={editOpen}
        onOpenChange={setEditOpen}
        student={s}
        classes={classes.data ?? []}
        busy={updateStudent.isPending}
        onSave={(values) => updateStudent.mutate(values)}
      />
    </div>
  );
}
function EditStudentModal({
  open,
  onOpenChange,
  student,
  classes,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: any;
  classes: Array<{ id: string; name: string }>;
  busy: boolean;
  onSave: (v: Partial<Student>) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Edit student record">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          onSave({
            first_name: String(d.get("first_name")).trim(),
            last_name: String(d.get("last_name")).trim(),
            class_id: String(d.get("class_id")),
            parent_name: String(d.get("parent_name")).trim(),
            parent_phone: String(d.get("parent_phone")).trim(),
            address: String(d.get("address")).trim(),
            status: String(d.get("status")) as Student["status"],
          });
        }}
      >
        <label>
          <span className="label">First name</span>
          <input
            name="first_name"
            required
            className="field"
            defaultValue={student.first_name}
          />
        </label>
        <label>
          <span className="label">Last name</span>
          <input
            name="last_name"
            required
            className="field"
            defaultValue={student.last_name}
          />
        </label>
        <label>
          <span className="label">Class</span>
          <select
            name="class_id"
            className="field"
            defaultValue={student.class_id}
          >
            {classes.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Status</span>
          <select name="status" className="field" defaultValue={student.status}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span className="label">Parent name</span>
          <input
            name="parent_name"
            required
            className="field"
            defaultValue={student.parent_name}
          />
        </label>
        <label>
          <span className="label">Parent phone</span>
          <input
            name="parent_phone"
            required
            className="field"
            defaultValue={student.parent_phone}
          />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Address</span>
          <textarea
            name="address"
            className="field min-h-20 py-3"
            defaultValue={student.address ?? ""}
          />
        </label>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Save
            student
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function CredentialsModal({
  open,
  onOpenChange,
  studentId,
  existing,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  existing: boolean;
  busy: boolean;
  onSave: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setPassword("");
      }}
      title={
        existing
          ? "Reset student portal password"
          : "Create student portal login"
      }
      description={`Student ID: ${studentId}`}
    >
      <div className="space-y-4">
        <label>
          <span className="label">
            {existing ? "New password" : "Portal password"}
          </span>
          <div className="relative">
            <KeyRound
              className="absolute left-3 top-3.5 text-slate-400"
              size={16}
            />
            <input
              className="field pl-10"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>
        </label>
        <div className="rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
          Give the student their <strong>Student ID</strong> and this password.
          Their hidden authentication email is never shown or needed.
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy || password.length < 8}
            onClick={() => onSave(password)}
          >
            {busy && <Loader2 className="animate-spin" size={16} />}{" "}
            {existing ? "Reset password" : "Create login"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
const Info = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) => (
  <div className="flex items-start gap-3">
    <Icon className="mt-0.5 text-slate-400" size={17} />
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  </div>
);
const Summary = ({
  label,
  value,
  green,
  amber,
}: {
  label: string;
  value: string;
  green?: boolean;
  amber?: boolean;
}) => (
  <Card className="p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p
      className={`mt-1 text-xl font-extrabold ${green ? "text-emerald-600" : amber ? "text-amber-600" : ""}`}
    >
      {value}
    </p>
  </Card>
);
