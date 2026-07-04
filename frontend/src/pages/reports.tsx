import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import {
  BarChart3,
  CalendarRange,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
  PieChart as PieIcon,
  Printer,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import {
  useActiveYear,
  usePayments,
  useSetup,
  useStudents,
} from "../hooks/use-data";
import { printReceipt } from "../lib/print-receipt";
import { money, shortDate } from "../lib/utils";
import type { Payment } from "../types";

const reportTypes = [
  {
    title: "Revenue summary",
    desc: "Collections and balances by month",
    icon: BarChart3,
  },
  {
    title: "Outstanding students",
    desc: "Students with unpaid balances",
    icon: UsersRound,
  },
  {
    title: "Paid students",
    desc: "Students who have fully paid",
    icon: PieIcon,
  },
  {
    title: "Receipt register",
    desc: "Complete receipt audit trail",
    icon: ReceiptText,
  },
  {
    title: "Student statement",
    desc: "Student payment history and running balance",
    icon: FileDown,
  },
  {
    title: "Class summary",
    desc: "Collection performance by class",
    icon: CalendarRange,
  },
] as const;

type ReportType = (typeof reportTypes)[number]["title"];
type ReportRow = Record<string, string | number>;

const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export default function Reports() {
  const [active, setActive] = useState<ReportType>("Revenue summary");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [className, setClassName] = useState("all");
  const [status, setStatus] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [academicYearId, setAcademicYearId] = useState("");

  const year = useActiveYear();
  const setup = useSetup();
  useEffect(() => {
    if (!academicYearId && year.data?.id) setAcademicYearId(year.data.id);
  }, [academicYearId, year.data?.id]);

  const students = useStudents(academicYearId || undefined);
  const payments = usePayments(academicYearId || undefined);
  const years = setup.data?.years ?? [];
  const selectedYear =
    academicYearId === "all"
      ? { id: "all", year: "All academic years", is_active: false }
      : years.find((value) => value.id === academicYearId) ?? year.data ?? null;

  const classes = useMemo(
    () => [...new Set((students.data ?? []).map((student) => student.class_name))].sort(),
    [students.data],
  );

  const filteredStudents = useMemo(
    () =>
      (students.data ?? []).filter(
        (student) =>
          (className === "all" || student.class_name === className) &&
          (status === "all" || student.payment_status === status),
      ),
    [students.data, className, status],
  );

  const filteredPayments = useMemo(
    () =>
      (payments.data ?? []).filter(
        (payment) =>
          (!from || payment.payment_date >= from) &&
          (!to || payment.payment_date <= to) &&
          (className === "all" || payment.class_name === className) &&
          (studentId === "all" || payment.student_id === studentId),
      ),
    [payments.data, from, to, className, studentId],
  );

  const selectedStudent = useMemo(
    () => (students.data ?? []).find((student) => student.id === studentId) ?? null,
    [studentId, students.data],
  );

  const revenueRows = useMemo(() => {
    const monthMap = new Map<
      string,
      { Month: string; Receipts: number; Collected: number; time: number }
    >();

    filteredPayments.forEach((payment) => {
      const date = new Date(`${payment.payment_date}T00:00:00`);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = monthMap.get(key);
      monthMap.set(key, {
        Month: date.toLocaleDateString("en-GH", {
          month: "short",
          year: "numeric",
        }),
        Receipts: (existing?.Receipts ?? 0) + 1,
        Collected: (existing?.Collected ?? 0) + payment.amount_paid,
        time: date.getFullYear() * 12 + date.getMonth(),
      });
    });

    return [...monthMap.values()]
      .sort((left, right) => left.time - right.time)
      .map(({ time: _time, ...row }) => row);
  }, [filteredPayments]);

  const outstandingRows = useMemo(
    () =>
      filteredStudents
        .filter((student) => student.balance > 0)
        .map((student) => ({
          Student: `${student.first_name} ${student.last_name}`,
          Admission: student.admission_number,
          Class: student.class_name,
          Status: student.payment_status,
          "Total paid": student.total_paid,
          "Outstanding balance": student.balance,
        })),
    [filteredStudents],
  );

  const paidRows = useMemo(
    () =>
      filteredStudents
        .filter((student) => student.payment_status === "PAID")
        .map((student) => ({
          Student: `${student.first_name} ${student.last_name}`,
          Admission: student.admission_number,
          Class: student.class_name,
          "Total paid": student.total_paid,
          Balance: student.balance,
        })),
    [filteredStudents],
  );

  const classSummaryRows = useMemo(
    () =>
      classes
        .filter((value) => className === "all" || value === className)
        .map((value) => {
          const classStudents = filteredStudents.filter(
            (student) => student.class_name === value,
          );
          return {
            Class: value,
            Students: classStudents.length,
            "Expected fees": classStudents.reduce((sum, student) => sum + student.fee, 0),
            Collected: classStudents.reduce(
              (sum, student) => sum + student.total_paid,
              0,
            ),
            Outstanding: classStudents.reduce(
              (sum, student) => sum + student.balance,
              0,
            ),
          };
        }),
    [classes, className, filteredStudents],
  );

  const receiptRows = useMemo(
    () =>
      filteredPayments.map((payment) => ({
        Student: payment.student_name,
        Admission: payment.admission_number,
        Class: payment.class_name,
        Receipt: payment.receipt_number,
        Date: payment.payment_date,
        Method: (payment.payment_method ?? "").replaceAll("_", " "),
        Amount: payment.amount_paid,
        "Received by": payment.received_by_name,
      })),
    [filteredPayments],
  );

  const statementRows = useMemo(() => {
    if (!selectedStudent) return [];
    return filteredPayments.map((payment) => ({
      Date: payment.payment_date,
      Receipt: payment.receipt_number,
      Method: (payment.payment_method ?? "").replaceAll("_", " "),
      Remarks: payment.remarks || "-",
      Amount: payment.amount_paid,
      "Running paid": payment.total_paid,
      "Balance after receipt": payment.outstanding_balance,
    }));
  }, [filteredPayments, selectedStudent]);

  const reportRows = useMemo<ReportRow[]>(() => {
    switch (active) {
      case "Outstanding students":
        return outstandingRows;
      case "Paid students":
        return paidRows;
      case "Receipt register":
        return receiptRows;
      case "Student statement":
        return statementRows;
      case "Class summary":
        return classSummaryRows;
      case "Revenue summary":
      default:
        return revenueRows;
    }
  }, [active, classSummaryRows, outstandingRows, paidRows, receiptRows, revenueRows, statementRows]);

  const chartRows = useMemo(() => {
    if (active === "Class summary") {
      return classSummaryRows.map((row) => ({
        label: String(row.Class),
        amount: Number(row.Collected),
      }));
    }
    if (active === "Student statement") {
      return statementRows.map((row) => ({
        label: shortDate(String(row.Date)),
        amount: Number(row.Amount),
      }));
    }
    return revenueRows.map((row) => ({
      label: String(row.Month),
      amount: Number(row.Collected),
    }));
  }, [active, classSummaryRows, revenueRows, statementRows]);

  const summaryValues = useMemo(() => {
    if (active === "Student statement" && selectedStudent) {
      return {
        expected: selectedStudent.fee,
        collected: selectedStudent.total_paid,
        outstanding: selectedStudent.balance,
      };
    }

    if (active === "Class summary" || active === "Outstanding students" || active === "Paid students") {
      return {
        expected: filteredStudents.reduce((sum, student) => sum + student.fee, 0),
        collected: filteredStudents.reduce(
          (sum, student) => sum + student.total_paid,
          0,
        ),
        outstanding: filteredStudents.reduce(
          (sum, student) => sum + student.balance,
          0,
        ),
      };
    }

    const collected = filteredPayments.reduce(
      (sum, payment) => sum + payment.amount_paid,
      0,
    );
    return {
      expected: filteredStudents.reduce((sum, student) => sum + student.fee, 0),
      collected,
      outstanding: Math.max(
        filteredStudents.reduce((sum, student) => sum + student.balance, 0),
        0,
      ),
    };
  }, [active, filteredPayments, filteredStudents, selectedStudent]);

  const save = (name: string, content: Blob) => {
    const link = document.createElement("a");
    const url = URL.createObjectURL(content);
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const headers = Object.keys(reportRows[0] ?? {});
    save(
      `${active}.csv`,
      new Blob(
        [
          [
            headers.map(csv).join(","),
            ...reportRows.map((row) =>
              headers
                .map((header) => csv((row as Record<string, unknown>)[header]))
                .join(","),
            ),
          ].join("\r\n"),
        ],
        { type: "text/csv" },
      ),
    );
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(active.slice(0, 31));
    const headers = Object.keys(reportRows[0] ?? {});
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: 22,
    }));
    worksheet.addRows(reportRows);
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    save(
      `${active}.xlsx`,
      new Blob([(await workbook.xlsx.writeBuffer()) as BlobPart]),
    );
  };

  if (
    students.isLoading ||
    payments.isLoading ||
    year.isLoading ||
    setup.isLoading
  ) {
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reportTypes.map(({ title, desc, icon: Icon }) => (
          <button
            key={title}
            onClick={() => setActive(title)}
            className={`surface flex min-h-24 items-center gap-4 p-4 text-left ${active === title ? "border-indigo-400 ring-4 ring-indigo-500/8" : ""}`}
          >
            <div
              className={`grid h-11 w-11 place-items-center rounded-xl ${active === title ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"}`}
            >
              <Icon size={19} />
            </div>
            <div>
              <p className="text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs text-slate-500">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-col sm:flex-row">
          <div>
            <CardTitle>{active}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              Live report for {selectedYear?.year ?? year.data?.year}.
            </p>
            {active === "Student statement" && selectedStudent && (
              <p className="mt-2 text-xs text-slate-500">
                Statement for {selectedStudent.first_name} {selectedStudent.last_name} ·{" "}
                {selectedStudent.admission_number}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!reportRows.length}
              onClick={exportCsv}
            >
              <FileSpreadsheet size={15} /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!reportRows.length}
              onClick={exportExcel}
            >
              <Download size={15} /> Excel
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={15} /> PDF / Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4 dark:bg-white/[.035]">
            <label>
              <span className="label">Academic year</span>
              <select
                className="field"
                value={academicYearId}
                onChange={(event) => {
                  setAcademicYearId(event.target.value);
                  setStudentId("all");
                }}
              >
                <option value="all">All academic years</option>
                {years.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">From</span>
              <input
                className="field"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              <span className="label">To</span>
              <input
                className="field"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <label>
              <span className="label">Class</span>
              <select
                className="field"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
              >
                <option value="all">All classes</option>
                {classes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Payment status</span>
              <select
                className="field"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                disabled={active === "Receipt register" || active === "Student statement"}
              >
                <option value="all">All statuses</option>
                <option>PAID</option>
                <option>PARTIALLY PAID</option>
                <option>UNPAID</option>
              </select>
            </label>
            {active === "Student statement" && (
              <label className="sm:col-span-2 lg:col-span-4">
                <span className="label">Student</span>
                <select
                  className="field"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                >
                  <option value="all">Choose a student</option>
                  {filteredStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name} · {student.admission_number} ·{" "}
                      {student.class_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Summary
              label="Total expected"
              value={money(summaryValues.expected)}
            />
            <Summary
              label="Total collected"
              value={money(summaryValues.collected)}
              green
            />
            <Summary
              label="Outstanding"
              value={money(summaryValues.outstanding)}
              amber
            />
          </div>

          <div className="mt-6 h-60">
            {chartRows.length ? (
              <ResponsiveContainer>
                <AreaChart data={chartRows}>
                  <CartesianGrid vertical={false} opacity={0.18} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Area
                    dataKey="amount"
                    stroke="#4f46e5"
                    fill="#c7d2fe"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                {active === "Student statement"
                  ? "Choose a student to load a statement."
                  : "No chart data matches the selected filters."}
              </div>
            )}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border dark:border-white/8">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/[.03]">
                <tr>
                  {Object.keys(reportRows[0] ?? { Message: "" }).map((header) => (
                    <th className="px-4 py-3" key={header}>
                      {header}
                    </th>
                  ))}
                  {active === "Receipt register" && <th className="px-4 py-3">Print</th>}
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row, index) => (
                  <tr className="border-t dark:border-white/7" key={index}>
                    {Object.values(row).map((value, valueIndex) => (
                      <td className="px-4 py-3" key={valueIndex}>
                        {typeof value === "number" ? money(value) : String(value)}
                      </td>
                    ))}
                    {active === "Receipt register" && (
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printReceipt(filteredPayments[index] as Payment)}
                        >
                          <Printer size={14} /> Receipt
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {!reportRows.length && (
              <div className="p-12 text-center text-sm text-slate-500">
                {active === "Student statement"
                  ? "Choose a student to view a statement."
                  : "No records match the selected report filters."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({
  label,
  value,
  green,
  amber,
}: {
  label: string;
  value: string;
  green?: boolean;
  amber?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${green ? "bg-emerald-50/60" : amber ? "bg-amber-50/60" : "bg-indigo-50/60"}`}
    >
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}
