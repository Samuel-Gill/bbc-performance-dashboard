import { describe, it, expect } from "vitest";
import type { DataSet, Objective, KPI } from "./domain";
import {
  avg,
  buildDashboard,
  EMPTY_FILTERS,
  formatDelta,
  formatPercent,
  kpiAchievement,
  matchesFilters,
  monthlyTrend,
  objectiveViews,
  plannedCompletion,
  summarizeBy,
  todayISO,
  toDay,
  validateDataset,
} from "./domain";
import fixture from "./fixtures/workbook-calculations.json";

const source = () => structuredClone(fixture.data) as DataSet;
const base = source().objectives[0];
const objective = (overrides: Partial<Objective> = {}) => ({
  ...base,
  startDate: "2026-01-01",
  endDate: "2026-01-11",
  actual: 0.5,
  ...overrides,
});
const kpi = (target: number | null, actual: number | null) =>
  ({ ...source().kpis[0], target, actual }) as KPI;

describe("Independent workbook verification", () => {
  for (const asOf of ["2026-09-29", "2026-10-27"] as const) {
    it(`matches every derived objective field and headline at ${asOf}`, () => {
      const data = source(),
        views = objectiveViews(data, asOf),
        expected = fixture.expected[asOf];
      for (const [i, row] of views.entries()) {
        for (const [key, value] of Object.entries(expected.objectives[i])) {
          const actual = row[key as keyof typeof row];
          if (typeof value === "number")
            expect(actual, `${row.id}.${key}`).toBeCloseTo(value, 12);
          else expect(actual, `${row.id}.${key}`).toEqual(value);
        }
        expect(row.dataQuality).toEqual([]);
      }
      const dashboard = buildDashboard(views, data.kpis);
      for (const [key, value] of Object.entries(expected.dashboard)) {
        if (key === "exceptions")
          expect(dashboard.exceptions.map((o) => o.id)).toEqual(value);
        else if (typeof value === "number")
          expect(dashboard[key as keyof typeof dashboard], key).toBeCloseTo(
            value,
            12,
          );
      }
      for (const key of ["goalId", "ministry"] as const) {
        const summaries = summarizeBy(views, (o) => o[key]);
        for (const [name, group] of Object.entries(expected.groups[key])) {
          const actual = summaries.find((s) => s.name === name)!;
          for (const [field, value] of Object.entries(group))
            if (typeof value === "number")
              expect(
                actual[field as keyof typeof actual],
                `${name}.${field}`,
              ).toBeCloseTo(value, 12);
        }
      }
    });
  }
  it("matches the original cached objective snapshot independently", () => {
    const views = objectiveViews(source(), "2026-09-29");
    for (const expected of fixture.cachedObjectives) {
      const row = views.find((v) => v.id === expected.id)!;
      for (const [key, value] of Object.entries(expected)) {
        if (typeof value === "number")
          expect(row[key as keyof typeof row]).toBeCloseTo(value, 12);
        else expect(row[key as keyof typeof row]).toEqual(value);
      }
    }
  });
  it("keeps the dashboard KPI row mean distinct from scorecard objective means", () => {
    const d = source();
    d.objectives = d.objectives.slice(0, 2);
    d.kpis = [
      {
        ...d.kpis[0],
        id: "KPI001",
        objectiveId: d.objectives[0].id,
        target: 100,
        actual: 50,
      },
      {
        ...d.kpis[0],
        id: "KPI002",
        objectiveId: d.objectives[0].id,
        target: 100,
        actual: 100,
      },
      {
        ...d.kpis[0],
        id: "KPI003",
        objectiveId: d.objectives[1].id,
        target: 100,
        actual: 200,
      },
    ];
    const views = objectiveViews(d, "2026-10-27");
    expect(buildDashboard(views, d.kpis).kpi).toBeCloseTo(3.5 / 3, 12);
    expect(summarizeBy(views, () => "All")[0].kpi).toBe(1.375);
  });
});

