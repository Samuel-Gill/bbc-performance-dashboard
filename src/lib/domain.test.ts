import { describe, it, expect } from "vitest";
import type { DataSet, Objective } from "./domain";
import {
  autoId,
  buildDashboard,
  kpiAchievement,
  matchesFilters,
  monthlyTrend,
  objectiveViews,
  plannedCompletion,
  validateDataset,
} from "./domain";
const example: Objective = {
  id: "OBJ001",
  goalId: "G001",
  description: "Improve operational response time",
  ministry: "Office",
  role: "Project Lead",
  owner: "Owner",
  rating: 4,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  actual: 0.4,
  status: "In Progress",
  priority: "High",
  comments: "",
  lastUpdateDate: "2026-07-01",
  updatedBy: "Analyst",
};
const data = (objective = example): DataSet => ({
  goals: [
    {
      id: "G001",
      title: "Operational excellence",
      owner: "Owner",
      description: "Improve outcomes",
      active: "Active",
    },
  ],
  objectives: [objective],
  kpis: [
    {
      id: "KPI001",
      objectiveId: objective.id,
      name: "Compliance",
      description: "",
      unit: "%",
      target: 0.9,
      actual: 0.45,
      measurementDate: "2026-07-01",
      comment: "",
    },
  ],
  updates: [],
  lists: {
    ministries: ["Office"],
    roles: ["Project Lead"],
    ratings: [1, 2, 3, 4, 5],
    statuses: ["In Progress"],
    priorities: ["High"],
    active: ["Active"],
    units: ["%"],
    years: [2026],
  },
});
describe("Excel-compatible derived metrics", () => {
  it("clamps planned progress before start and after end", () => {
    expect(plannedCompletion(example, "2025-12-31")).toBe(0);
    expect(plannedCompletion(example, "2027-01-01")).toBe(1);
  });
  it("calculates achievement as actual divided by target", () => {
    expect(kpiAchievement(data().kpis[0])).toBe(0.5);
    expect(kpiAchievement({ ...data().kpis[0], target: 0 })).toBe(null);
  });
  it("uses workbook overdue and severity definitions", () => {
    const v = objectiveViews(
      data({ ...example, rating: 1, actual: 0.4, endDate: "2026-05-01" }),
      "2026-10-27",
    )[0];
    expect(v.overdue).toBe(true);
    expect(v.attention).toBe("Overdue");
    expect(v.exceptionScore).toBe(125);
  });
  it("excludes completed objectives from the on-track count", () => {
    const d = data({ ...example, status: "Completed", rating: 5, actual: 1 });
    const v = objectiveViews(d, "2026-10-27");
    expect(buildDashboard(v, d.kpis).onTrack).toBe(0);
  });
  it("uses KPI-level average like the native Excel executive card", () => {
    const d = data();
    d.kpis.push({ ...d.kpis[0], id: "KPI002", target: 1, actual: 1 });
    expect(buildDashboard(objectiveViews(d, "2026-10-27"), d.kpis).kpi).toBe(
      0.75,
    );
  });
  it("respects multiple values within filters and AND across dimensions", () => {
    const row = objectiveViews(data(), "2026-10-27")[0];
    expect(
      matchesFilters(row, {
        ministry: ["Office", "Pantry"],
        goalId: ["G001"],
        role: [],
        rating: [],
        status: ["In Progress"],
        priority: [],
        year: ["2026"],
      }),
    ).toBe(true);
    expect(
      matchesFilters(row, {
        ministry: ["Office"],
        goalId: ["G001"],
        role: [],
        rating: [],
        status: ["On Hold"],
        priority: [],
        year: [],
      }),
    ).toBe(false);
  });
  it("keeps missing months null, rather than inventing zero performance", () => {
    const trend = monthlyTrend(
      objectiveViews(data(), "2026-10-27"),
      [],
      "2026-10-27",
    );
    expect(trend).toHaveLength(12);
    expect(trend.every((x) => x.actual === null)).toBe(true);
  });
});
describe("Record IDs and referential integrity", () => {
  it("increments the numeric maximum rather than using row count", () => {
    expect(autoId("OBJ", ["OBJ001", "OBJ014", "OBJ003"])).toBe("OBJ015");
    expect(autoId("UPD", ["UPD0079", "UPD0080"], 4)).toBe("UPD0081");
  });
  it("flags duplicate and orphan records in uploaded data", () => {
    const d = data();
    d.objectives.push({ ...example, id: "OBJ001", goalId: "G999" });
    expect(validateDataset(d).some((x) => x.includes("Duplicate"))).toBe(true);
    expect(validateDataset(d).some((x) => x.includes("unmatched goal"))).toBe(
      true,
    );
  });
});
