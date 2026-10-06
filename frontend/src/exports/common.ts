import type { jsPDF } from "jspdf";
import type { Settings } from "../api";

export type Logo = { dataUrl: string };

export const TEAL: [number, number, number] = [0, 80, 76];
export const GOLD: [number, number, number] = [201, 162, 39];
export const TINT: [number, number, number] = [230, 242, 241];

/** Turns the logo image bytes into a PNG data URL that both PDF and Excel can embed. */
export function logoFromBytes(bytes: Uint8Array): Logo {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { dataUrl: `data:image/png;base64,${btoa(binary)}` };
}

/** The logo that ships with the app (public/logo.png). */
export async function loadLogo(): Promise<Logo> {
  const res = await fetch("./logo.png");
  return logoFromBytes(new Uint8Array(await res.arrayBuffer()));
}

export function downloadFile(data: ArrayBuffer, fileName: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PDF_MIME = "application/pdf";
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A safe file name part: letters, digits, dashes. */
export const slug = (s: string) => s.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "file";

export const churchLabel = (s: Settings) => s.churchName.trim() || "Church name not set";

export type PdfDoc = jsPDF & { lastAutoTable?: { finalY: number } };

/**
 * Draws the top of a page: church name and details on the left, the logo at the top right,
 * a teal rule with a thin gold line, then the title and sub-lines. Returns the y position below it.
 */
export function pdfHeader(doc: PdfDoc, s: Settings, logo: Logo, title: string, subLines: string[], margin = 14): number {
  const pageW = doc.internal.pageSize.getWidth();
  const logoSize = 20;
  doc.addImage(logo.dataUrl, "PNG", pageW - margin - logoSize, margin - 4, logoSize, logoSize);

  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TEAL);
  doc.text(churchLabel(s), margin, margin + 3);
  let y = margin + 3;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 98, 110);
  if (s.address.trim()) {
    y += 5;
    doc.text(s.address.trim(), margin, y);
  }
  y = Math.max(y + 7, margin + logoSize + 1);
  doc.setDrawColor(...TEAL).setLineWidth(0.8).line(margin, y, pageW - margin, y);
  doc.setDrawColor(...GOLD).setLineWidth(0.25).line(margin, y + 1.2, pageW - margin, y + 1.2);

  y += 8;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(31, 41, 55);
  doc.text(title, margin, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90, 98, 110);
  for (const line of subLines) {
    y += 5;
    doc.text(line, margin, y);
  }
  return y + 4;
}

/** Page numbers and the date it was made, at the bottom of every page. */
export function pdfFooter(doc: PdfDoc, margin = 14) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const made = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120, 128, 140);
    doc.text(`Made on ${made}`, margin, h - 8);
    doc.text(`Page ${i} of ${pages}`, w - margin, h - 8, { align: "right" });
  }
}
