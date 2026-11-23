import { describe, expect, it } from "vitest";
import { createMinistryReportPdf } from "./ministry-report";
import { objectiveViews } from "./domain";
import type { DataSet } from "./domain";

const data: DataSet = {
  goals: [{ id: "G001", title: "Community", owner: "Pastor", description: "", active: "Active" }],
  objectives: [
    {
      id: "OBJ001", goalId: "G001", description: "Deliver outreach ministry",
      ministry: "Youth Ministry", role: "Team Lead", owner: "Church Lead", rating: 3,
      startDate: "2026-01-01", endDate: "2026-12-31", actual: 0.5,
      status: "In Progress", priority: "High", comments: "Follow up next month",
      lastUpdateDate: "2026-11-01", updatedBy: "Church Lead",
    },
    {
      id: "OBJ002", goalId: "G001", description: "Different team objective",
      ministry: "Office", role: "Team Lead", owner: "Church Lead", rating: 1,
      startDate: "2026-01-01", endDate: "2026-12-31", actual: 0,
      status: "In Progress", priority: "High", comments: "Confidential office detail",
      lastUpdateDate: "2026-11-01", updatedBy: "Church Lead",
    },
  ],
  kpis: [
    {id: "KPI001", objectiveId: "OBJ001", name: "Community attendance", description: "", unit: "Count", target: 100, actual: 75, measurementDate: "2026-11-01", comment: ""},
    {id: "KPI002", objectiveId: "OBJ002", name: "Office metric", description: "", unit: "Count", target: 100, actual: 25, measurementDate: "2026-11-01", comment: ""},
  ],
  updates: [],
  lists: {ministries: [], roles: [], ratings: [], statuses: [], priorities: [], active: [], units: [], years: []},
};

describe("ministry PDF export", () => {
  it("creates a valid PDF header and includes only the selected ministry's filtered objectives and KPIs", () => {
    const bytes = createMinistryReportPdf({
      ministry: "Youth Ministry",
      reportingDate: "2026-11-22",
      objectives: objectiveViews(data, "2026-11-22"),
      kpis: data.kpis,
    });
    const content = new TextDecoder().decode(bytes);
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content.endsWith("%%EOF\n")).toBe(true);
    expect(content).toContain("OBJ001");
    expect(content).toContain("KPI001");
    expect(content).toContain("75.0%");
    expect(content).not.toContain("OBJ002");
    expect(content).not.toContain("KPI002");
    expect(content).not.toContain("Confidential office detail");
  });
  it("paginates long ministry reports without losing later objective records", () => {
    const many: DataSet = {
      ...data,
      objectives: Array.from({length: 60}, (_, i) => ({...data.objectives[0], id: `OBJ${i + 1}`, description: `Annual church delivery update ${i + 1}`})),
      kpis: [],
    };
    const pdf = new TextDecoder().decode(createMinistryReportPdf({
      ministry: "Youth Ministry", reportingDate: "2026-11-22",
      objectives: objectiveViews(many, "2026-11-22"), kpis: [],
    }));
    expect(pdf).toContain("OBJ60");
    expect((pdf.match(/\/Type \/Page(?!s)/g) ?? []).length).toBeGreaterThan(1);
  });
  it("supports zero matching records without exporting data from another ministry", () => {
    const pdf = new TextDecoder().decode(createMinistryReportPdf({
      ministry: "No Such Ministry", reportingDate: "2026-11-22",
      objectives: objectiveViews(data, "2026-11-22"), kpis: data.kpis,
    }));
    expect(pdf).toContain("No objectives match the selected ministry");
    expect(pdf).not.toContain("OBJ001");
  });
});
