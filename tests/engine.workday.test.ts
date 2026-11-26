import { describe, expect, it } from "vitest";
import { buildHolidaySet, holidaysWithin, isWorkingDay, mandays, workdayAdd } from "@/lib/engine";
import { holidays } from "./helpers";

const H = buildHolidaySet(holidays());

describe("workdayAdd (Sheets WORKDAY)", () => {
  it("n = 0 returns the start date", () => expect(workdayAdd("2027-01-06", 0, H)).toBe("2027-01-06"));
  it("skips weekends", () => expect(workdayAdd("2027-01-08", 1)).toBe("2027-01-11")); // Fri → Mon
  it("start + 25 working days gives Mandays = 25", () => {
    const end = workdayAdd("2027-01-06", 25, H)!;
    expect(mandays("2027-01-06", end, H)).toBe(25);
    expect(isWorkingDay(end, H)).toBe(true);
  });
  it("skips holidays from Holiday Management", () => {
    const hs = buildHolidaySet([{ holiday_date: "2027-01-07", exclude_from_working_days: true }]);
    expect(workdayAdd("2027-01-06", 1, hs)).toBe("2027-01-08");
    expect(holidaysWithin("2027-01-01", "2027-01-31", hs)).toEqual(["2027-01-07"]);
  });
  it("invalid input → null, never loops", () => {
    expect(workdayAdd("bad", 3)).toBeNull();
    expect(workdayAdd("2027-01-06", -1)).toBeNull();
  });
});
