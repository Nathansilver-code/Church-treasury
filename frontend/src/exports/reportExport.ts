import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Settings, SummaryReport } from "../api";
import { formatMoney } from "../lib/money";
import { TEAL, TINT, churchLabel, pdfFooter, pdfHeader } from "./common";
import type { Logo, PdfDoc } from "./common";

const periodText = (r: SummaryReport) => (r.from === r.to ? `Date: ${r.from}` : `Period: ${r.from} to ${r.to}`);

export function buildReportPdf(report: SummaryReport, settings: Settings, logo: Logo): ArrayBuffer {
  const doc: PdfDoc = new jsPDF({ unit: "mm", format: "a4" });
  const startY = pdfHeader(doc, settings, logo, "Collections report", [
    periodText(report),
    `Receipts counted: ${report.receiptCount}`,
    `Amounts in ${settings.currency}`,
  ]);

  type Cell = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const body: Cell[][] = [];
  for (const fund of report.funds.filter((f) => f.items.length > 0)) {
    body.push([{ content: fund.fundName, colSpan: 2, styles: { fontStyle: "bold", fillColor: TINT, textColor: TEAL } }]);
    for (const item of fund.items) {
      body.push([item.itemName, { content: formatMoney(item.totalHundredths), styles: { halign: "right" } }]);
      for (const sub of item.subgroups) {
        body.push([
          { content: `      ${sub.name}`, styles: { textColor: [90, 98, 110], fontSize: 9 } },
          { content: formatMoney(sub.totalHundredths), styles: { halign: "right", textColor: [90, 98, 110], fontSize: 9 } },
        ]);
      }
    }
    body.push([
      { content: `${fund.fundName} total`, styles: { fontStyle: "bold" } },
      { content: formatMoney(fund.totalHundredths), styles: { halign: "right", fontStyle: "bold" } },
    ]);
  }
  if (body.length === 0) {
    body.push([{ content: "No money was recorded in this period.", colSpan: 2, styles: { textColor: [90, 98, 110] } }]);
  }
  body.push([
    { content: "Grand total", styles: { fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255] } },
    { content: formatMoney(report.grandTotalHundredths), styles: { halign: "right", fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255] } },
  ]);

  autoTable(doc, {
    startY,
    head: [["Item", { content: `Amount (${settings.currency})`, styles: { halign: "right" } }]],
    body: body as never,
    theme: "grid",
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 2.2, lineColor: [229, 231, 235] },
    columnStyles: { 1: { cellWidth: 45 } },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  if (settings.treasurerName.trim()) {
    const y = (doc.lastAutoTable?.finalY ?? startY) + 18;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(31, 41, 55);
    doc.setDrawColor(31, 41, 55).setLineWidth(0.2).line(14, y, 84, y);
    doc.text(`Treasurer: ${settings.treasurerName.trim()}`, 14, y + 5);
  }
  pdfFooter(doc);
  return doc.output("arraybuffer");
}

export async function buildReportXlsx(report: SummaryReport, settings: Settings, logo: Logo): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Collections", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 44 }, { width: 20 }];
  const money = "#,##0.00";
  const teal = "FF00504C";

  ws.getCell("A1").value = churchLabel(settings);
  ws.getCell("A1").font = { bold: true, size: 15, color: { argb: teal } };
  ws.getCell("A2").value = settings.address;
  ws.getCell("A2").font = { color: { argb: "FF5A626E" } };
  ws.getCell("A3").value = "Collections report";
  ws.getCell("A3").font = { bold: true, size: 12 };
  ws.getCell("A4").value = `${periodText(report)}   |   Receipts counted: ${report.receiptCount}   |   Amounts in ${settings.currency}`;
  ws.getCell("A4").font = { color: { argb: "FF5A626E" } };
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 20;

  // the logo sits at the top right (over the right-hand column)
  const imageId = wb.addImage({ base64: logo.dataUrl, extension: "png" });
  ws.addImage(imageId, { tl: { col: 1.45, row: 0.1 }, ext: { width: 72, height: 72 } });

  let row = 6;
  const header = ws.getRow(row);
  header.values = ["Item", `Amount (${settings.currency})`];
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } }));
  header.getCell(2).alignment = { horizontal: "right" };
  row++;

  const fundTotalCells: string[] = [];
  const fundTotalValues: number[] = [];
  for (const fund of report.funds.filter((f) => f.items.length > 0)) {
    const fh = ws.getRow(row++);
    fh.getCell(1).value = fund.fundName;
    fh.font = { bold: true, color: { argb: teal } };
    fh.eachCell({ includeEmpty: true }, (c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2F1" } }));

    const itemCells: string[] = [];
    for (const item of fund.items) {
      const itemRow = row++;
      ws.getCell(`A${itemRow}`).value = item.itemName;
      itemCells.push(`B${itemRow}`);
      if (item.subgroups.length > 0) {
        const first = row;
        for (const sub of item.subgroups) {
          ws.getCell(`A${row}`).value = sub.name;
          ws.getCell(`A${row}`).alignment = { indent: 2 };
          ws.getCell(`A${row}`).font = { color: { argb: "FF5A626E" } };
          ws.getCell(`B${row}`).value = sub.totalHundredths / 100;
          ws.getCell(`B${row}`).numFmt = money;
          ws.getCell(`B${row}`).font = { color: { argb: "FF5A626E" } };
          row++;
        }
        // the item's amount is a real formula over its sub-groups
        ws.getCell(`B${itemRow}`).value = { formula: `SUM(B${first}:B${row - 1})`, result: item.totalHundredths / 100 };
      } else {
        ws.getCell(`B${itemRow}`).value = item.totalHundredths / 100;
      }
      ws.getCell(`B${itemRow}`).numFmt = money;
    }
    const totalRow = row++;
    ws.getCell(`A${totalRow}`).value = `${fund.fundName} total`;
    ws.getCell(`B${totalRow}`).value = { formula: itemCells.join("+"), result: fund.totalHundredths / 100 };
    ws.getCell(`B${totalRow}`).numFmt = money;
    ws.getRow(totalRow).font = { bold: true };
    ws.getRow(totalRow).border = { top: { style: "thin", color: { argb: "FF9CA3AF" } } };
    fundTotalCells.push(`B${totalRow}`);
    fundTotalValues.push(fund.totalHundredths / 100);
    row++;
  }

  if (fundTotalCells.length === 0) {
    ws.getCell(`A${row}`).value = "No money was recorded in this period.";
    row += 2;
  }
  const grand = ws.getRow(row);
  grand.getCell(1).value = "Grand total";
  grand.getCell(2).value =
    fundTotalCells.length > 0
      ? { formula: fundTotalCells.join("+"), result: report.grandTotalHundredths / 100 }
      : 0;
  grand.getCell(2).numFmt = money;
  grand.font = { bold: true, color: { argb: "FFFFFFFF" } };
  grand.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } }));

  if (settings.treasurerName.trim()) {
    ws.getCell(`A${row + 3}`).value = `Treasurer: ${settings.treasurerName.trim()}`;
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
