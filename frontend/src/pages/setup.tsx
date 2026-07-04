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

type Editor = {
  kind: "year" | "class" | "fee";
  id?: string;
  value: string;
} | null;

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
      const active = setup.data?.years.find((y) => y.is_active);
      if (!active) throw new Error("Activate a semester first");
      return api.saveFee(active.id, Number(e.value));
    },
    onSuccess: (_, values) => {
      refresh();
      setEditor(null);
      toast.success(
        values.kind === "year"
          ? "Semester 1 and Semester 2 created"
          : values.kind === "class"
            ? values.id
              ? "Class renamed"
              : "Class family created"
            : "PTA fee saved",
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
  const { years, classes, fees } = setup.data,
    active = years.find((y) => y.is_active),
    fee = fees.find((f) => f.academic_year_id === active?.id);
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
            <CardTitle>PTA fee</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Set one fee for the active semester.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 p-5 text-white">
            <WalletCards className="absolute -bottom-5 -right-3 h-28 w-28 opacity-10" />
            <p className="text-xs text-indigo-100">
              {active?.year ?? "No active semester"} PTA fee
            </p>
            <p className="mt-2 text-3xl font-extrabold">
              {fee ? money(fee.amount) : "Not configured"}
            </p>
            <p className="mt-4 text-xs text-indigo-100">
              Applies to all students in the active semester
            </p>
            <Button
              size="sm"
              className="mt-4 bg-white text-indigo-700 hover:bg-indigo-50"
              disabled={!active}
              onClick={() =>
                setEditor({ kind: "fee", value: String(fee?.amount ?? "") })
              }
            >
              <Edit3 size={14} /> {fee ? "Edit amount" : "Set amount"}
            </Button>
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
          onClose={() => setEditor(null)}
          onSave={(e) => mutation.mutate(e)}
        />
      )}
    </div>
  );
}
function EditorModal({
  editor,
  busy,
  onClose,
  onSave,
}: {
  editor: NonNullable<Editor>;
  busy: boolean;
  onClose: () => void;
  onSave: (e: NonNullable<Editor>) => void;
}) {
  const [value, setValue] = useState(editor.value),
    title =
      editor.kind === "year"
        ? "Add academic session"
        : editor.kind === "fee"
          ? "Set PTA fee"
          : editor.id
            ? "Rename class"
            : "Add class family";
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title={title}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ ...editor, value });
        }}
        className="space-y-4"
      >
        <label>
          <span className="label">
            {editor.kind === "year"
              ? "Academic session (YYYY/YYYY)"
              : editor.kind === "fee"
                ? "Amount (GHS)"
                : editor.id
                  ? "Class name"
                  : "Family name, e.g. Arts 1"}
          </span>
          <input
            autoFocus
            required
            className="field"
            type={editor.kind === "fee" ? "number" : "text"}
            min={editor.kind === "fee" ? "0.01" : undefined}
            step={editor.kind === "fee" ? "0.01" : undefined}
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
