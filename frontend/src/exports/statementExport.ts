import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PersonStatement, Settings } from "../api";
import { formatMoney } from "../lib/money";
import { TEAL, TINT, churchLabel, pdfFooter, pdfHeader } from "./common";
import type { Logo, PdfDoc } from "./common";

const periodText = (s: PersonStatement) => (s.from === s.to ? `Date: ${s.from}` : `Period: ${s.from} to ${s.to}`);
const lineName = (l: { itemName: string; subgroupName: string | null }) => (l.subgroupName ? `${l.itemName}: ${l.subgroupName}` : l.itemName);

export function buildStatementPdf(st: PersonStatement, settings: Settings, logo: Logo, itemLabel: string): ArrayBuffer {
  const doc: PdfDoc = new jsPDF({ unit: "mm", format: "a4" });
  const startY = pdfHeader(doc, settings, logo, `Statement for ${st.personName}`, [
    periodText(st),
    `Items: ${itemLabel}`,
    `Amounts in ${settings.currency}`,
  ]);

  autoTable(doc, {
    startY,
    head: [["Item", { content: `Total (${settings.currency})`, styles: { halign: "right" } }]],
    body: [
      ...st.byItem.map((i) => [i.itemName, { content: formatMoney(i.totalHundredths), styles: { halign: "right" } }]),
      [
        { content: "Total given", styles: { fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255] } },
        { content: formatMoney(st.totalHundredths), styles: { halign: "right", fontStyle: "bold", fillColor: TEAL, textColor: [255, 255, 255] } },
      ],
    ] as never,
    theme: "grid",
    headStyles: { fillColor: TEAL, textColor: [255, 255, 255] },
    styles: { fontSize: 10, cellPadding: 2.2, lineColor: [229, 231, 235] },
    columnStyles: { 1: { cellWidth: 45 } },
    margin: { left: 14, right: 14, bottom: 16 },
  });

  if (st.receipts.length === 0) {
    const y = (doc.lastAutoTable?.finalY ?? startY) + 10;
    doc.setFontSize(10).setTextColor(90, 98, 110).text("No receipts for this person in this period.", 14, y);
  } else {
    const rows: unknown[][] = [];
    for (const r of st.receipts) {
      r.lines.forEach((l, i) =>
        rows.push([
          i === 0 ? r.date : "",
          i === 0 ? String(r.receiptNumber) : "",
          lineName(l),
          { content: formatMoney(l.amountHundredths), styles: { halign: "right" } },
        ]),
      );
      rows.push([
        { content: `Receipt ${r.receiptNumber} total`, colSpan: 3, styles: { fontStyle: "bold", fillColor: TINT } },
        { content: formatMoney(r.totalHundredths), styles: { halign: "right", fontStyle: "bold", fillColor: TINT } },
      ]);
    }
    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY ?? startY) + 10,
      head: [["Date", "Receipt", "Item", { content: `Amount (${settings.currency})`, styles: { halign: "right" } }]],
      body: rows as never,
      theme: "grid",
      headStyles: { fillColor: TEAL, textColor: [255, 255, 255] },
      styles: { fontSize: 9.5, cellPadding: 2, lineColor: [229, 231, 235] },
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 20 }, 3: { cellWidth: 38 } },
      margin: { left: 14, right: 14, bottom: 16 },
    });
  }
  pdfFooter(doc);
  return doc.output("arraybuffer");
}

export async function buildStatementXlsx(st: PersonStatement, settings: Settings, logo: Logo, itemLabel: string): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const teal = "FF00504C";
  const money = "#,##0.00";
  const ws = wb.addWorksheet("Statement", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 14 }, { width: 10 }, { width: 40 }, { width: 20 }];

  ws.getCell("A1").value = churchLabel(settings);
  ws.getCell("A1").font = { bold: true, size: 15, color: { argb: teal } };
  ws.getCell("A2").value = `Statement for ${st.personName}`;
  ws.getCell("A2").font = { bold: true, size: 12 };
  ws.getCell("A3").value = `${periodText(st)}   |   Items: ${itemLabel}   |   Amounts in ${settings.currency}`;
  ws.getCell("A3").font = { color: { argb: "FF5A626E" } };
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 20;
  const imageId = wb.addImage({ base64: logo.dataUrl, extension: "png" });
  ws.addImage(imageId, { tl: { col: 3.45, row: 0.1 }, ext: { width: 72, height: 72 } });  // top right

  const head = ws.getRow(6);
  head.values = ["Date", "Receipt", "Item", `Amount (${settings.currency})`];
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } }));
  head.getCell(4).alignment = { horizontal: "right" };

  let row = 7;
  const first = row;
  for (const r of st.receipts) {
    for (const l of r.lines) {
      ws.getCell(`A${row}`).value = r.date;
      ws.getCell(`B${row}`).value = r.receiptNumber;
      ws.getCell(`C${row}`).value = lineName(l);
      ws.getCell(`D${row}`).value = l.amountHundredths / 100;
      ws.getCell(`D${row}`).numFmt = money;
      row++;
    }
  }
  const last = row - 1;
  row++;
  ws.getCell(`C${row}`).value = "Total given";
  ws.getCell(`D${row}`).value = last >= first ? { formula: `SUM(D${first}:D${last})`, result: st.totalHundredths / 100 } : 0;
  ws.getCell(`D${row}`).numFmt = money;
  ws.getRow(row).font = { bold: true };
  ws.getRow(row).border = { top: { style: "thin", color: { argb: "FF9CA3AF" } } };

  const by = wb.addWorksheet("By item");
  by.columns = [{ width: 40 }, { width: 20 }];
  by.getRow(1).values = ["Item", `Total (${settings.currency})`];
  by.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  by.getRow(1).eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teal } }));
  st.byItem.forEach((i, idx) => {
    by.getCell(`A${idx + 2}`).value = i.itemName;
    by.getCell(`B${idx + 2}`).value = i.totalHundredths / 100;
    by.getCell(`B${idx + 2}`).numFmt = money;
  });
  const tr = st.byItem.length + 2;
  by.getCell(`A${tr}`).value = "Total given";
  by.getCell(`B${tr}`).value = st.byItem.length > 0 ? { formula: `SUM(B2:B${tr - 1})`, result: st.totalHundredths / 100 } : 0;
  by.getCell(`B${tr}`).numFmt = money;
  by.getRow(tr).font = { bold: true };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
