import { describe, it, expect } from "vitest";
import type { DataSet, Goal, Objective, KPI, Update } from "./domain";
import { blankData, seedIdCounters, validateRelationships } from "./domain";
import { saveRecordData, deleteRecordData } from "./records";
import fixture from "./fixtures/workbook-calculations.json";
const data = () => structuredClone(fixture.data) as DataSet;
const goalForm = {
  title: "New strategic goal",
  owner: "Church leader",
  description: "Serve our community",
  active: "Active",
};
export const objectiveForm = {
  goalId: "G001",
  description: "New ministry objective",
  ministry: "New ministry",
  role: "Team Lead",
  owner: "Church leader",
  rating: "4",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  actual: "25",
  status: "In Progress",
  priority: "High",
  lastUpdateDate: "2026-10-27",
  updatedBy: "Analyst",
  comments: "New objective",
};
export const kpiForm = {
  objectiveId: "OBJ001",
  name: "Volunteers trained",
  description: "",
  unit: "Count",
  target: "20",
  actual: "10",
  measurementDate: "2026-10-27",
  comment: "",
};
export const updateForm = {
  objectiveId: "OBJ001",
  date: "2026-10-27",
  actual: "75",
  rating: "5",
  achievement: "125",
  comment: "A new historical snapshot",
  applyToCurrent: "false",
};

describe("Automatic IDs and safe mutations", () => {
  it("creates successive goals and objectives without manual identifiers", () => {
    let d = data();
    let result = saveRecordData(d, "goal", goalForm);
    expect(result.record.id).toBe("G006");
    d = result.data;
    result = saveRecordData(d, "goal", { ...goalForm, title: "Another goal" });
    expect(result.record.id).toBe("G007");
    d = result.data;
    result = saveRecordData(d, "objective", {
      ...objectiveForm,
      goalId: "G006",
    });
    expect(result.record.id).toBe("OBJ021");
    result = saveRecordData(result.data, "objective", {
      ...objectiveForm,
      goalId: "G006",
    });
    expect(result.record.id).toBe("OBJ022");
    expect(validateRelationships(result.data)).toEqual([]);
  });
  it("seeds counters before deletion of an imported highest ID", () => {
    const d = data();
    d.goals.push({ ...d.goals[0], id: "G900" });
    const deleted = deleteRecordData(d, "goal", "G900");
    expect(saveRecordData(deleted, "goal", goalForm).record.id).toBe("G901");
  });
  it("retains deleted IDs and respects persistent high-water counters", () => {
    const added = saveRecordData(data(), "goal", goalForm);
    const deleted = deleteRecordData(added.data, "goal", added.record.id);
    expect(saveRecordData(deleted, "goal", goalForm).record.id).toBe("G007");
    const restored = structuredClone(deleted);
    expect(saveRecordData(restored, "goal", goalForm).record.id).toBe("G007");
  });
  it("handles unsorted IDs, gaps, imported higher IDs and padded update IDs", () => {
    const d = data();
    d.goals.reverse();
    d.objectives.push({ ...d.objectives[0], id: "OBJ850" });
    const result = saveRecordData(d, "objective", objectiveForm);
    expect(result.record.id).toBe("OBJ851");
    expect(saveRecordData(d, "update", updateForm).record.id).toBe("UPD0081");
  });
  it("blocks parent deletion until related records are removed", () => {
    expect(() => deleteRecordData(data(), "goal", "G001")).toThrow(
      "linked to objectives",
    );
    expect(() => deleteRecordData(data(), "objective", "OBJ001")).toThrow(
      "historical updates",
    );
  });
  it("preserves IDs while editing and removes only selected records", () => {
    const d = data();
    const result = saveRecordData(
      d,
      "goal",
      { ...goalForm, title: "Edited" },
      d.goals[0],
    );
    expect((result.record as Goal).id).toBe("G001");
    expect(result.data.goals).toHaveLength(5);
    expect(deleteRecordData(d, "kpi", "KPI001").kpis).toHaveLength(37);
    expect(d.kpis).toHaveLength(38);
  });
  it("allows a blank workspace to create its first IDs in the domain layer", () => {
    const d = saveRecordData(blankData(), "goal", goalForm);
    expect(d.record.id).toBe("G001");
    expect(seedIdCounters(d.data).idHighWater?.G).toBe(2);
  });
});

