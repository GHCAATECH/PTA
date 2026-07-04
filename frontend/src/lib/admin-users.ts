import { supabase } from "./supabase";
import type { Role } from "../types";

export interface StaffUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
  last_sign_in_at?: string;
  suspended: boolean;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const adminUsers = {
  list: () =>
    invoke<{ users: StaffUser[] }>({ action: "list" }).then(
      (result) => result.users,
    ),
  create: (input: {
    email: string;
    password: string;
    full_name: string;
    role: Role;
  }) => invoke({ action: "create", ...input }),
  update: (input: {
    user_id: string;
    full_name: string;
    email: string;
    role: Role;
    password?: string;
  }) =>
    invoke({ action: "update", ...input }),
  suspend: (user_id: string, suspended: boolean) =>
    invoke({ action: "suspend", user_id, suspended }),
  delete: (user_id: string) =>
    invoke<{ success: boolean }>({ action: "delete", user_id }),
  setStudentCredentials: (student_id: string, password: string) =>
    invoke<{ success: boolean; created: boolean }>({
      action: "student_credentials",
      student_id,
      password,
    }),
  deleteStudent: (student_id: string) =>
    invoke<{ success: boolean }>({ action: "delete_student", student_id }),
};
