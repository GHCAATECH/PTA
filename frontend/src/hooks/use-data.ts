import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { isDemoMode } from "../lib/supabase";
export const useStudents = (academicYearId?: string) =>
  useQuery({
    queryKey: ["students", academicYearId ?? "active"],
    queryFn: () => api.students(academicYearId),
    enabled: !isDemoMode,
  });
export const useClasses = () =>
  useQuery({
    queryKey: ["classes"],
    queryFn: api.classes,
    enabled: !isDemoMode,
  });
export const usePayments = (academicYearId?: string) =>
  useQuery({
    queryKey: ["payments", academicYearId ?? "all"],
    queryFn: () => api.payments(academicYearId),
    enabled: !isDemoMode,
  });
export const useDashboardStats = (academicYearId?: string) =>
  useQuery({
    queryKey: ["dashboard", academicYearId ?? "active"],
    queryFn: () => api.dashboardStats(academicYearId),
    enabled: !isDemoMode,
  });
export const useDashboardDetails = () =>
  useQuery({
    queryKey: ["dashboard-details"],
    queryFn: api.dashboardDetails,
    enabled: !isDemoMode,
  });
export const useActiveYear = () =>
  useQuery({
    queryKey: ["active-year"],
    queryFn: api.activeYear,
    enabled: !isDemoMode,
  });
export const useSetup = () =>
  useQuery({ queryKey: ["setup"], queryFn: api.setup, enabled: !isDemoMode });
export const useSettings = () =>
  useQuery({
    queryKey: ["settings"],
    queryFn: api.settings,
    enabled: !isDemoMode,
  });
export const useCreateStudent = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: api.createStudent,
    onSuccess: () => q.invalidateQueries({ queryKey: ["students"] }),
  });
};
export const useCreatePayment = () => {
  const q = useQueryClient();
  return useMutation({
    mutationFn: api.createPayment,
    onSuccess: () =>
      Promise.all([
        q.invalidateQueries({ queryKey: ["payments"] }),
        q.invalidateQueries({ queryKey: ["students"] }),
        q.invalidateQueries({ queryKey: ["dashboard"] }),
        q.invalidateQueries({ queryKey: ["dashboard-details"] }),
      ]),
  });
};