describe("Current objective and historical snapshots", () => {
  it("keeps new snapshots separate from current values by default", () => {
    const d = data(),
      old = d.objectives[0];
    const result = saveRecordData(d, "update", updateForm);
    expect(result.data.objectives[0]).toEqual(old);
    expect(result.data.updates).toHaveLength(81);
    expect((result.record as Update).achievement).toBe(1.25);
  });
  it("applies a newer snapshot only when explicitly selected", () => {
    const result = saveRecordData(data(), "update", {
      ...updateForm,
      applyToCurrent: "true",
      updatedBy: "Recorder",
    });
    expect(result.data.objectives[0]).toMatchObject({
      actual: 0.75,
      rating: 5,
      lastUpdateDate: "2026-10-27",
      updatedBy: "Recorder",
    });
  });
  it("rejects applying backdated history without losing the snapshot workflow", () => {
    expect(() =>
      saveRecordData(data(), "update", {
        ...updateForm,
        date: "2025-01-01",
        applyToCurrent: "true",
      }),
    ).toThrow("predates");
    expect(
      saveRecordData(data(), "update", { ...updateForm, date: "2025-01-01" })
        .data.updates,
    ).toHaveLength(81);
  });
  it("editing and deleting history does not rewind current progress", () => {
    const d = data(),
      old = d.objectives[0],
      u = d.updates[0];
    const edited = saveRecordData(
      d,
      "update",
      { ...updateForm, actual: "1" },
      u,
    );
    expect(edited.data.objectives[0]).toEqual(old);
    expect(deleteRecordData(edited.data, "update", u.id).objectives[0]).toEqual(
      old,
    );
  });
  it("writes canonical Objective Progress based on rating and updates the status when applying history", () => {
    const legacy = { ...objectiveForm, rating: "2", status: "On Hold" };
    const saved = saveRecordData(data(), "objective", legacy);
    expect((saved.record as Objective).status).toBe("Behind schedule");
    const updated = saveRecordData(data(), "update", { ...updateForm, applyToCurrent: "true" });
    expect(updated.data.objectives[0].status).toBe("Ahead of Schedule");
  });

  it("automatically records history when completion/rating changes in the objective editor", () => {
    const d = data(),
      result = saveRecordData(d, "objective", objectiveForm, d.objectives[0]);
    expect((result.record as Objective).id).toBe("OBJ001");
    expect(result.data.updates.at(-1)).toMatchObject({
      id: "UPD0081",
      objectiveId: "OBJ001",
      actual: 0.25,
      date: "2026-10-27",
    });
    expect(result.data.lists.ministries).toContain("New ministry");
  });
  it("does not duplicate history for a description-only objective edit", () => {
    const d = data(),
      o = d.objectives[0],
      form = {
        ...objectiveForm,
        actual: String(o.actual * 100),
        rating: String(o.rating),
      };
    expect(saveRecordData(d, "objective", form, o).data.updates).toHaveLength(
      80,
    );
  });
  it("blocks duplicate snapshots but permits distinct observations on the same date", () => {
    const added = saveRecordData(data(), "update", updateForm);
    expect(() => saveRecordData(added.data, "update", updateForm)).toThrow(
      "identical historical",
    );
    expect(
      saveRecordData(added.data, "update", {
        ...updateForm,
        comment: "Different observation",
      }).data.updates,
    ).toHaveLength(82);
  });
});

describe("Field validation and numerical preservation", () => {
  it.each([
    { actual: "-1" },
    { actual: "101" },
    { rating: "2.5" },
    { startDate: "2026-02-30" },
    { endDate: "2025-01-01" },
    { goalId: "G999" },
  ])("rejects invalid objective input %o", (changes) =>
    expect(() =>
      saveRecordData(data(), "objective", { ...objectiveForm, ...changes }),
    ).toThrow(),
  );
  it("keeps percentage units as fractions and count/score values numeric", () => {
    expect(
      saveRecordData(data(), "kpi", {
        ...kpiForm,
        unit: "%",
        target: "90",
        actual: "45",
      }).record as KPI,
    ).toMatchObject({ target: 0.9, actual: 0.45 });
    expect((saveRecordData(data(), "kpi", kpiForm).record as KPI).target).toBe(
      20,
    );
  });
  it("preserves missing, zero and negative KPI values for quality review", () => {
    expect(
      saveRecordData(data(), "kpi", { ...kpiForm, target: "", actual: "" })
        .record as KPI,
    ).toMatchObject({ target: null, actual: null });
    expect(
      saveRecordData(data(), "kpi", { ...kpiForm, target: "0", actual: "-10" })
        .record as KPI,
    ).toMatchObject({ target: 0, actual: -10 });
  });
  it("uses the workbook snapshot achievement validation of 0–300%", () => {
    expect(() =>
      saveRecordData(data(), "update", { ...updateForm, achievement: "301" }),
    ).toThrow("300%");
    expect(
      (
        saveRecordData(data(), "update", { ...updateForm, achievement: "300" })
          .record as Update
      ).achievement,
    ).toBe(3);
  });
  it("preserves special characters and long descriptions", () => {
    const text = "Outreach < & > “Hope” — ".repeat(1000);
    expect(
      (
        saveRecordData(data(), "goal", { ...goalForm, description: text })
          .record as Goal
      ).description,
    ).toBe(text.trim());
  });
});
