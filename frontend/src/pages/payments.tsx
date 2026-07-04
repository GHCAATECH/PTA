import { useMemo, useState } from "react";
import { Download, Plus, Printer, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { usePayments } from "../hooks/use-data";
import { printReceipt } from "../lib/print-receipt";
import { money, shortDate } from "../lib/utils";

const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
export default function Payments() {
  const { data = [], isLoading, isError } = usePayments(),
    [search, setSearch] = useState(""),
    [date, setDate] = useState(""),
    [method, setMethod] = useState("all"),
    [page, setPage] = useState(1);
  const pageSize = 20;
  const filtered = useMemo(
    () =>
      data.filter((p) => {
        const q = search.toLowerCase();
        return (
          (!q ||
            `${p.student_name} ${p.receipt_number} ${p.admission_number}`
              .toLowerCase()
              .includes(q)) &&
          (!date || p.payment_date === date) &&
          (method === "all" || p.payment_method === method)
        );
      }),
    [data, search, date, method],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    rows = filtered.slice(
      (Math.min(page, pages) - 1) * pageSize,
      Math.min(page, pages) * pageSize,
    );
  const exportCsv = () => {
    const columns = [
      "Receipt",
      "Student",
      "Admission number",
      "Class",
      "Date",
      "Method",
      "Received by",
      "Amount",
    ];
    const text = [
      columns.map(csvCell).join(","),
      ...filtered.map((p) =>
        [
          p.receipt_number,
          p.student_name,
          p.admission_number,
          p.class_name,
          p.payment_date,
          p.payment_method,
          p.received_by_name,
          p.amount_paid,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\r\n");
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([text], { type: "text/csv;charset=utf-8" }),
      );
    a.href = url;
    a.download = "pta-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  if (isLoading)
    return (
      <div className="h-80 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
    );
  if (isError)
    return (
      <Card className="p-10 text-center text-sm text-rose-600">
        Payments could not be loaded.
      </Card>
    );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={!filtered.length}
        >
          <Download size={16} /> Export CSV
        </Button>
        <Button asChild>
          <Link to="/payments/new">
            <Plus size={17} /> Record payment
          </Link>
        </Button>
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
              placeholder="Search receipt, student, or admission number…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <input
            className="field sm:w-44"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="field sm:w-44"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All methods</option>
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile money</option>
            <option value="bank_deposit">Bank deposit</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-white/[.03]">
              <tr>
                <th className="px-5 py-3">Receipt</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Received by</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/7">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-4 font-mono text-xs font-bold text-indigo-600">
                    {p.receipt_number}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold">{p.student_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.admission_number} · {p.class_name}
                    </p>
                  </td>
                  <td className="px-4 py-3">{shortDate(p.payment_date)}</td>
                  <td className="px-4 py-3">{p.received_by_name}</td>
                  <td className="px-4 py-3 text-right font-extrabold">
                    {money(p.amount_paid)}
                  </td>
                  <td className="px-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => printReceipt(p)}
                      title="Print receipt"
                    >
                      <Printer size={17} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-slate-100 md:hidden dark:divide-white/7">
          {rows.map((p) => (
            <div key={p.id} className="p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-bold">{p.student_name}</p>
                  <p className="font-mono text-[11px] text-indigo-600">
                    {p.receipt_number}
                  </p>
                </div>
                <strong>{money(p.amount_paid)}</strong>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {shortDate(p.payment_date)} · {p.class_name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printReceipt(p)}
                >
                  <Printer size={14} /> Receipt
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!rows.length && (
          <div className="p-12 text-center text-sm text-slate-500">
            No payments match these filters.
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200/70 p-4 text-xs text-slate-500 dark:border-white/8">
          <span>
            {filtered.length} payments · Page {Math.min(page, pages)} of {pages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
