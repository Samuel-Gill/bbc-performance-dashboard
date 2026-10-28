import { describe, it, expect } from "vitest";
import { calculatedFieldPreview } from "./calculated-preview";
import { fixtureData } from "./test-workbook";

describe("live Excel calculated-field previews", () => {
  it("recalculates objective dependent fields without modifying stored records", () => {
    const data = fixtureData();
    const existing = data.objectives[0];
    const snapshot = structuredClone(data);
    const form = {
      goalId: existing.goalId, description: existing.description,
      ministry: existing.ministry, role: existing.role, owner: existing.owner,
      rating: "2", startDate: "2026-01-01", endDate: "2026-12-31",
      actual: "50", status: "Behind schedule", priority: existing.priority,
      lastUpdateDate: "2026-10-28", updatedBy: "QA", comments: "New comment",
    };
    const fields = calculatedFieldPreview(data, "objective", form, existing, "2026-10-28");
    expect(fields).not.toBeNull();
    const result = Object.fromEntries(fields!.map((x) => [x.label, x.value]));
    expect(result["Objective Status Description"]).toBe("Behind schedule");
    expect(result["Planned Completion %"]).not.toBe("—");
    expect(result["Variance %"]).toContain("pp");
    expect(result["Days Remaining"]).not.toBe("—");
    expect(data).toEqual(snapshot);
  });

  it("calculates KPI attainment and inherited objective values before saving", () => {
    const data = fixtureData();
    const linked = data.objectives[0];
    const form = {
      objectiveId: linked.id, name: "New KPI", description: "", unit: "Count",
      target: "20", actual: "25", measurementDate: "2026-10-28", comment: "",
    };
    const fields = calculatedFieldPreview(data, "kpi", form, undefined, "2026-10-28")!;
    const result = Object.fromEntries(fields.map((x) => [x.label, x.value]));
    expect(result["KPI Achievement %"]).toBe("125.0%");
    expect(result["KPI Status"]).toBe("Met / Exceeded");
    expect(result["Goal ID"]).toBe(linked.goalId);
    expect(result["Ministry"]).toBe(linked.ministry);
    expect(result["Assigned Role"]).toBe(linked.role);
  });

  it("does not guess calculated fields for incomplete records or manual snapshots", () => {
    const data = fixtureData();
    expect(calculatedFieldPreview(data, "kpi", {}, undefined, "2026-10-28")).toBeNull();
    expect(calculatedFieldPreview(data, "goal", {}, undefined, "2026-10-28")).toBeNull();
  });
});
