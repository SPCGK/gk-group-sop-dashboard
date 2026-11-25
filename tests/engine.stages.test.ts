import { describe, expect, it } from "vitest";
import { PROGRESS_STAGES, exactStage, runEngine, sopProgress, sopStage, STAGE_LABEL } from "@/lib/engine";
import { newTask, workbookInput } from "./helpers";

describe("Tahap progres SOP", () => {
  it("defines 0 / 30 / 50 / 80 / 100 with stored workflow status", () => {
    expect(PROGRESS_STAGES.map((s) => [s.pct, s.status])).toEqual([
      [0, "Not Started"],
      [30, "In Progress"],
      [50, "In Progress"],
      [80, "In Progress"],
      [100, "Completed"],
    ]);
  });
  it("maps progress to the stage", () => {
    const st = (pct: number, status: "Not Started" | "In Progress" | "Completed" | "Hold" = pct === 0 ? "Not Started" : pct === 100 ? "Completed" : "In Progress") =>
      sopStage(sopProgress(newTask({ progress_percentage: pct, workflow_status: status })));
    expect(st(0)).toBe("not_started");
    expect(st(30)).toBe("bpo_discussion");
    expect(st(50)).toBe("drafting");
    expect(st(80)).toBe("final_review");
    expect(st(100)).toBe("completed");
    expect(st(65)).toBe("drafting"); // legacy value between stages → highest stage reached
    expect(st(10)).toBe("bpo_discussion");
    expect(st(50, "Hold")).toBe("hold");
    expect(sopStage(sopProgress(newTask({ progress_source: "legacy", progress_percentage: null as never })))).toBe("not_input");
  });
  it("workbook legacy values (M/N/O) land on the stages: N 30% / 50% / 80%", () => {
    const st = (n: number) => sopStage(sopProgress(newTask({ progress_source: "legacy", legacy_n: n, progress_percentage: null as never })));
    expect([st(0.3), st(0.5), st(0.8)]).toEqual(["bpo_discussion", "drafting", "final_review"]);
  });
  it("exactStage only matches stage values", () => {
    expect(exactStage(0.5)?.label).toBe("Drafting by SPC");
    expect(exactStage(0.65)).toBeNull();
    expect(exactStage(null)).toBeNull();
  });
  it("engine counts active SOPs per stage", () => {
    const r = runEngine(
      workbookInput({
        tasks: [
          newTask({ progress_percentage: 30, workflow_status: "In Progress" }),
          newTask({ progress_percentage: 80, workflow_status: "In Progress" }),
          newTask({ progress_percentage: 100, workflow_status: "Completed" }),
          newTask({ progress_percentage: 100, workflow_status: "Completed", is_active: false }),
        ],
      }),
    );
    expect(r.stages).toMatchObject({ bpo_discussion: 1, final_review: 1, completed: 1, drafting: 0 });
  });
  it("workbook data: Legal 1.1 = Drafting, GBU = Final Review, Pilar = BPO Discussion", () => {
    const r = runEngine(workbookInput());
    const by = (n: string) => r.tasks.find((t) => t.task_number === n)!;
    expect(sopStage(by("1.1").progress)).toBe("drafting");
    expect(sopStage(by("11.1").progress)).toBe("final_review");
    expect(sopStage(by("12.1").progress)).toBe("bpo_discussion");
  });
  it("labels", () => {
    expect(STAGE_LABEL.final_review).toBe("Final Review (Pre-BOD)");
  });
});
