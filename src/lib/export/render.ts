import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { EngineResult } from "../engine";
import { addDays, formatDateId, mondayOf, toDayNumber, todayJakarta } from "../engine/dates";
import { formatCell, type Report } from "./reports";

const BRAND = "FFD5AF26";
const INK = "FF111827";

export async function toXlsx(rep: Report, result: EngineResult, meta: { generatedBy: string }): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "GK Group SOP Dashboard 2027";
  wb.created = new Date();
  const ws = wb.addWorksheet(rep.title.slice(0, 31));
  ws.addRow([`GK Group – ${rep.title}`]).font = { bold: true, size: 14 };
  ws.addRow([`Dibuat ${formatDateId(todayJakarta())} oleh ${meta.generatedBy} · sumber: calculation engine`]).font = { color: { argb: "FF6B7280" }, size: 9 };
  for (const n of rep.notes) ws.addRow([n]).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
  ws.addRow([]);
  const header = ws.addRow(rep.columns.map((c) => c.header));
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: INK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.border = { bottom: { style: "thin" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  for (const row of rep.rows) {
    const r = ws.addRow(
      rep.columns.map((c) => {
        const v = row[c.key];
        if (v === null || v === undefined) return null;
        if (c.kind === "date" && typeof v === "string") return new Date(`${v}T00:00:00Z`);
        return v;
      }),
    );
    rep.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      if (c.kind === "pct") cell.numFmt = "0.00%";
      if (c.kind === "date") cell.numFmt = "dd mmm yyyy";
    });
  }
  rep.columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width ?? Math.max(10, c.header.length + 2)));
  ws.views = [{ state: "frozen", ySplit: header.number }];
  ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: rep.columns.length } };

  if (rep.type === "gantt") addGanttSheet(wb, result);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Weekly Gantt grid: planned weeks blue, completed share green (same geometry as the app). */
function addGanttSheet(wb: ExcelJS.Workbook, result: EngineResult) {
  const ws = wb.addWorksheet("Gantt (mingguan)");
  const tasks = result.tasks.filter((t) => t.start_date && t.end_date);
  if (!tasks.length) return;
  const start = mondayOf(tasks.reduce((m, t) => (t.start_date! < m ? t.start_date! : m), tasks[0].start_date!));
  const end = tasks.reduce((m, t) => (t.end_date! > m ? t.end_date! : m), tasks[0].end_date!);
  const weeks = Math.ceil((toDayNumber(end) - toDayNumber(start) + 1) / 7);
  const head = ws.addRow(["Task", "SOP", "Progress", ...Array.from({ length: weeks }, (_, i) => addDays(start, i * 7).slice(5).split("-").reverse().join("/"))]);
  head.font = { bold: true, size: 8 };
  for (const t of tasks) {
    const row = ws.addRow([t.task_number, t.sop_name, t.progress.value ?? null]);
    row.getCell(3).numFmt = "0%";
    const s = toDayNumber(t.start_date!);
    const e = toDayNumber(t.end_date!);
    const progEnd = s + Math.floor((e - s + 1) * Math.max(0, Math.min(1, t.progress.value ?? 0))) - 1;
    for (let w = 0; w < weeks; w++) {
      const ws0 = toDayNumber(start) + w * 7;
      const we = ws0 + 6;
      if (we < s || ws0 > e) continue;
      const cell = row.getCell(4 + w);
      const done = progEnd >= ws0 && progEnd >= s;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: done ? "FF16A34A" : t.overdue ? "FFFCA5A5" : "FF93C5FD" } };
    }
  }
  ws.getColumn(1).width = 7;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 8;
  for (let w = 0; w < weeks; w++) ws.getColumn(4 + w).width = 4.2;
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 1 }];
}

