import { z } from "zod";
import { isValidIsoDate } from "./engine/dates";
import { validateStatusProgress } from "./engine/progress";
import { DOC_CLASSES, HOLIDAY_CATEGORIES, TASK_TYPES, WORKFLOW_STATUSES, type SopTask } from "./engine/types";
import { normalizeName } from "./import/spc-parser";

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine((v) => v === null || isValidIsoDate(v), { message: "Format tanggal tidak valid." });

export const sopInputSchema = z
  .object({
    organization_id: z.string().uuid({ message: "Divisi/Departemen/Business Unit wajib dipilih." }),
    sop_name: z.string().trim().min(1, "Nama SOP wajib diisi.").max(300, "Nama SOP maksimal 300 karakter."),
    task_type: z.enum(TASK_TYPES, { errorMap: () => ({ message: "Jenis tugas (CAT/Additional) wajib dipilih." }) }),
    document_classification: z.enum(DOC_CLASSES, { errorMap: () => ({ message: "Pilih New atau Revision." }) }),
    critical: z.boolean(),
    start_date: optionalDate,
    end_date: optionalDate,
    remark: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((v, ctx) => {
    if ((v.start_date && !v.end_date) || (!v.start_date && v.end_date)) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "Isi Start Date dan End Date bersamaan." });
    }
    if (v.start_date && v.end_date && v.end_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "End Date tidak boleh lebih awal daripada Start Date." });
    }
  });

export type SopInput = z.infer<typeof sopInputSchema>;

export const progressInputSchema = z
  .object({
    workflow_status: z.enum(WORKFLOW_STATUSES),
    progress_percentage: z.coerce.number(),
    actual_end_date: optionalDate,
  })
  .superRefine((v, ctx) => {
    const msg = validateStatusProgress(v.workflow_status, v.progress_percentage);
    if (msg) ctx.addIssue({ code: "custom", path: ["progress_percentage"], message: msg });
  });

export const organizationSchema = z.object({
  organization_name: z.string().trim().min(1, "Nama organisasi wajib diisi.").max(150),
  organization_code: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const holidaySchema = z.object({
  holiday_date: z.string().refine(isValidIsoDate, "Tanggal tidak valid."),
  holiday_name: z.string().trim().min(1, "Nama hari libur wajib diisi.").max(200),
  category: z.enum(HOLIDAY_CATEGORIES),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  exclude_from_working_days: z.boolean(),
  source: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const weightsSchema = z
  .object({ cat: z.coerce.number().min(0).max(100), additional: z.coerce.number().min(0).max(100) })
  .refine((w) => Math.abs(w.cat + w.additional - 100) < 1e-9, { message: "Total bobot harus 100%." });

/** Detects an accidental duplicate: same organization + same normalized name among active SOPs. */
export function findDuplicateSop(
  tasks: readonly Pick<SopTask, "id" | "organization_id" | "sop_name" | "is_active" | "task_number">[],
  organizationId: string,
  name: string,
  excludeId?: string,
) {
  const n = normalizeName(name);
  return (
    tasks.find((t) => t.is_active && t.id !== excludeId && t.organization_id === organizationId && normalizeName(t.sop_name) === n) ??
    null
  );
}

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join(".") || "_form";
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
