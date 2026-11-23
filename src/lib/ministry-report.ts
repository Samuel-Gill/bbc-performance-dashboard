import {
  buildDashboard,
  formatPercent,
  kpiAchievement,
  RATING_PROGRESS_LABELS,
  summarizeBy,
} from "./domain";
import type { KPI, ObjectiveView } from "./domain";

/**
 * Downloadable, dependency-free PDF for the *already filtered* ministry rows.
 * This module only reads data and never modifies workbook or dashboard state.
 * Page streams use built-in PDF Helvetica; unsupported glyphs fall back to '?'.
 */
export type MinistryReportInput = {
  ministry: string;
  reportingDate: string;
  objectives: ObjectiveView[];
  kpis: KPI[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function printable(text: unknown): string {
  return String(text ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, "?");
}
function pdfEscape(text: unknown) {
  return printable(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function words(text: string, maxChars: number): string[] {
  const result: string[] = [];
  let line = "";
  for (const chunk of printable(text).split(/\s+/).filter(Boolean)) {
    // Break very long IDs/comments rather than extending beyond page width.
    const parts = chunk.match(new RegExp(`.{1,${maxChars}}`, "g")) || [];
    for (const part of parts) {
      if (!line) line = part;
      else if (line.length + part.length + 1 <= maxChars) line += " " + part;
      else { result.push(line); line = part; }
    }
  }
  if (line) result.push(line);
  return result.length ? result : ["-"];
}

export function createMinistryReportPdf(input: MinistryReportInput): Uint8Array {
  const rows = input.objectives.filter((o) => o.ministry === input.ministry);
  const ids = new Set(rows.map((o) => o.id));
  const kpis = input.kpis.filter((k) => ids.has(k.objectiveId));
  const summary = buildDashboard(rows, kpis);
  const sections = summarizeBy(rows, (o) => o.goalId);
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = PAGE_HEIGHT - MARGIN;
  const stroke = (x1: number, y1: number, x2: number, y2: number) =>
    commands.push(`0.85 0.85 0.87 RG 0.6 w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  const text = (value: unknown, x: number, atY: number, size = 10, bold = false, purple = false) =>
    commands.push(`${purple ? "0.22 0.09 0.35" : "0.13 0.16 0.23"} rg BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${atY.toFixed(1)} Tm (${pdfEscape(value)}) Tj ET`);
  const newPage = () => {
    if (commands.length) pages.push(commands);
    commands = [];
    y = PAGE_HEIGHT - MARGIN;
    commands.push(`0.22 0.09 0.35 rg 0 ${PAGE_HEIGHT - 16} ${PAGE_WIDTH} 16 re f`);
    text("BBC PERFOMANCE DASHBOARD", MARGIN, y, 12, true, true);
    y -= 18;
    text(`${input.ministry} | Reporting date ${input.reportingDate}`, MARGIN, y, 9);
    y -= 16;
    stroke(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y -= 23;
  };
  const ensure = (needed: number) => { if (y - needed < 56) newPage(); };
  const line = (value: unknown, options: {size?: number; bold?: boolean; indent?: number; gap?: number; purple?: boolean} = {}) => {
    const {size = 10, bold = false, indent = 0, gap = 15, purple = false} = options;
    ensure(gap);
    text(value, MARGIN + indent, y, size, bold, purple);
    y -= gap;
  };
  const wrapped = (value: unknown, indent = 0, size = 9) => {
    const width = CONTENT_WIDTH - indent;
    const maxChars = Math.max(10, Math.floor(width / (size * 0.53)));
    for (const part of words(String(value ?? ""), maxChars)) line(part, {indent, size, gap: size + 4});
  };
  const rule = () => { ensure(20); y -= 3; stroke(MARGIN, y, PAGE_WIDTH - MARGIN, y); y -= 17; };

  newPage();
  line("MINISTRY PERFORMANCE REPORT", {size: 17, bold: true, gap: 27, purple: true});
  line(`Objectives: ${summary.objectives}   Goals: ${summary.goals}   KPIs: ${summary.kpis}`, {bold: true});
  line(`Actual: ${formatPercent(summary.actual)}   Planned: ${formatPercent(summary.planned)}`);
  line(`Variance (percentage points): ${summary.variance === null ? "N/A" : (summary.variance * 100).toFixed(1)}`);
  line(`On track: ${summary.onTrack}   At risk: ${summary.atRisk}   Overdue: ${summary.overdue}   Completed: ${summary.completed}`);
  line(`Average KPI achievement: ${formatPercent(summary.kpi)}`);
  rule();
  line("GOAL-LEVEL PERFORMANCE", {size: 12, bold: true, gap: 19, purple: true});
  for (const goal of sections) {
    const goalTitle = rows.find((o) => o.goalId === goal.name)?.goalName || goal.name;
    wrapped(`${goal.name} - ${goalTitle} | ${goal.count} objectives | Actual ${formatPercent(goal.actual)} | Planned ${formatPercent(goal.planned)}`);
  }
  rule();
  line("OBJECTIVES", {size: 12, bold: true, gap: 19, purple: true});
  if (!rows.length) line("No objectives match the selected ministry and filters.");
  for (const o of rows) {
    ensure(72);
    wrapped(`${o.id} - ${o.description}`, 0, 10);
    line(`Goal: ${o.goalId} | Owner: ${o.owner} | Priority: ${o.priority}`, {size: 9, indent: 12});
    line(`Actual: ${formatPercent(o.actual)} | Planned: ${formatPercent(o.planned)} | Variance: ${o.variance === null ? "N/A" : (o.variance * 100).toFixed(1) + " points"}`, {size: 9, indent: 12});
    line(`Schedule status: ${o.rating} - ${RATING_PROGRESS_LABELS[o.rating] ?? "Unknown"} | Due: ${o.endDate}`, {size: 9, indent: 12});
    line(`KPI achievement: ${formatPercent(o.achievement)} | Exception score: ${o.exceptionScore} | ${o.overdue ? "Overdue" : "Not overdue"}`, {size: 9, indent: 12});
    if (o.comments.trim()) wrapped(`Comments: ${o.comments}`, 12);
    y -= 10;
  }
  rule();
  line("KPI DETAILS", {size: 12, bold: true, gap: 19, purple: true});
  if (!kpis.length) line("No linked KPIs for this selection.");
  for (const k of kpis) {
    ensure(55);
    wrapped(`${k.id}: ${k.name} (${k.objectiveId})`, 0, 10);
    line(`Target: ${k.target ?? "N/A"} ${k.unit} | Actual: ${k.actual ?? "N/A"} ${k.unit} | Achievement: ${formatPercent(kpiAchievement(k))}`, {size: 9, indent: 12});
    if (k.comment?.trim()) wrapped(`Comment: ${k.comment}`, 12);
    y -= 6;
  }
  pages.push(commands);

  // PDF object offsets are counted in bytes, not UTF-16 string positions.
  const encoder = new TextEncoder();
  const objects: string[] = [];
  const add = (obj: string) => { objects.push(obj); return objects.length; };
  const catalogId = add("");
  const pagesId = add("");
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds: number[] = [];
  for (const [idx, content] of pages.entries()) {
    const footer = `0.37 0.37 0.42 rg BT /F1 8 Tf 1 0 0 1 ${MARGIN} 30 Tm (BBC ministry report - ${idx + 1} / ${pages.length}) Tj ET`;
    const stream = content.join("\n") + "\n" + footer + "\n";
    const length = encoder.encode(stream).length;
    const contentsId = add(`<< /Length ${length} >>\nstream\n${stream}endstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentsId} 0 R >>`);
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const append = (s: string) => { const bytes = encoder.encode(s); chunks.push(bytes); offset += bytes.length; };
  append("%PDF-1.4\n%BBC\n");
  const offsets = [0];
  for (const [idx, object] of objects.entries()) {
    offsets.push(offset);
    append(`${idx + 1} 0 obj\n${object}\nendobj\n`);
  }
  const xref = offset;
  append(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const at of offsets.slice(1)) append(`${String(at).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const result = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}

export function downloadMinistryReportPdf(input: MinistryReportInput): void {
  const bytes = createMinistryReportPdf(input);
  // Use a copied ArrayBuffer for strict BlobPart typing across TS DOM versions.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], {type: "application/pdf"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BBC_${input.ministry.replace(/[^A-Za-z0-9_-]+/g, "_")}_${input.reportingDate}_Report.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
