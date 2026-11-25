import { Badge } from "./ui";
import type { DerivedStatus } from "@/lib/engine/types";
import { STAGE_LABEL, sopStage, type SopProgress, type StageKey } from "@/lib/engine/progress";
import { CheckCircle2, CircleDashed, CircleDot, PauseCircle, CircleHelp, MessagesSquare, PenLine, ClipboardCheck } from "lucide-react";

export const STATUS_META: Record<DerivedStatus, { label: string; tone: "ok" | "info" | "neutral" | "warn"; color: string }> = {
  Completed: { label: "Completed", tone: "ok", color: "var(--ok)" },
  "In Progress": { label: "In Progress", tone: "info", color: "var(--info)" },
  "Not Started": { label: "Not Started", tone: "neutral", color: "var(--neutral)" },
  Hold: { label: "Hold", tone: "warn", color: "var(--warn)" },
  "Not Input": { label: "Belum diinput", tone: "neutral", color: "#cbd5e1" },
};

const ICON = { Completed: CheckCircle2, "In Progress": CircleDot, "Not Started": CircleDashed, Hold: PauseCircle, "Not Input": CircleHelp };

export function StatusBadge({ status }: { status: DerivedStatus }) {
  const m = STATUS_META[status];
  const Icon = ICON[status];
  return (
    <Badge tone={m.tone} className={status === "Not Input" ? "bg-white text-ink-3 ring-dashed" : ""}>
      <Icon className="size-3" aria-hidden />
      {m.label}
    </Badge>
  );
}

export function CategoryBadge({ type }: { type: string | null }) {
  if (!type) return <Badge tone="neutral">Tanpa kategori</Badge>;
  return <Badge tone={type === "CAT" ? "cat" : "additional"}>{type}</Badge>;
}

/** Tahapan progres: label, warna, dan ikon. Urutan = urutan tampil. */
export const STAGE_META: Record<StageKey, { label: string; pct: number | null; tone: "ok" | "info" | "neutral" | "warn" | "cat"; color: string; className?: string }> = {
  not_started: { label: "Not Started", pct: 0, tone: "neutral", color: "var(--neutral)" },
  bpo_discussion: { label: STAGE_LABEL.bpo_discussion, pct: 30, tone: "info", color: "#93c5fd", className: "bg-sky-50 text-sky-800 ring-sky-200" },
  drafting: { label: STAGE_LABEL.drafting, pct: 50, tone: "info", color: "#3b82f6" },
  final_review: { label: STAGE_LABEL.final_review, pct: 80, tone: "info", color: "#4338ca", className: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  completed: { label: "Completed", pct: 100, tone: "ok", color: "var(--ok)" },
  hold: { label: "Hold", pct: null, tone: "warn", color: "var(--warn)" },
  not_input: { label: "Belum diinput", pct: null, tone: "neutral", color: "#cbd5e1", className: "bg-white text-ink-3 ring-dashed" },
};

export const STAGE_ORDER: StageKey[] = ["not_started", "bpo_discussion", "drafting", "final_review", "completed", "hold", "not_input"];

const STAGE_ICON = { not_started: CircleDashed, bpo_discussion: MessagesSquare, drafting: PenLine, final_review: ClipboardCheck, completed: CheckCircle2, hold: PauseCircle, not_input: CircleHelp };

export function stageLabel(p: Pick<SopProgress, "status" | "value">): string {
  return STAGE_META[sopStage(p)].label;
}

/** Badge tahap progres SOP (0% Not Started · 30% BPO Discussion · 50% Drafting by SPC · 80% Final Review (Pre-BOD) · 100% Completed). */
export function StageBadge({ progress }: { progress: Pick<SopProgress, "status" | "value"> }) {
  const k = sopStage(progress);
  const m = STAGE_META[k];
  const Icon = STAGE_ICON[k];
  return (
    <Badge tone={m.tone} className={m.className} title={m.pct !== null ? `${m.pct}%` : undefined}>
      <Icon className="size-3" aria-hidden />
      {m.label}
    </Badge>
  );
}
