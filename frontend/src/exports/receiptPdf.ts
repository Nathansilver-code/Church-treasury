import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReceiptDetail, Settings } from "../api";
import { formatMoney } from "../lib/money";
import { TEAL, pdfFooter, pdfHeader } from "./common";
import type { Logo, PdfDoc } from "./common";

/** One person's receipt, on A5 paper. */
export function buildReceiptPdf(d: ReceiptDetail, settings: Settings, logo: Logo): ArrayBuffer {
  const doc: PdfDoc = new jsPDF({ unit: "mm", format: "a5" });
  const margin = 12;
  let y = pdfHeader(doc, settings, logo, `Receipt ${d.receiptNumber}`, [`Date: ${d.date}`], margin);

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 98, 110).text("Received from", margin, y + 2);
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(31, 41, 55).text(d.personName, margin, y + 8);
  y += 14;

  if (d.deleted) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(220, 38, 38).text("DELETED", doc.internal.pageSize.getWidth() - margin, y, { align: "right" });
  }

  autoTable(doc, {
    startY: y + 2,
    head: [["Item", "Fund", { content: `Amount (${settings.currency})`, styles: { halign: "right" } }]],
    body: [
      ...d.lines.map((l) => [
        l.subgroupName ? `${l.itemName}: ${l.subgroupName}` : l.itemName,
        l.fundName,
        { content: formatMoney(l.amountHundredths), styles: { halign: "right" } },
      ]),
      [
        { content: "Total", colSpan: 2, styles: { fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255] } },
        { content: formatMoney(d.totalHundredths), styles: { halign: "right", fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255] } },
      ],
    ] as never,
    theme: "grid",
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255] },
    styles: { fontSize: 9.5, cellPadding: 2, lineColor: [229, 231, 235] },
    columnStyles: { 1: { cellWidth: 28 }, 2: { cellWidth: 34 } },
    margin: { left: margin, right: margin, bottom: 16 },
  });

  let end = (doc.lastAutoTable?.finalY ?? y) + 8;
  if (settings.receiptFooter.trim()) {
    doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(90, 98, 110);
    doc.text(doc.splitTextToSize(settings.receiptFooter.trim(), doc.internal.pageSize.getWidth() - margin * 2), margin, end);
    end += 10;
  }
  if (settings.treasurerName.trim()) {
    end += 10;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(31, 41, 55);
    doc.setDrawColor(31, 41, 55).setLineWidth(0.2).line(margin, end, margin + 55, end);
    doc.text(`Treasurer: ${settings.treasurerName.trim()}`, margin, end + 4.5);
  }
  pdfFooter(doc, margin);
  return doc.output("arraybuffer");
}
