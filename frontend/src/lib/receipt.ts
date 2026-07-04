import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Payment } from "../types";
import { api } from "./api";
import { money, shortDate } from "./utils";

export async function generateReceipt(payment: Payment) {
  const paymentHistory =
      payment.payment_history?.length
        ? payment.payment_history
        : await api.paymentHistory(payment.student_id).catch(() => []),
    historyRows = paymentHistory.length
      ? paymentHistory
      : [payment],
    historyStartY = 176,
    historyRowHeight = 8,
    historyBlockHeight = 28 + historyRows.length * historyRowHeight,
    docHeight = Math.max(210, historyStartY + historyBlockHeight + 18);
  const settings = await api.settings().catch(() => ({
      school_name: "Apex International School",
      pta_name: "School PTA",
      receipt_footer: "Thank you for supporting our school community.",
      sms_enabled: false,
      sms_sender_name: "School PTA",
      sms_alert_template: "",
      online_payment_enabled: false,
      online_payment_note: "",
    })),
    doc = new jsPDF({ unit: "mm", format: [148, docHeight] }),
    qr = await QRCode.toDataURL(
      JSON.stringify({
        receipt: payment.receipt_number,
        student: payment.admission_number,
        amount: payment.amount_paid,
        date: payment.payment_date,
      }),
    );
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 148, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(settings.school_name.toUpperCase(), 74, 14, {
    align: "center",
    maxWidth: 130,
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${settings.pta_name} · Official Receipt`, 74, 22, {
    align: "center",
  });
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(payment.receipt_number, 12, 46);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("PAYMENT RECEIPT", 12, 52);
  const rows = [
    ["Student", payment.student_name],
    ["Admission number", payment.admission_number],
    ["Class", payment.class_name],
    ["Academic year", payment.academic_year],
    ["Payment date", shortDate(payment.payment_date)],
    ["Received by", payment.received_by_name],
  ];
  let y = 64;
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(label, 12, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(value, 60, y);
    y += 9;
  }
  doc.setFillColor(238, 242, 255);
  doc.roundedRect(10, 120, 128, 25, 3, 3, "F");
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(9);
  doc.text("AMOUNT RECEIVED", 16, 130);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(money(payment.amount_paid), 16, 140);
  doc.addImage(qr, "PNG", 105, 153, 27, 27);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total paid: ${money(payment.total_paid)}`, 12, 160);
  doc.text(`Outstanding: ${money(payment.outstanding_balance)}`, 12, 168);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, historyStartY, 128, historyBlockHeight, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("Payment history", 14, historyStartY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Date", 14, historyStartY + 16);
  doc.text("Receipt", 38, historyStartY + 16);
  doc.text("Method", 90, historyStartY + 16);
  doc.text("Amount", 132, historyStartY + 16, { align: "right" });
  let historyY = historyStartY + 23;
  for (const entry of historyRows) {
    const isCurrent = entry.id === payment.id;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, historyY - 4.5, 134, historyY - 4.5);
    doc.setFont("helvetica", isCurrent ? "bold" : "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(shortDate(entry.payment_date), 14, historyY);
    doc.text(String(entry.receipt_number), 38, historyY, { maxWidth: 48 });
    doc.text(
      String(entry.payment_method ?? "cash")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      90,
      historyY,
      { maxWidth: 30 },
    );
    doc.text(money(Number(entry.amount_paid)), 132, historyY, {
      align: "right",
    });
    historyY += historyRowHeight;
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(12, historyStartY + historyBlockHeight + 8, 136, historyStartY + historyBlockHeight + 8);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(settings.receipt_footer, 74, historyStartY + historyBlockHeight + 16, {
    align: "center",
    maxWidth: 120,
  });
  const blob = doc.output("blob"),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `${payment.receipt_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
