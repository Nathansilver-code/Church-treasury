import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { PersonStatement, ReceiptDetail, Settings, SummaryReport } from "../api";
import { logoFromBytes } from "./common";
import { buildReceiptPdf } from "./receiptPdf";
import { buildReportPdf, buildReportXlsx } from "./reportExport";
import { buildStatementPdf, buildStatementXlsx } from "./statementExport";

const logo = logoFromBytes(new Uint8Array(readFileSync("public/logo.png")));
const settings: Settings = { churchName: "Example Church", address: "Main Road", treasurerName: "A. Treasurer", currency: "UGX", receiptFooter: "Thank you for giving" };

const report: SummaryReport = {
  from: "2026-10-03", to: "2026-10-03", receiptCount: 2, grandTotalHundredths: 185100,
  funds: [
    { fundId: 1, fundName: "Trust Fund", totalHundredths: 120050, items: [
      { itemId: 1, itemName: "Tithe", totalHundredths: 70000, subgroups: [] },
      { itemId: 6, itemName: "Offerings 50%", totalHundredths: 50050, subgroups: [] } ] },
    { fundId: 2, fundName: "Local Fund", totalHundredths: 65050, items: [
      { itemId: 7, itemName: "Camp Expense", totalHundredths: 5000, subgroups: [] },
      { itemId: 12, itemName: "Lunch", totalHundredths: 10000, subgroups: [{ subgroupId: 1, name: "Group A", totalHundredths: 10000 }] },
      { itemId: 17, itemName: "LCB 50%", totalHundredths: 50050, subgroups: [] } ] },
  ],
};

const statement: PersonStatement = {
  personName: "Jane Doe", from: "2026-10-01", to: "2026-10-31", itemFilter: null, totalHundredths: 197650,
  byItem: [{ itemKey: "1", itemName: "Tithe", totalHundredths: 80000 }, { itemKey: "offering", itemName: "Offering", totalHundredths: 100100 }, { itemKey: "12", itemName: "Lunch", totalHundredths: 17550 }],
  receipts: [
    { receiptId: 1, receiptNumber: 1, date: "2026-10-03", totalHundredths: 160100, lines: [
      { itemName: "Tithe", subgroupName: null, fundName: "Trust Fund", amountHundredths: 50000 },
      { itemName: "Offering", subgroupName: null, fundName: "Both funds", amountHundredths: 100100 },
      { itemName: "Lunch", subgroupName: "Group A", fundName: "Local Fund", amountHundredths: 10000 } ] },
    { receiptId: 3, receiptNumber: 3, date: "2026-10-10", totalHundredths: 37550, lines: [
      { itemName: "Tithe", subgroupName: null, fundName: "Trust Fund", amountHundredths: 30000 },
      { itemName: "Lunch", subgroupName: "Group B", fundName: "Local Fund", amountHundredths: 7550 } ] },
  ],
};

const receipt: ReceiptDetail = {
  id: 1, receiptNumber: 12, date: "2026-10-03", personName: "Jane Doe", deleted: false, deleteReason: null, totalHundredths: 150100,
  lines: [
    { itemId: 1, offering: false, subgroupId: null, itemName: "Tithe", subgroupName: null, fundName: "Trust Fund", amountHundredths: 50000 },
    { itemId: null, offering: true, subgroupId: null, itemName: "Offering", subgroupName: null, fundName: "Both funds", amountHundredths: 100100 } ],
};

const isPdf = (b: ArrayBuffer) => new TextDecoder().decode(new Uint8Array(b).slice(0, 5)) === "%PDF-";

async function load(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe("Excel exports", () => {
  it("report has the logo, the church name and real formulas that add up", async () => {
    const wb = await load(await buildReportXlsx(report, settings, logo));
    const ws = wb.getWorksheet("Collections")!;
    expect(ws.getCell("A1").value).toBe("Example Church");
    expect(ws.getImages().length).toBe(1);
    const formulas: string[] = [];
    ws.eachRow((row) => row.eachCell((c) => { if (c.value && typeof c.value === "object" && "formula" in c.value) formulas.push(String(c.value.formula)); }));
    expect(formulas.some((f) => f.startsWith("SUM("))).toBe(true);        // the Lunch item over its sub-groups
    expect(formulas.length).toBeGreaterThanOrEqual(4);                    // item, 2 fund totals, grand total
    // the grand total formula points at the two fund total cells
    expect(formulas[formulas.length - 1]).toMatch(/^B\d+\+B\d+$/);
  });

  it("report with no money still opens and says so", async () => {
    const empty: SummaryReport = { ...report, receiptCount: 0, grandTotalHundredths: 0, funds: report.funds.map((f) => ({ ...f, totalHundredths: 0, items: [] })) };
    const ws = (await load(await buildReportXlsx(empty, settings, logo))).getWorksheet("Collections")!;
    let found = false;
    ws.eachRow((r) => r.eachCell((c) => { if (String(c.value).includes("No money was recorded")) found = true; }));
    expect(found).toBe(true);
  });

  it("statement has the logo, a total formula and a by-item sheet", async () => {
    const wb = await load(await buildStatementXlsx(statement, settings, logo, "All items"));
    const ws = wb.getWorksheet("Statement")!;
    expect(ws.getImages().length).toBe(1);
    expect(ws.getCell("A2").value).toBe("Statement for Jane Doe");
    let total: unknown;
    ws.eachRow((row) => row.eachCell((c) => { if (c.value && typeof c.value === "object" && "formula" in c.value) total = c.value; }));
    expect(total).toMatchObject({ formula: "SUM(D7:D11)" });
    expect(wb.getWorksheet("By item")).toBeTruthy();
  });
});

describe("PDF exports", () => {
  it("builds real PDFs", () => {
    expect(isPdf(buildReportPdf(report, settings, logo))).toBe(true);
    expect(isPdf(buildStatementPdf(statement, settings, logo, "All items"))).toBe(true);
    expect(isPdf(buildReceiptPdf(receipt, settings, logo))).toBe(true);
  });
  it("copes with empty data and an unset church name", () => {
    const blank: Settings = { churchName: "", address: "", treasurerName: "", currency: "UGX", receiptFooter: "" };
    const emptyStatement: PersonStatement = { ...statement, totalHundredths: 0, byItem: [], receipts: [] };
    expect(isPdf(buildStatementPdf(emptyStatement, blank, logo, "All items"))).toBe(true);
    expect(isPdf(buildReportPdf({ ...report, funds: report.funds.map((f) => ({ ...f, items: [] })), grandTotalHundredths: 0 }, blank, logo))).toBe(true);
  });
});