export function toPdf(rep: Report, result: EngineResult, meta: { generatedBy: string }): ArrayBuffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(213, 175, 38);
  doc.rect(0, 0, 297, 4, "F");
  doc.setFontSize(14);
  doc.setTextColor(17, 24, 39);
  doc.text(`GK Group – ${rep.title}`, 12, 14);
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(`Dibuat ${formatDateId(todayJakarta())} oleh ${meta.generatedBy} · sumber: calculation engine`, 12, 19);
  let y = 23;
  for (const n of rep.notes) {
    doc.text(n, 12, y);
    y += 4;
  }
  if (rep.type === "gantt") {
    y = drawGantt(doc, result, y + 2);
    doc.addPage();
    y = 14;
  }
  autoTable(doc, {
    startY: y + 2,
    head: [rep.columns.map((c) => c.header)],
    body: rep.rows.map((r) => rep.columns.map((c) => formatCell(r[c.key] ?? null, c.kind))),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [213, 175, 38], textColor: [17, 24, 39], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 251] },
    margin: { left: 10, right: 10 },
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Halaman ${i} / ${pages}`, 287, 205, { align: "right" });
  }
  return doc.output("arraybuffer");
}

function drawGantt(doc: jsPDF, result: EngineResult, top: number): number {
  const tasks = result.tasks.filter((t) => t.start_date && t.end_date);
  if (!tasks.length) return top;
  const s0 = tasks.reduce((m, t) => (t.start_date! < m ? t.start_date! : m), tasks[0].start_date!).slice(0, 8) + "01";
  const e0 = tasks.reduce((m, t) => (t.end_date! > m ? t.end_date! : m), tasks[0].end_date!);
  const d0 = toDayNumber(s0);
  const span = toDayNumber(e0) - d0 + 1;
  const left = 80, right = 287, rowH = Math.min(5, (195 - top - 8) / tasks.length);
  const scale = (right - left) / span;
  doc.setFontSize(6);
  // month grid
  let cur = s0;
  while (toDayNumber(cur) <= toDayNumber(e0)) {
    const x = left + (toDayNumber(cur) - d0) * scale;
    doc.setDrawColor(229, 231, 235);
    doc.line(x, top, x, top + 6 + tasks.length * rowH);
    doc.setTextColor(107, 114, 128);
    doc.text(formatDateId(cur).slice(3), x + 1, top + 3.5);
    const [y, m] = cur.split("-").map(Number);
    cur = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  }
  tasks.forEach((t, i) => {
    const y = top + 6 + i * rowH;
    doc.setTextColor(17, 24, 39);
    doc.text(`${t.task_number} ${t.sop_name}`.slice(0, 58), 10, y + rowH * 0.7);
    const x = left + (toDayNumber(t.start_date!) - d0) * scale;
    const len = (toDayNumber(t.end_date!) - toDayNumber(t.start_date!) + 1) * scale;
    doc.setFillColor(191, 219, 254);
    doc.rect(x, y + 0.6, Math.max(len, 0.6), rowH - 1.2, "F");
    const pd = Math.floor((toDayNumber(t.end_date!) - toDayNumber(t.start_date!) + 1) * Math.max(0, Math.min(1, t.progress.value ?? 0)));
    if (pd > 0) {
      doc.setFillColor(t.progress.status === "Completed" ? 22 : 43, t.progress.status === "Completed" ? 163 : 108, t.progress.status === "Completed" ? 74 : 176);
      doc.rect(x, y + 0.6, pd * scale, rowH - 1.2, "F");
    }
    if (t.overdue) {
      doc.setDrawColor(220, 38, 38);
      doc.rect(x, y + 0.6, Math.max(len, 0.6), rowH - 1.2, "S");
    }
  });
  const today = todayJakarta();
  const td = toDayNumber(today) - d0;
  if (td >= 0 && td <= span) {
    doc.setDrawColor(220, 38, 38);
    doc.line(left + td * scale, top, left + td * scale, top + 6 + tasks.length * rowH);
  }
  return top + 6 + tasks.length * rowH + 4;
}
