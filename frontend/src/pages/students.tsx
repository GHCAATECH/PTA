import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
  UserRound,
  Trash2,
} from "lucide-react";
import ExcelJS from "exceljs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { demoClasses, demoStudents } from "../lib/demo-data";
import { adminUsers } from "../lib/admin-users";
import { api } from "../lib/api";
import { isDemoMode, supabase } from "../lib/supabase";
import { money } from "../lib/utils";
import {
  useActiveYear,
  useClasses,
  useCreateStudent,
  useStudents,
} from "../hooks/use-data";
import type { PaymentStatus, SchoolClass, Student } from "../types";
import { useAuth } from "../features/auth/auth-context";

type StudentDraft = Omit<
  Student,
  "id" | "class_name" | "fee" | "total_paid" | "balance" | "payment_status"
>;
const statusStyle: Record<PaymentStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  UNPAID: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  "PARTIALLY PAID":
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
};

function StudentsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-end gap-2">
        <div className="h-11 w-28 animate-pulse rounded-xl bg-slate-200 dark:bg-white/8" />
        <div className="h-11 w-32 animate-pulse rounded-xl bg-indigo-100 dark:bg-indigo-500/10" />
      </div>
      <Card className="overflow-hidden">
        <div className="h-20 animate-pulse border-b border-slate-100 bg-slate-50 dark:border-white/8 dark:bg-white/[.03]" />
        <div className="space-y-1 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[.04]"
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
export default function Students() {
  const { profile } = useAuth();
  const [students, setStudents] = useState(isDemoMode ? demoStudents : []),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [classFilter, setClassFilter] = useState("ALL"),
    [open, setOpen] = useState(false),
    [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null),
    queryClient = useQueryClient();
  const { data: liveStudents, isLoading: studentsLoading } = useStudents(),
    { data: liveClasses } = useClasses(),
    { data: year } = useActiveYear();
  const createStudent = useCreateStudent();
  const deleteStudent = useMutation({
    mutationFn: adminUsers.deleteStudent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted");
    },
    onError: (error) => toast.error(error.message),
  });
  const confirmDelete = (student: Student) => {
    if (
      window.confirm(
        `Delete ${student.first_name} ${student.last_name}? This also removes their portal login.`,
      )
    )
      deleteStudent.mutate(student.id);
  };
  const classes = isDemoMode ? demoClasses : (liveClasses ?? []);
  useEffect(() => {
    if (liveStudents) setStudents(liveStudents);
  }, [liveStudents]);
  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          `${s.first_name} ${s.last_name} ${s.admission_number} ${s.parent_name}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "ALL" || s.payment_status === filter) &&
          (classFilter === "ALL" || s.class_id === classFilter),
      ),
    [students, search, filter, classFilter],
  );
  const addStudent = async (draft: StudentDraft, password: string) => {
    const selected = classes.find((c) => c.id === draft.class_id)!;
    if (isDemoMode) {
      setStudents((v) => [
        {
          ...draft,
          id: crypto.randomUUID(),
          class_name: selected.name,
          fee: 300,
          total_paid: 0,
          balance: 300,
          payment_status: "UNPAID",
        },
        ...v,
      ]);
      setOpen(false);
      toast.success("Student and portal password created");
      return;
    }
    let created: { id: string } | undefined;
    try {
      const newStudent = await createStudent.mutateAsync(draft);
      created = newStudent;
      await adminUsers.setStudentCredentials(newStudent.id, password);
      setOpen(false);
      toast.success("Student and portal login created");
    } catch (error) {
      if (created?.id)
        await supabase.from("students").delete().eq("id", created.id);
      toast.error(
        error instanceof Error ? error.message : "Could not create student",
      );
    }
  };
  const realExport = async () => {
    const wb = new ExcelJS.Workbook(),
      sheet = wb.addWorksheet("Students");
    sheet.columns = [
      { header: "Admission Number", key: "admission_number", width: 20 },
      { header: "First Name", key: "first_name", width: 18 },
      { header: "Last Name", key: "last_name", width: 18 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Class", key: "class_name", width: 16 },
      { header: "Parent Name", key: "parent_name", width: 22 },
      { header: "Parent Phone", key: "parent_phone", width: 18 },
      { header: "Payment Status", key: "payment_status", width: 20 },
      { header: "Total Paid", key: "total_paid", width: 14 },
      { header: "Balance", key: "balance", width: 14 },
    ];
    sheet.addRows(filtered);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    const data = await wb.xlsx.writeBuffer(),
      url = URL.createObjectURL(
        new Blob([data as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "pta-students.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Student list exported");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Workbook has no worksheet");
      const headers = (ws.getRow(1).values as unknown[]).map((v) =>
        String(v ?? "")
          .trim()
          .toLowerCase()
          .replaceAll(" ", "_"),
      );
      let count = 0;
      for (let i = 2; i <= ws.rowCount; i++) {
        const values = ws.getRow(i).values as unknown[],
          row = Object.fromEntries(headers.map((h, j) => [h, values[j]])),
          className = String(row.class ?? row.class_name ?? "").trim(),
          schoolClass = classes.find(
            (c) => c.name.toLowerCase() === className.toLowerCase(),
          );
        if (
          !row.admission_number ||
          !row.first_name ||
          !row.last_name ||
          !schoolClass
        )
          continue;
        const created = await api.createStudent({
          admission_number: String(row.admission_number).trim().toUpperCase(),
          first_name: String(row.first_name).trim(),
          last_name: String(row.last_name).trim(),
          gender: (["Male", "Female", "Other"].includes(String(row.gender))
            ? String(row.gender)
            : "Other") as Student["gender"],
          class_id: schoolClass.id,
          parent_name: String(row.parent_name ?? "").trim() || "Not provided",
          parent_phone: String(row.parent_phone ?? "").trim() || "Not provided",
          address: String(row.address ?? "").trim(),
          status: "active",
        });
        if (String(row.password ?? "").length >= 8)
          await adminUsers.setStudentCredentials(
            created.id,
            String(row.password),
          );
        count++;
      }
      await queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${count} students imported successfully`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not import this workbook",
      );
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  if (studentsLoading && !isDemoMode) return <StudentsSkeleton />;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {students.length} active records · {year?.year ?? "Active year"}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => importFile(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            disabled={importing}
            onClick={() => inputRef.current?.click()}
          >
            {importing ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Upload size={16} />
            )}{" "}
            Import
          </Button>
          <Button variant="outline" onClick={realExport}>
            <Download size={16} /> Export
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus size={17} /> Add student
          </Button>
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/70 p-4 sm:flex-row dark:border-white/8">
          <label className="relative flex-1">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />
            <input
              className="field pl-10"
              placeholder="Search student, admission no. or parent…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="field sm:w-48"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">All payment statuses</option>
            <option>PAID</option>
            <option>PARTIALLY PAID</option>
            <option>UNPAID</option>
          </select>
          <select
            className="field sm:w-44"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="ALL">All classes</option>
            {classes.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[.03]">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-4 py-3">Admission no.</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Paid / Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/7">
              {filtered.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  onDelete={
                    profile?.role === "administrator"
                      ? confirmDelete
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden dark:divide-white/7">
          {filtered.map((s) => (
            <StudentCard
              key={s.id}
              student={s}
              onDelete={
                profile?.role === "administrator" ? confirmDelete : undefined
              }
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-500">
            No students match your filters.
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-slate-200/70 p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-white/8">
          <span>
            Showing {filtered.length} of {students.length} students
          </span>
        </div>
      </Card>
      <StudentForm
        open={open}
        onOpenChange={setOpen}
        classes={classes}
        busy={createStudent.isPending}
        onSave={addStudent}
      />
    </div>
  );
}

function StudentRow({
  student: s,
  onDelete,
}: {
  student: Student;
  onDelete?: (student: Student) => void;
}) {
  return (
    <tr className="transition hover:bg-slate-50/70 dark:hover:bg-white/[.025]">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
            <UserRound size={16} />
          </div>
          <div>
            <p className="font-semibold">
              {s.first_name} {s.last_name}
            </p>
            <p className="text-[11px] text-slate-500">{s.gender}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{s.admission_number}</td>
      <td className="px-4 py-3">{s.class_name}</td>
      <td className="px-4 py-3">
        <p className="font-medium">{s.parent_name}</p>
        <p className="text-[11px] text-slate-500">{s.parent_phone}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-semibold">{money(s.total_paid)}</p>
        <p className="text-[11px] text-rose-500">{money(s.balance)} due</p>
      </td>
      <td className="px-4 py-3">
        <Badge className={statusStyle[s.payment_status]}>
          {s.payment_status}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <Link
            to={`/students/${s.id}`}
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/8"
          >
            <Eye size={17} />
          </Link>
          {onDelete && (
            <button
              type="button"
              title="Delete student"
              onClick={() => onDelete(s)}
              className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
function StudentCard({
  student: s,
  onDelete,
}: {
  student: Student;
  onDelete?: (student: Student) => void;
}) {
  return (
    <div className="p-4">
      <div className="flex gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
          <UserRound size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {s.first_name} {s.last_name}
          </p>
          <p className="text-xs text-slate-500">
            {s.admission_number} · {s.class_name}
          </p>
        </div>
        {onDelete ? (
          <button
            type="button"
            title="Delete student"
            onClick={() => onDelete(s)}
            className="grid h-10 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={18} />
          </button>
        ) : (
          <MoreHorizontal />
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/[.04]">
        <div>
          <p className="text-slate-500">Total paid</p>
          <p className="mt-1 font-bold">{money(s.total_paid)}</p>
        </div>
        <div>
          <p className="text-slate-500">Balance</p>
          <p className="mt-1 font-bold">{money(s.balance)}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Badge className={statusStyle[s.payment_status]}>
          {s.payment_status}
        </Badge>
        <Link
          className="text-xs font-bold text-indigo-600"
          to={`/students/${s.id}`}
        >
          View profile
        </Link>
      </div>
    </div>
  );
}

function StudentForm({
  open,
  onOpenChange,
  onSave,
  classes,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (s: StudentDraft, password: string) => Promise<void>;
  classes: SchoolClass[];
  busy: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a new student"
      description="Create the student record and their portal login together."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          await onSave(
            {
              admission_number: String(d.get("admission")).trim().toUpperCase(),
              first_name: String(d.get("first_name")).trim(),
              last_name: String(d.get("last_name")).trim(),
              gender: String(d.get("gender")) as Student["gender"],
              class_id: String(d.get("class_id")),
              parent_name: String(d.get("parent_name")).trim(),
              parent_phone: String(d.get("parent_phone")).trim(),
              address: String(d.get("address")).trim(),
              status: "active",
            },
            String(d.get("password")),
          );
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label>
          <span className="label">Student ID / admission number</span>
          <input
            name="admission"
            required
            className="field"
            placeholder="APS/26/001"
          />
        </label>
        <label>
          <span className="label">Class</span>
          <select name="class_id" required className="field">
            {classes.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">First name</span>
          <input name="first_name" required className="field" />
        </label>
        <label>
          <span className="label">Last name</span>
          <input name="last_name" required className="field" />
        </label>
        <label>
          <span className="label">Gender</span>
          <select name="gender" className="field">
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          <span className="label">Parent phone</span>
          <input name="parent_phone" required className="field" type="tel" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Parent name</span>
          <input name="parent_name" required className="field" />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Student portal password</span>
          <div className="relative">
            <KeyRound
              className="absolute left-3 top-3.5 text-slate-400"
              size={16}
            />
            <input
              name="password"
              required
              minLength={8}
              className="field pl-10"
              type="password"
              placeholder="Minimum 8 characters"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Give this password and the Student ID to the student.
          </p>
        </label>
        <label className="sm:col-span-2">
          <span className="label">Address</span>
          <textarea name="address" className="field min-h-20 py-3" />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Plus size={16} />
            )}{" "}
            Save student & create login
          </Button>
        </div>
      </form>
    </Modal>
  );
}
