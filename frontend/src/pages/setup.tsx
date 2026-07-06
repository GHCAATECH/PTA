import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  Edit3,
  Loader2,
  Plus,
  School,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Modal } from "../components/ui/modal";
import { useSetup } from "../hooks/use-data";
import { api } from "../lib/api";
import { money } from "../lib/utils";
import type { PtaFeeScope } from "../types";

type Editor =
  | {
      kind: "year" | "class";
      id?: string;
      value: string;
    }
  | {
      kind: "fee";
      id?: string;
      amount: string;
      applies_to: PtaFeeScope;
      class_id?: string;
      student_id?: string;
    }
  | null;

export default function Setup() {
  const setup = useSetup(),
    qc = useQueryClient(),
    [editor, setEditor] = useState<Editor>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["setup"] });

  const mutation = useMutation({
    mutationFn: async (e: NonNullable<Editor>) => {
      if (e.kind === "year") return api.addAcademicSession(e.value.trim());
      if (e.kind === "class")
        return e.id
          ? api.renameClass(e.id, e.value.trim())
          : api.addClassFamily(e.value.trim());
      if (e.kind !== "fee") throw new Error("Unsupported editor state");
      const active = setup.data?.years.find((y) => y.is_active);
      if (!active) throw new Error("Activate a semester first");
      return api.saveFeeRule({
        id: e.id,
        academic_year_id: active.id,
        amount: Number(e.amount),
        applies_to: e.applies_to,
        class_id: e.applies_to === "class" ? e.class_id : null,
        student_id: e.applies_to === "student" ? e.student_id : null,
      });
    },
    onSuccess: (_, values) => {
      refresh();
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-details"] });
      setEditor(null);
      toast.success(
        values.kind === "year"
          ? "Semester 1 and Semester 2 created"
          : values.kind === "class"
            ? values.id
              ? "Class renamed"
              : "Class family created"
            : values.id
              ? "PTA fee rule updated"
              : "PTA fee rule saved",
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const activate = useMutation({
    mutationFn: api.activateYear,
    onSuccess: () => {
      refresh();
      qc.invalidateQueries();
      toast.success("Active semester changed");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteClass = useMutation({
    mutationFn: api.deleteClass,
    onSuccess: () => {
      refresh();
      toast.success("Class deleted");
    },
    onError: (error) =>
      toast.error(
        error.message.includes("foreign key")
          ? "Move or archive the students in this class before deleting it."
          : error.message,
      ),
  });
  const deleteFee = useMutation({
    mutationFn: api.deleteFeeRule,
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-details"] });
      toast.success("PTA fee rule deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  if (setup.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  if (!setup.data)
    return (
      <Card className="p-10 text-center text-rose-600">
        Academic setup could not be loaded.
      </Card>
    );

  const { years, classes, fees, students } = setup.data;
  const active = years.find((y) => y.is_active);
  const activeFees = fees
    .filter((f) => f.academic_year_id === active?.id)
    .sort((a, b) => {
      const order = { all_classes: 0, class: 1, student: 2 };
      return order[a.applies_to] - order[b.applies_to];
    });

  const summaryCards = {
    allClasses: activeFees.find((f) => f.applies_to === "all_classes"),
    classRules: activeFees.filter((f) => f.applies_to === "class").length,
    studentRules: activeFees.filter((f) => f.applies_to === "student").length,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Academic semesters</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Create each academic session once and the system will add Semester
              1 and Semester 2 together.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setEditor({ kind: "year", value: "" })}
          >
            <Plus size={15} /> Add session
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {years.map((y) => (
            <div
              key={y.id}
              className="flex items-center gap-3 rounded-xl border p-3 dark:border-white/8"
            >
              <BookOpen size={18} className="text-indigo-600" />
              <div className="flex-1">
                <p className="text-sm font-bold">{y.year}</p>
                <p className="text-[11px] text-slate-500">Academic semester</p>
              </div>
              {y.is_active ? (
                <Badge className="bg-emerald-50 text-emerald-700">
                  <Check size={12} /> Active
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activate.isPending}
                  onClick={() => activate.mutate(y.id)}
                >
                  Make active
                </Button>
              )}
            </div>
          ))}
          {!years.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              Add your first academic session.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>PTA fee rules</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Set PTA fees for all classes, selected classes, or individual
              students in the active semester.
            </p>
          </div>
          <Button
            size="sm"
            disabled={!active}
            onClick={() =>
              setEditor({
                kind: "fee",
                amount: "",
                applies_to: "all_classes",
              })
            }
          >
            <Plus size={15} /> Add fee rule
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <RuleSummaryCard
              icon={WalletCards}
              label="All classes"
              value={summaryCards.allClasses ? money(summaryCards.allClasses.amount) : "Not set"}
            />
            <RuleSummaryCard
              icon={School}
              label="Selected class"
              value={`${summaryCards.classRules} rule${summaryCards.classRules === 1 ? "" : "s"}`}
            />
            <RuleSummaryCard
              icon={UserRound}
              label="Individual"
              value={`${summaryCards.studentRules} rule${summaryCards.studentRules === 1 ? "" : "s"}`}
            />
          </div>

          <div className="space-y-3">
            {activeFees.length ? (
              activeFees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center gap-3 rounded-xl border p-3 dark:border-white/8"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10">
                    {fee.applies_to === "all_classes" ? (
                      <WalletCards size={18} />
                    ) : fee.applies_to === "class" ? (
                      <School size={18} />
                    ) : (
                      <UserRound size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{money(fee.amount)}</p>
                      <Badge className="bg-slate-100 text-slate-700">
                        {fee.applies_to === "all_classes"
                          ? "All classes"
                          : fee.applies_to === "class"
                            ? "Selected class"
                            : "Individual"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {fee.applies_to === "all_classes"
                        ? "Applies to every student unless a class or individual fee overrides it."
                        : fee.applies_to === "class"
                          ? fee.class_name
                          : `${fee.student_name} (${fee.admission_number})`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Edit fee rule"
                      onClick={() =>
                        setEditor({
                          kind: "fee",
                          id: fee.id,
                          amount: String(fee.amount),
                          applies_to: fee.applies_to,
                          class_id: fee.class_id ?? undefined,
                          student_id: fee.student_id ?? undefined,
                        })
                      }
                    >
                      <Edit3 size={15} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Delete fee rule"
                      disabled={deleteFee.isPending}
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => {
                        if (window.confirm("Delete this PTA fee rule?")) {
                          deleteFee.mutate(fee.id);
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500 dark:border-white/10">
                No PTA fee rules set for the active semester yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Class families</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Add one family name like Arts 1 and the system creates 1 Arts 1,
              2 Arts 1, and 3 Arts 1.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setEditor({ kind: "class", value: "" })}
          >
            <Plus size={15} /> Add class family
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {classes.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border p-3 dark:border-white/8"
              >
                <School size={17} className="text-indigo-600" />
                <div className="flex-1">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.student_count ?? 0} students
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Rename class"
                    onClick={() =>
                      setEditor({ kind: "class", id: c.id, value: c.name })
                    }
                  >
                    <Edit3 size={15} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete class"
                    disabled={deleteClass.isPending}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${c.name}? This cannot be undone.`,
                        )
                      )
                        deleteClass.mutate(c.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {editor && (
        <EditorModal
          editor={editor}
          busy={mutation.isPending}
          classes={classes}
          students={students}
          onClose={() => setEditor(null)}
          onSave={(e) => mutation.mutate(e)}
        />
      )}
    </div>
  );
}

function RuleSummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-4 dark:border-white/8 dark:bg-white/5">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={16} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

function EditorModal({
  editor,
  busy,
  classes,
  students,
  onClose,
  onSave,
}: {
  editor: NonNullable<Editor>;
  busy: boolean;
  classes: Array<{ id: string; name: string }>;
  students: Array<any>;
  onClose: () => void;
  onSave: (e: NonNullable<Editor>) => void;
}) {
  const [value, setValue] = useState(editor.kind === "fee" ? editor.amount : editor.value);
  const [appliesTo, setAppliesTo] = useState<PtaFeeScope>(
    editor.kind === "fee" ? editor.applies_to : "all_classes",
  );
  const [classId, setClassId] = useState(
    editor.kind === "fee" ? editor.class_id ?? "" : "",
  );
  const [studentId, setStudentId] = useState(
    editor.kind === "fee" ? editor.student_id ?? "" : "",
  );

  const filteredStudents =
    appliesTo !== "student"
      ? students
      : students.filter((student) => !classId || student.class_id === classId);

  const title =
    editor.kind === "year"
      ? "Add academic session"
      : editor.kind === "fee"
        ? editor.id
          ? "Edit PTA fee rule"
          : "Add PTA fee rule"
        : editor.id
          ? "Rename class"
          : "Add class family";

  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (editor.kind === "fee") {
            onSave({
              kind: "fee",
              id: editor.id,
              amount: value,
              applies_to: appliesTo,
              class_id: appliesTo === "class" ? classId : undefined,
              student_id: appliesTo === "student" ? studentId : undefined,
            });
            return;
          }
          onSave({ ...editor, value });
        }}
        className="space-y-4"
      >
        {editor.kind === "fee" ? (
          <>
            <label>
              <span className="label">Apply fee to</span>
              <select
                className="field"
                value={appliesTo}
                onChange={(e) => {
                  const next = e.target.value as PtaFeeScope;
                  setAppliesTo(next);
                  if (next === "all_classes") {
                    setClassId("");
                    setStudentId("");
                  }
                  if (next === "class") {
                    setStudentId("");
                  }
                }}
              >
                <option value="all_classes">All classes</option>
                <option value="class">Selected class</option>
                <option value="student">Individual student</option>
              </select>
            </label>

            {(appliesTo === "class" || appliesTo === "student") && (
              <label>
                <span className="label">Class</span>
                <select
                  required
                  className="field"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    if (appliesTo === "student") setStudentId("");
                  }}
                >
                  <option value="">Select class</option>
                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {appliesTo === "student" && (
              <label>
                <span className="label">Student</span>
                <select
                  required
                  className="field"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Select student</option>
                  {filteredStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} ({student.admission_number})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span className="label">Amount (GHS)</span>
              <input
                autoFocus
                required
                className="field"
                type="number"
                min="0.01"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <p className="text-xs text-slate-500">
              Priority order: individual student fee overrides class fee, and
              class fee overrides all-classes fee.
            </p>
          </>
        ) : (
          <>
            <label>
              <span className="label">
                {editor.kind === "year"
                  ? "Academic session (YYYY/YYYY)"
                  : editor.id
                    ? "Class name"
                    : "Family name, e.g. Arts 1"}
              </span>
              <input
                autoFocus
                required
                className="field"
                type="text"
                pattern={editor.kind === "year" ? "20[0-9]{2}/20[0-9]{2}" : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            {editor.kind === "year" && (
              <p className="text-xs text-slate-500">
                This creates both Semester 1 and Semester 2 for the same academic
                session.
              </p>
            )}
            {editor.kind === "class" && !editor.id && (
              <p className="text-xs text-slate-500">
                Example: entering Arts 1 creates 1 Arts 1, 2 Arts 1, and 3 Arts 1.
              </p>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={16} />} Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
