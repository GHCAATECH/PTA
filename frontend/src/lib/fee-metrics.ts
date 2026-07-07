import type { DashboardStats, PaymentStatus } from "../types";

type FeeSummaryLike = {
  student_id: string;
  academic_year_id: string;
  year?: string | null;
  class_name?: string | null;
  fee_amount?: number | string | null;
  total_paid?: number | string | null;
  outstanding_balance?: number | string | null;
  payment_status?: PaymentStatus | null;
};

type PaymentLike = {
  academic_year_id?: string | null;
  amount_paid?: number | string | null;
  payment_date?: string | null;
};

function numeric(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function academicYearSortValue(value: string | null | undefined) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})\/(\d{4})(?:\s*-\s*Semester\s*(\d+))?/i);
  if (!match) return 0;
  const startYear = Number(match[1] ?? 0);
  const semester = Number(match[3] ?? 0);
  return startYear * 10 + semester;
}

export function buildStudentFeeOverview(
  rows: FeeSummaryLike[],
  activeAcademicYearId: string,
) {
  const sortedRows = [...rows].sort(
    (a, b) => academicYearSortValue(a.year) - academicYearSortValue(b.year),
  );

  let previousOutstandingDisplay = 0;
  let previousTotalDebt = 0;
  let activeSummary: FeeSummaryLike | null = null;
  let activeExpected = 0;
  let activeCollected = 0;
  let activeOutstanding = 0;
  let previousOutstanding = 0;
  let totalDebt = 0;

  for (const row of sortedRows) {
    const expected = numeric(row.fee_amount);
    const collected = numeric(row.total_paid);
    const hasConfiguredFee = expected > 0;

    const carriedOutstanding = hasConfiguredFee
      ? previousTotalDebt
      : previousOutstandingDisplay;
    const rowTotalDebt = hasConfiguredFee
      ? Math.max(carriedOutstanding + expected - collected, 0)
      : Math.max(previousTotalDebt - collected, 0);
    const rowActiveOutstanding = hasConfiguredFee
      ? Math.max(rowTotalDebt - carriedOutstanding, 0)
      : 0;

    if (row.academic_year_id === activeAcademicYearId) {
      activeSummary = row;
      activeExpected = expected;
      activeCollected = collected;
      activeOutstanding = rowActiveOutstanding;
      previousOutstanding = carriedOutstanding;
      totalDebt = rowTotalDebt;
    }

    previousOutstandingDisplay = carriedOutstanding;
    previousTotalDebt = rowTotalDebt;
  }

  const overallStatus: PaymentStatus =
    totalDebt <= 0
      ? "PAID"
      : sortedRows.some((row) => numeric(row.total_paid) > 0)
        ? "PARTIALLY PAID"
        : "UNPAID";

  return {
    activeSummary,
    activeExpected,
    activeCollected,
    activeOutstanding,
    previousOutstanding,
    totalDebt,
    totalOutstanding: totalDebt,
    overallStatus,
  };
}

export function buildDashboardMetrics(
  summaries: FeeSummaryLike[],
  payments: PaymentLike[],
  activeAcademicYearId: string,
) {
  const grouped = new Map<string, FeeSummaryLike[]>();
  for (const summary of summaries) {
    grouped.set(summary.student_id, [
      ...(grouped.get(summary.student_id) ?? []),
      summary,
    ]);
  }

  const studentStates = [...grouped.values()].map((rows) => {
    const overview = buildStudentFeeOverview(rows, activeAcademicYearId);
    return {
      student_id: rows[0]?.student_id ?? "",
      class_name: overview.activeSummary?.class_name ?? rows[0]?.class_name ?? "",
      payment_status: overview.overallStatus,
      activeExpected: overview.activeExpected,
      activeCollected: overview.activeCollected,
      activeOutstanding: overview.activeOutstanding,
      previousOutstanding: overview.previousOutstanding,
      totalDebt: overview.totalDebt,
      totalOutstanding: overview.totalOutstanding,
    };
  });

  const today = new Date();
  const todayCollected = payments.reduce((sum, payment) => {
    if (payment.academic_year_id !== activeAcademicYearId || !payment.payment_date) {
      return sum;
    }
    const paymentDate = new Date(payment.payment_date);
    const sameDay =
      paymentDate.getFullYear() === today.getFullYear() &&
      paymentDate.getMonth() === today.getMonth() &&
      paymentDate.getDate() === today.getDate();
    return sameDay ? sum + numeric(payment.amount_paid) : sum;
  }, 0);

  const total_expected = studentStates.reduce(
    (sum, student) => sum + student.activeExpected,
    0,
  );
  const total_collected = payments.reduce((sum, payment) => {
    if (payment.academic_year_id !== activeAcademicYearId) return sum;
    return sum + numeric(payment.amount_paid);
  }, 0);
  const outstanding = studentStates.reduce(
    (sum, student) => sum + student.previousOutstanding,
    0,
  );
  const total_debt = studentStates.reduce(
    (sum, student) => sum + student.totalOutstanding,
    0,
  );
  const fully_paid = studentStates.filter(
    (student) => student.totalOutstanding <= 0,
  ).length;
  const owing = Math.max(studentStates.length - fully_paid, 0);

  return {
    stats: {
      total_students: studentStates.length,
      total_expected,
      total_collected,
      outstanding,
      total_debt,
      fully_paid,
      owing,
      today_collected: todayCollected,
    } satisfies DashboardStats,
    studentStates,
  };
}
