// Talks to the Spring Boot backend. In development Vite forwards /api to it (see vite.config.ts).

export type Fund = { id: number; name: string };
export type SubGroup = { id: number; name: string };
export type Item = { id: number; fundId: number; name: string; systemKey: string | null; subgroups: SubGroup[] };
export type Catalog = { funds: Fund[]; items: Item[] };
export type ReceiptSummary = {
  id: number;
  receiptNumber: number;
  date: string;
  personName: string;
  totalHundredths: number;
  deleted: boolean;
  deleteReason: string | null;
};
export type LineView = {
  itemId: number | null;
  offering: boolean;
  subgroupId: number | null;
  itemName: string;
  subgroupName: string | null;
  fundName: string;
  amountHundredths: number;
};
export type ReceiptDetail = {
  id: number;
  receiptNumber: number;
  date: string;
  personName: string;
  deleted: boolean;
  deleteReason: string | null;
  totalHundredths: number;
  lines: LineView[];
};
export type LineInput = { itemId: number | null; offering: boolean; subgroupId: number | null; amount: string };
export type ReceiptInput = { receiptNumber: number; date: string; personName: string; lines: LineInput[] };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  } catch {
    throw new ApiError(0, "Cannot reach the treasury service. Make sure the backend is running, then try again.");
  }
  if (!res.ok) {
    let message = "Something went wrong. Try again.";
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* keep the default message */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const getCatalog = () => request<Catalog>("/api/catalog");
export const searchPeople = (q: string) => request<string[]>(`/api/people?q=${encodeURIComponent(q)}`);
export const getNextNumber = async () => (await request<{ number: number }>("/api/receipts/next-number")).number;
export const listReceipts = (date: string) => request<ReceiptSummary[]>(`/api/receipts?date=${encodeURIComponent(date)}`);
export const createReceipt = (body: ReceiptInput) =>
  request<ReceiptSummary>("/api/receipts", { method: "POST", body: JSON.stringify(body) });

export const searchReceipts = (p: { from?: string; to?: string; q?: string; includeDeleted?: boolean }) => {
  const qs = new URLSearchParams();
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  if (p.q?.trim()) qs.set("q", p.q.trim());
  if (p.includeDeleted) qs.set("includeDeleted", "true");
  return request<ReceiptSummary[]>(`/api/receipts/search?${qs.toString()}`);
};
export const getReceipt = (id: number) => request<ReceiptDetail>(`/api/receipts/${id}`);
export const updateReceipt = (id: number, body: ReceiptInput) =>
  request<ReceiptDetail>(`/api/receipts/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteReceipt = (id: number, reason: string) =>
  request<ReceiptDetail>(`/api/receipts/${id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" });
export const restoreReceipt = (id: number) => request<ReceiptDetail>(`/api/receipts/${id}/restore`, { method: "POST" });

// ---------- settings ----------
export type Settings = { churchName: string; address: string; treasurerName: string; currency: string; receiptFooter: string };
export const getSettings = () => request<Settings>("/api/settings");
export const saveSettings = (s: Settings) => request<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(s) });

// ---------- items and sub-groups ----------
export type SubAdmin = { id: number; name: string; used: boolean };
export type ItemAdmin = { id: number; name: string; systemKey: string | null; used: boolean; subgroups: SubAdmin[] };
export type FundAdmin = { id: number; name: string; items: ItemAdmin[] };
export type AdminCatalog = { funds: FundAdmin[] };
const json = (body: unknown) => JSON.stringify(body);
export const getAdminCatalog = () => request<AdminCatalog>("/api/items");
export const createItem = (name: string, fundId: number) => request<AdminCatalog>("/api/items", { method: "POST", body: json({ name, fundId }) });
export const renameItem = (id: number, name: string) => request<AdminCatalog>(`/api/items/${id}`, { method: "PUT", body: json({ name }) });
export const deleteItem = (id: number, reason: string) => request<AdminCatalog>(`/api/items/${id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" });
export const restoreItem = (id: number) => request<AdminCatalog>(`/api/items/${id}/restore`, { method: "POST" });
export const createSubgroup = (itemId: number, name: string) => request<AdminCatalog>(`/api/items/${itemId}/subgroups`, { method: "POST", body: json({ name }) });
export const renameSubgroup = (id: number, name: string) => request<AdminCatalog>(`/api/subgroups/${id}`, { method: "PUT", body: json({ name }) });
export const deleteSubgroup = (id: number, reason: string) => request<AdminCatalog>(`/api/subgroups/${id}?reason=${encodeURIComponent(reason)}`, { method: "DELETE" });
export const restoreSubgroup = (id: number) => request<AdminCatalog>(`/api/subgroups/${id}/restore`, { method: "POST" });

// ---------- reports ----------
export type SubTotal = { subgroupId: number | null; name: string; totalHundredths: number };
export type ItemTotal = { itemId: number; itemName: string; totalHundredths: number; subgroups: SubTotal[] };
export type FundTotal = { fundId: number; fundName: string; totalHundredths: number; items: ItemTotal[] };
export type SummaryReport = { from: string; to: string; receiptCount: number; grandTotalHundredths: number; funds: FundTotal[] };
export const getSummary = (from: string, to: string) => request<SummaryReport>(`/api/reports/summary?from=${from}&to=${to}`);

export type StatementLine = { itemName: string; subgroupName: string | null; fundName: string; amountHundredths: number };
export type StatementReceipt = { receiptId: number; receiptNumber: number; date: string; totalHundredths: number; lines: StatementLine[] };
export type ItemAmount = { itemKey: string; itemName: string; totalHundredths: number };
export type PersonStatement = {
  personName: string;
  from: string;
  to: string;
  itemFilter: string | null;
  totalHundredths: number;
  byItem: ItemAmount[];
  receipts: StatementReceipt[];
};
export const getPersonStatement = (name: string, from: string, to: string, item: string) =>
  request<PersonStatement>(
    `/api/reports/person?name=${encodeURIComponent(name)}&from=${from}&to=${to}${item ? `&item=${encodeURIComponent(item)}` : ""}`,
  );

// ---------- audit log and deleted ----------
export type AuditEntry = {
  id: number;
  ts: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
};
export type AuditCheck = { ok: boolean; entries: number; brokenAtId: number | null; problem: string | null };
export const searchAudit = (p: { from?: string; to?: string; action?: string; q?: string }) => {
  const qs = new URLSearchParams();
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  if (p.action) qs.set("action", p.action);
  if (p.q?.trim()) qs.set("q", p.q.trim());
  return request<AuditEntry[]>(`/api/audit?${qs.toString()}`);
};
export const verifyAudit = () => request<AuditCheck>("/api/audit/verify");

export type DeletedEntry = { type: "receipt" | "item" | "subgroup"; id: number; label: string; deletedAt: string; reason: string | null };
export const getDeleted = () => request<DeletedEntry[]>("/api/deleted");
