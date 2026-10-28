import { describe, expect, it } from "vitest";
import { CHURCH_ROLES, RATING_LABELS, RATING_PROGRESS_LABELS, DEFAULT_LISTS, objectiveViews } from "./domain";
import { fixtureData } from "./test-workbook";

// Labels are presentation metadata only: changing them must not change numeric scoring.
describe("church rating and role reference", () => {
  it("matches the approved five-step rating vocabulary", () => {
    expect(Object.values(RATING_LABELS)).toEqual([
      "Red — Significantly Behind", "Amber — Behind Schedule", "Yellow — On Schedule",
      "Light Green — Slightly Ahead", "Green — Ahead of Schedule",
    ]);
    expect(Object.values(RATING_PROGRESS_LABELS)).toEqual([
      "Significantly Behind Schedule", "Behind schedule", "On Schedule",
      "Slightly Ahead of Schedule", "Ahead of Schedule",
    ]);
    expect(CHURCH_ROLES).toEqual([
      "Chairperson", "Vice Chairperson", "Team Lead", "Team Member", "Office Staff",
      "Ministerial Staff", "Vendor", "Community Rep", "Church member", "HR Business Partner",
    ]);
    expect(DEFAULT_LISTS.roles).toEqual(CHURCH_ROLES);
  });
  it("does not change overdue flags or exception severity", () => {
    const data = fixtureData();
    const v = objectiveViews(data, "2026-10-27");
    expect(v.find(o => o.id === "OBJ003")?.exceptionScore).toBe(125);
  });
});
