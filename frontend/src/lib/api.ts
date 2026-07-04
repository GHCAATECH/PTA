import { supabase } from "./supabase";
import type {
  AcademicYear,
  DashboardStats,
  Payment,
  PtaFee,
  SchoolClass,
  SchoolSettings,
  Student,
} from "../types";

async function activeYear() {
  const { data, error } = await supabase
    .from("academic_years")
    .select("*")
    .eq("is_active", true)
    .single();
  if (error) throw error;
  return data;
}
export const api = {
  async activeYear() {
    return activeYear();
  },
  async classes(): Promise<SchoolClass[]> {
    const { data, error } = await supabase
      .from("classes")
      .select("id,name")
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  async students(academicYearId?: string): Promise<Student[]> {
    const allYears = academicYearId === "all";
    const year = allYears
      ? null
      : academicYearId
        ? await supabase
            .from("academic_years")
            .select("*")
            .eq("id", academicYearId)
            .single()
            .then(({ data, error }) => {
              if (error) throw error;
              return data;
            })
        : await activeYear();
    const summaryQuery = supabase.from("student_fee_summary").select("*");
    const feeQuery = allYears
      ? supabase.from("pta_fees").select("amount")
      : supabase
          .from("pta_fees")
          .select("amount")
          .eq("academic_year_id", year!.id)
          .single();
    const [
      { data: students, error },
      { data: summaries, error: summaryError },
      { data: fee, error: feeError },
    ] = await Promise.all([
      supabase.from("students").select("*, classes(name)").order("last_name"),
      allYears ? summaryQuery : summaryQuery.eq("academic_year_id", year!.id),
      feeQuery,
    ]);
    if (error) throw error;
    if (summaryError) throw summaryError;
    if (feeError) throw feeError;
    const totalFee = Array.isArray(fee)
      ? fee.reduce((sum, item: any) => sum + Number(item.amount ?? 0), 0)
      : Number((fee as any)?.amount ?? 0);
    const byStudent = new Map<string, any>();
    for (const summary of summaries ?? []) {
      const current = byStudent.get(summary.student_id);
      if (!allYears) {
        byStudent.set(summary.student_id, summary);
        continue;
      }
      const nextYear = Number(String(summary.year ?? "0/0").split("/")[0] || 0);
      const currentYear = Number(
        String(current?.year ?? "0/0").split("/")[0] || 0,
      );
      if (!current || nextYear >= currentYear) {
        byStudent.set(summary.student_id, summary);
      }
    }
    return (students ?? []).map((s: any) => {
      const x: any = byStudent.get(s.id);
      return {
        ...s,
        class_name: s.classes?.name ?? "",
        fee: allYears ? Number(x?.fee_amount ?? totalFee) : totalFee,
        total_paid: Number(x?.total_paid ?? 0),
        balance: Number(x?.outstanding_balance ?? 0),
        payment_status: x?.payment_status ?? "UNPAID",
      };
    });
  },
  async createStudent(
    input: Omit<
      Student,
      "id" | "class_name" | "fee" | "total_paid" | "balance" | "payment_status"
    >,
  ) {
    const { data, error } = await supabase
      .from("students")
      .insert(input)
      .select("*, classes(name)")
      .single();
    if (error) throw error;
    return data;
  },
  async createStudents(
    input: Array<
      Omit<
        Student,
        | "id"
        | "class_name"
        | "fee"
        | "total_paid"
        | "balance"
        | "payment_status"
      >
    >,
  ) {
    const { data, error } = await supabase
      .from("students")
      .insert(input)
      .select("id,admission_number");
    if (error) throw error;
    return data ?? [];
  },
  async payments(academicYearId?: string): Promise<Payment[]> {
    let query = supabase
      .from("payment_receipts")
      .select("*")
      .order("created_at", { ascending: false });
    if (academicYearId && academicYearId !== "all")
      query = query.eq("academic_year_id", academicYearId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      ...p,
      amount_paid: Number(p.amount_paid),
      total_paid: Number(p.total_paid),
      outstanding_balance: Number(p.outstanding_balance),
    }));
  },
  async payment(id: string): Promise<Payment> {
    const { data, error } = await supabase
      .from("payment_receipts")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return {
      ...data,
      amount_paid: Number(data.amount_paid),
      total_paid: Number(data.total_paid),
      outstanding_balance: Number(data.outstanding_balance),
    } as Payment;
  },
  async dashboardStats(academicYearId?: string): Promise<DashboardStats> {
    const year = academicYearId
      ? await supabase
          .from("academic_years")
          .select("*")
          .eq("id", academicYearId)
          .single()
          .then(({ data, error }) => {
            if (error) throw error;
            return data;
          })
      : await activeYear();
    const { data, error } = await supabase.rpc("dashboard_stats", {
      p_academic_year_id: year.id,
    });
    if (error) throw error;
    return data as DashboardStats;
  },
  async dashboardDetails() {
    const year = await activeYear();
    const [
      { data: payments, error: paymentError },
      { data: students, error: studentError },
    ] = await Promise.all([
      supabase
        .from("payment_receipts")
        .select(
          "id,student_id,student_name,admission_number,class_name,academic_year,amount_paid,payment_date,receipt_number,remarks,received_by_name,total_paid,outstanding_balance",
        )
        .eq("academic_year_id", year.id)
        .order("payment_date"),
      supabase
        .from("student_fee_summary")
        .select("student_id,class_name,payment_status")
        .eq("academic_year_id", year.id),
    ]);
    if (paymentError) throw paymentError;
    if (studentError) throw studentError;
    return { year, payments: payments ?? [], students: students ?? [] };
  },
  async createPayment(input: {
    student_id: string;
    academic_year_id: string;
    amount: number;
    date: string;
    method: string;
    remarks?: string;
    override?: boolean;
  }) {
    const { data, error } = await supabase.rpc("create_payment", {
      p_student_id: input.student_id,
      p_academic_year_id: input.academic_year_id,
      p_amount: input.amount,
      p_payment_date: input.date,
      p_method: input.method,
      p_remarks: input.remarks ?? null,
      p_admin_override: input.override ?? false,
    });
    if (error) throw error;
    return data;
  },
  async setup() {
    const [
      { data: years, error: yError },
      { data: classes, error: cError },
      { data: fees, error: fError },
      { data: students, error: sError },
    ] = await Promise.all([
      supabase
        .from("academic_years")
        .select("*")
        .order("year", { ascending: false }),
      supabase.from("classes").select("*").order("sort_order"),
      supabase.from("pta_fees").select("*"),
      supabase.from("students").select("class_id"),
    ]);
    if (yError) throw yError;
    if (cError) throw cError;
    if (fError) throw fError;
    if (sError) throw sError;
    const counts = new Map<string, number>();
    (students ?? []).forEach((s) =>
      counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1),
    );
    return {
      years: (years ?? []) as AcademicYear[],
      classes: (classes ?? []).map((c) => ({
        ...c,
        student_count: counts.get(c.id) ?? 0,
      })) as Array<SchoolClass & { student_count: number }>,
      fees: (fees ?? []).map((f) => ({
        ...f,
        amount: Number(f.amount),
      })) as PtaFee[],
    };
  },
  async addYear(year: string) {
    const { data, error } = await supabase
      .from("academic_years")
      .insert({ year })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async activateYear(id: string) {
    const { error } = await supabase.rpc("activate_academic_year", {
      p_year_id: id,
    });
    if (error) throw error;
  },
  async addClass(name: string) {
    const { data, error } = await supabase
      .from("classes")
      .insert({ name, sort_order: 999 })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async renameClass(id: string, name: string) {
    const { data, error } = await supabase
      .from("classes")
      .update({ name })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async deleteClass(id: string) {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) throw error;
  },
  async saveFee(academic_year_id: string, amount: number) {
    const { data, error } = await supabase
      .from("pta_fees")
      .upsert({ academic_year_id, amount }, { onConflict: "academic_year_id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async settings(): Promise<SchoolSettings> {
    const { data, error } = await supabase
      .from("school_settings")
      .select("*")
      .eq("id", true)
      .single();
    if (error) throw error;
    return data;
  },
  async saveSettings(input: Partial<SchoolSettings>) {
    const { data, error } = await supabase
      .from("school_settings")
      .update(input)
      .eq("id", true)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async notifyPaymentSms(payment_id: string) {
    const { data, error } = await supabase.functions.invoke("payment-sms", {
      body: { payment_id },
    });
    if (error) {
      let message = error.message;
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const body = await context.clone().json();
          if (body?.error) message = String(body.error);
          else if (body?.message) message = String(body.message);
        } catch {
          try {
            const text = await context.clone().text();
            if (text.trim()) message = text.trim();
          } catch {
            // Keep original SDK error message when the response body cannot be read.
          }
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data as {
      success?: boolean;
      skipped?: boolean;
      reason?: string;
      recipient?: string;
      sender?: string;
      provider?: unknown;
    };
  },
  async sendTestSms(test_phone: string) {
    const { data, error } = await supabase.functions.invoke("payment-sms", {
      body: { test_phone },
    });
    if (error) {
      let message = error.message;
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const body = await context.clone().json();
          if (body?.error) message = String(body.error);
          else if (body?.message) message = String(body.message);
        } catch {
          try {
            const text = await context.clone().text();
            if (text.trim()) message = text.trim();
          } catch {
            // Keep original SDK error message when the response body cannot be read.
          }
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data as {
      success?: boolean;
      skipped?: boolean;
      reason?: string;
      recipient?: string;
      sender?: string;
      provider?: unknown;
    };
  },
  async onlinePaymentLink(amount: number) {
    const { data, error } = await supabase.functions.invoke("payment-link", {
      body: { action: "initialize", amount },
    });
    if (error) {
      let message = error.message;
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const body = await context.clone().json();
          if (body?.error) message = String(body.error);
        } catch {
          try {
            const text = await context.clone().text();
            if (text.trim()) message = text.trim();
          } catch {
            // Keep original SDK error message.
          }
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data as { url: string };
  },
  async verifyOnlinePayment(reference: string) {
    const { data, error } = await supabase.functions.invoke("payment-link", {
      body: { action: "verify", reference },
    });
    if (error) {
      let message = error.message;
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const body = await context.clone().json();
          if (body?.error) message = String(body.error);
          else if (body?.message) message = String(body.message);
        } catch {
          try {
            const text = await context.clone().text();
            if (text.trim()) message = text.trim();
          } catch {
            // Keep original SDK error message.
          }
        }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data as {
      success: boolean;
      payment_id: string;
      receipt_number: string;
      amount_paid: number;
    };
  },
  async uploadLogo(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png",
      path = `school-logo.${ext}`;
    const { error } = await supabase.storage
      .from("school-assets")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
    await api.saveSettings({ logo_path: data.publicUrl });
    return data.publicUrl;
  },
};
