import { Badge } from "./ui";
import type { DerivedStatus } from "@/lib/engine/types";
import { CheckCircle2, CircleDashed, CircleDot, PauseCircle, CircleHelp } from "lucide-react";

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