describe("Calendar and progress boundaries", () => {
  it.each([
    ["2025-12-31", 0],
    ["2026-01-01", 0],
    ["2026-01-06", 0.5],
    ["2026-01-11", 1],
    ["2026-02-01", 1],
  ])("plans %s as %s", (date, expected) =>
    expect(plannedCompletion(objective(), date)).toBe(expected),
  );
  it("handles a zero-duration objective before, on and after its date", () => {
    const o = objective({ endDate: "2026-01-01" });
    expect(plannedCompletion(o, "2025-12-31")).toBe(0);
    expect(plannedCompletion(o, "2026-01-01")).toBe(1);
    expect(plannedCompletion(o, "2026-01-02")).toBe(1);
  });
  it.each(["", "not-a-date", "2026-02-30", "2026-13-01", "2026-1-01"])(
    "rejects malformed dates %s",
    (date) => {
      expect(toDay(date)).toBeNaN();
      expect(
        plannedCompletion(objective({ startDate: date }), "2026-01-05"),
      ).toBeNull();
    },
  );
  it("accepts leap dates and rejects reversed schedules", () => {
    expect(Number.isFinite(toDay("2024-02-29"))).toBe(true);
    expect(toDay("2026-02-29")).toBeNaN();
    expect(
      plannedCompletion(objective({ endDate: "2025-01-01" }), "2026-01-05"),
    ).toBeNull();
  });
  it("uses the New York calendar across UTC midnight and DST", () => {
    expect(todayISO(new Date("2026-10-28T02:00:00Z"))).toBe("2026-10-27");
    expect(todayISO(new Date("2026-03-08T07:30:00Z"))).toBe("2026-03-08");
    expect(toDay("2026-03-09") - toDay("2026-03-08")).toBe(1);
  });
  it("does not mark the deadline day or fully completed work overdue", () => {
    const d = source();
    d.objectives = [
      objective({ endDate: "2026-01-11", actual: 1, status: "Completed" }),
    ];
    expect(objectiveViews(d, "2026-01-12")[0].overdue).toBe(false);
    d.objectives[0].actual = 0.5;
    expect(objectiveViews(d, "2026-01-11")[0].overdue).toBe(false);
    expect(objectiveViews(d, "2026-01-12")[0].overdue).toBe(true);
  });
  it("averages valid paired variances instead of subtracting unlike populations", () => {
    const d = source();
    d.objectives = [
      objective({ actual: 0.4 }),
      objective({ id: "OBJ999", startDate: "", actual: 0.9 }),
    ];
    const result = buildDashboard(objectiveViews(d, "2026-01-06"));
    expect(result.actual).toBe(0.65);
    expect(result.planned).toBe(0.5);
    expect(result.variance).toBeCloseTo(-0.1, 12);
  });
  it("preserves unavailable grouped planned progress and variance", () => {
    const d = source();
    d.objectives = [objective({ startDate: "" })];
    const result = summarizeBy(objectiveViews(d, "2026-01-06"), () => "All")[0];
    expect(result.planned).toBeNull();
    expect(result.variance).toBeNull();
    expect(result.performance).toBe("No Data");
  });
});

describe("Workbook exception thresholds", () => {
  function view(overrides: Partial<Objective>, ratio = 1) {
    const d = source();
    d.objectives = [objective(overrides)];
    d.kpis = [{ ...kpi(1, ratio), objectiveId: d.objectives[0].id }];
    return objectiveViews(d, "2026-01-06")[0];
  }
  it("keeps strict variance cutoffs", () => {
    expect(view({ actual: 0.25 }).exceptionScore).toBe(35);
    expect(view({ actual: 0.2499 }).exceptionScore).toBe(45);
    expect(view({ actual: 0.35 }).attention).toBe("Behind Plan");
    expect(view({ actual: 0.3500001 }).attention).toBe("Due Soon");
  });
  it("uses 80% KPI cutoff and 70% completion cutoff without rounding first", () => {
    expect(view({ actual: 0.7 }, 0.8).exceptionScore).toBe(0);
    expect(view({ actual: 0.7 }, 0.7999).exceptionScore).toBe(20);
    expect(view({ actual: 0.6999 }, 1).exceptionScore).toBe(15);
  });
  it("adds overlapping severity weights and prioritizes data quality", () => {
    const d = source();
    d.objectives = [
      objective({
        rating: 1,
        actual: 0.4,
        endDate: "2026-01-01",
        description: "",
      }),
    ];
    d.kpis = [{ ...kpi(1, 0.5), objectiveId: d.objectives[0].id }];
    const v = objectiveViews(d, "2026-01-06")[0];
    expect(v.attention).toBe("Data Quality");
    expect(v.exceptionScore).toBe(225);
  });
  it("ranks equal scores in reverse source-row order like Excel ROW()/100000", () => {
    const d = source();
    d.objectives = [
      objective({ id: "OBJ900", rating: 1 }),
      objective({ id: "OBJ100", rating: 1 }),
    ];
    d.kpis = [];
    expect(
      buildDashboard(objectiveViews(d, "2026-01-06")).exceptions.map(
        (o) => o.id,
      ),
    ).toEqual(["OBJ100", "OBJ900"]);
  });
  it.each([
    [0.05, "Ahead of Plan"],
    [-0.05, "On Plan"],
    [-0.051, "Behind Plan"],
  ])("uses Analysis L5 scorecard boundary %s", (variance, label) => {
    const d = source();
    d.objectives = [objective({ actual: 0.5 + Number(variance) })];
    expect(
      summarizeBy(objectiveViews(d, "2026-01-06"), () => "All")[0].performance,
    ).toBe(label);
  });
});

