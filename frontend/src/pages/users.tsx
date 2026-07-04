import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UserX,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { EmptyState } from "../components/ui/empty-state";
import { adminUsers, type StaffUser } from "../lib/admin-users";
import { initials, shortDate } from "../lib/utils";
import type { Role } from "../types";

const createSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the staff member's name"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
  role: z.enum(["administrator", "accountant"]),
});

type CreateValues = z.infer<typeof createSchema>;

export default function Users() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const queryClient = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminUsers.list,
  });

  const createUser = useMutation({
    mutationFn: adminUsers.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateOpen(false);
      toast.success("Staff account created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateUser = useMutation({
    mutationFn: adminUsers.update,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditing(null);
      toast.success("Staff account updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const suspendUser = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      adminUsers.suspend(id, suspended),
    onSuccess: async (_, values) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditing(null);
      toast.success(
        values.suspended ? "User access suspended" : "User access restored",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteUser = useMutation({
    mutationFn: adminUsers.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditing(null);
      toast.success("Staff account deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create staff accounts, update credentials, and control access
            privileges.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={17} /> Create user
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <RoleCard
          icon={ShieldCheck}
          label="Administrators"
          value={(users.data ?? []).filter(
            (user) => user.role === "administrator" && !user.suspended,
          ).length}
          tone="indigo"
        />
        <RoleCard
          icon={UserRound}
          label="Accountants"
          value={(users.data ?? []).filter(
            (user) => user.role === "accountant" && !user.suspended,
          ).length}
          tone="blue"
        />
        <RoleCard
          icon={UserX}
          label="Suspended"
          value={(users.data ?? []).filter((user) => user.suspended).length}
          tone="rose"
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Staff accounts</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Administrators manage setup and users. Accountants record payments
              and view reports.
            </p>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {users.isLoading ? (
            <div className="grid min-h-52 place-items-center">
              <Loader2 className="animate-spin text-indigo-600" />
            </div>
          ) : users.isError ? (
            <EmptyState
              title="Could not load users"
              message="Deploy the admin-users Edge Function, then try again."
            />
          ) : users.data?.length ? (
            <div className="divide-y divide-slate-100 dark:divide-white/7">
              {users.data.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
                >
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-100 text-xs font-extrabold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                    {initials(user.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{user.full_name}</p>
                      {user.suspended && (
                        <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                          <Ban size={12} /> Suspended
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {user.email} · Added {shortDate(user.created_at)}
                    </p>
                  </div>
                  <Badge
                    className={
                      user.role === "administrator"
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                    }
                  >
                    <ShieldCheck size={13} />
                    {user.role === "administrator"
                      ? "Administrator"
                      : "Accountant"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(user)}
                  >
                    <Pencil size={14} /> Manage
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No staff accounts"
              message="Create an administrator or accountant to get started."
            />
          )}
        </CardContent>
      </Card>

      <CreateUserModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        busy={createUser.isPending}
        onSubmit={(values) => createUser.mutate(values)}
      />

      {editing && (
        <ManageUserModal
          user={editing}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditing(null)}
          busy={
            updateUser.isPending ||
            suspendUser.isPending ||
            deleteUser.isPending
          }
          onSave={(values) =>
            updateUser.mutate({
              user_id: editing.id,
              ...values,
            })
          }
          onSuspend={() =>
            suspendUser.mutate({
              id: editing.id,
              suspended: !editing.suspended,
            })
          }
          onDelete={() => {
            if (
              window.confirm(
                `Delete ${editing.full_name}? This removes the staff member's login immediately.`,
              )
            ) {
              deleteUser.mutate(editing.id);
            }
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  busy: boolean;
  onSubmit: (values: CreateValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "accountant" },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) reset();
      }}
      title="Create staff account"
      description="The user can sign in immediately with the password you set."
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Full name" error={errors.full_name?.message}>
          <input
            className="field"
            {...register("full_name")}
            placeholder="Kofi Addo"
          />
        </Field>
        <Field label="Email address" error={errors.email?.message}>
          <input
            className="field"
            type="email"
            {...register("email")}
            placeholder="accounts@school.edu.gh"
          />
        </Field>
        <Field label="Temporary password" error={errors.password?.message}>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3.5 text-slate-400" size={16} />
            <input
              className="field pl-10"
              type="password"
              {...register("password")}
              placeholder="Minimum 8 characters"
            />
          </div>
        </Field>
        <Field label="Privileges" error={errors.role?.message}>
          <select className="field" {...register("role")}>
            <option value="accountant">Accountant</option>
            <option value="administrator">Administrator</option>
          </select>
        </Field>
        <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 sm:col-span-2 dark:bg-white/5 dark:text-slate-300">
          <strong>Accountant:</strong> records payments, views students, prints
          receipts, and runs reports.
          <br />
          <strong>Administrator:</strong> has accountant access plus users,
          students, setup, fees, and payment corrections.
        </div>
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}{" "}
            Create account
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ManageUserModal({
  user,
  open,
  onOpenChange,
  busy,
  onSave,
  onSuspend,
  onDelete,
}: {
  user: StaffUser;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  busy: boolean;
  onSave: (values: {
    full_name: string;
    email: string;
    role: Role;
    password?: string;
  }) => void;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState("");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Manage user privileges"
      description={user.email}
    >
      <div className="space-y-4">
        <label>
          <span className="label">Full name</span>
          <input
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Email address</span>
          <input
            className="field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Role and privileges</span>
          <select
            className="field"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
          >
            <option value="accountant">Accountant</option>
            <option value="administrator">Administrator</option>
          </select>
        </label>
        <label>
          <span className="label">Reset password</span>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3.5 text-slate-400" size={16} />
            <input
              className="field pl-10"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Leave blank to keep current password"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Enter a new password only if you want to reset it now.
          </p>
        </label>
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-white/8">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant={user.suspended ? "outline" : "danger"}
              type="button"
              disabled={busy}
              onClick={onSuspend}
            >
              {user.suspended ? (
                <>
                  <CheckCircle2 size={16} /> Restore access
                </>
              ) : (
                <>
                  <UserX size={16} /> Suspend access
                </>
              )}
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={16} /> Delete user
            </Button>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                busy ||
                name.trim().length < 2 ||
                !/^\S+@\S+\.\S+$/.test(email.trim()) ||
                (password.length > 0 && password.length < 8)
              }
              onClick={() =>
                onSave({
                  full_name: name.trim(),
                  email: email.trim().toLowerCase(),
                  role,
                  password: password.trim() || undefined,
                })
              }
            >
              {busy && <Loader2 className="animate-spin" size={16} />} Save
              changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function RoleCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  tone: "indigo" | "blue" | "rose";
}) {
  const styles = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10",
  };

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${styles[tone]}`}>
        <Icon size={19} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-extrabold">{value}</p>
      </div>
    </Card>
  );
}