describe("KPIs, filtering, history and integrity", () => {
  it.each([
    [100, 150, 1.5],
    [100, -50, -0.5],
    [-100, 50, -0.5],
    [-100, -50, 0.5],
    [0, 50, null],
    [100, null, null],
    [null, 50, null],
  ])("divides %s target and %s actual safely", (target, actual, expected) =>
    expect(kpiAchievement(kpi(target, actual))).toBe(expected),
  );
  it("guards nonfinite ratios and formats missing values", () => {
    expect(kpiAchievement(kpi(1e-308, 1e308))).toBeNull();
    expect(avg([null, NaN, 1, 3])).toBe(2);
    expect(formatPercent(null)).toBe("—");
    expect(formatDelta(0.05)).toBe("+5.0 pp");
  });
  it("scopes KPIs and all totals to matching objectives", () => {
    const d = source(),
      v = objectiveViews(d, "2026-10-27"),
      rows = v.filter((o) =>
        matchesFilters(o, {
          ...EMPTY_FILTERS,
          goalId: ["G001"],
          priority: ["High", "Medium"],
        }),
      ),
      dash = buildDashboard(rows, d.kpis);
    expect(dash.objectives).toBe(rows.length);
    expect(dash.kpis).toBe(
      d.kpis.filter((k) => rows.some((o) => o.id === k.objectiveId)).length,
    );
    expect(dash.goals).toBe(1);
    expect(buildDashboard([], d.kpis).kpi).toBeNull();
  });
  it("uses all monthly snapshots, rather than latest-per-objective or current state", () => {
    const d = source();
    d.updates = [
      {
        ...d.updates[0],
        id: "UPD0001",
        date: "2026-10-01",
        actual: 0.2,
        achievement: 0.5,
      },
      {
        ...d.updates[0],
        id: "UPD0002",
        date: "2026-10-20",
        actual: 0.8,
        achievement: 1.5,
      },
      {
        ...d.updates[0],
        id: "UPD0003",
        date: "2026-09-30",
        actual: 1,
        achievement: 2,
      },
    ];
    const trend = monthlyTrend(
      objectiveViews(d, "2026-10-27"),
      d.updates,
      "2026-10-27",
    );
    expect(trend[11]).toMatchObject({
      fullMonth: "2026-10",
      actual: 0.5,
      kpi: 1,
      updates: 2,
    });
    expect(trend[10].actual).toBe(1);
    expect(trend[0].actual).toBeNull();
  });
  it("reports duplicate histories and invalid values without discarding records", () => {
    const d = source();
    d.updates.push({ ...d.updates[0], id: "UPD9999" });
    d.kpis[0].target = 0;
    d.objectives[0].startDate = "2026-02-30";
    const issues = validateDataset(d);
    expect(issues.some((i) => i.includes("duplicate historical"))).toBe(true);
    expect(issues.some((i) => i.includes("zero target"))).toBe(true);
    expect(issues.some((i) => i.includes("invalid start date"))).toBe(true);
  });
});
