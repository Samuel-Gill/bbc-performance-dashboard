export type Goal = {
  id: string;
  title: string;
  owner: string;
  description: string;
  active: string;
};
export type Objective = {
  id: string;
  goalId: string;
  description: string;
  ministry: string;
  role: string;
  owner: string;
  rating: number;
  startDate: string;
  endDate: string;
  actual: number;
  status: string;
  priority: string;
  comments: string;
  lastUpdateDate: string;
  updatedBy: string;
};
export type KPI = {
  id: string;
  objectiveId: string;
  name: string;
  description: string;
  unit: string;
  target: number | null;
  actual: number | null;
  measurementDate: string;
  comment: string;
};
export type Update = {
  id: string;
  objectiveId: string;
  date: string;
  actual: number;
  rating: number;
  achievement: number | null;
  comment: string;
};
export type Lists = {
  ministries: string[];
  roles: string[];
  ratings: number[];
  statuses: string[];
  priorities: string[];
  active: string[];
  units: string[];
  years: number[];
};
export type DataSet = {
  goals: Goal[];
  objectives: Objective[];
  kpis: KPI[];
  updates: Update[];
  lists: Lists;
  idHighWater?: Record<string, number>;
};
export type FilterKey =
  "ministry" | "goalId" | "role" | "rating" | "status" | "priority" | "year";
export type Filters = Record<FilterKey, string[]>;
export const EMPTY_FILTERS: Filters = {
  ministry: [],
  goalId: [],
  role: [],
  rating: [],
  status: [],
  priority: [],
  year: [],
};
export const RATING_LABELS: Record<number, string> = {
  1: "Issue Realized",
  2: "Issue Imminent",
  3: "Monitor",
  4: "On Track",
  5: "Exceeding",
};
export const RATING_COLORS: Record<number, string> = {
  1: "#dc4654",
  2: "#f49a43",
  3: "#edbb48",
  4: "#5abda4",
  5: "#208873",
};
export const DEFAULT_LISTS: Lists = {
  ministries: [],
  roles: [],
  ratings: [1, 2, 3, 4, 5],
  statuses: ["Not Started", "In Progress", "Completed", "On Hold", "At Risk"],
  priorities: ["Low", "Medium", "High", "Critical"],
  active: ["Active", "Inactive"],
  units: ["%", "Count", "Score"],
  years: [],
};
export const blankData = (): DataSet => ({
  goals: [],
  objectives: [],
  kpis: [],
  updates: [],
  lists: structuredClone(DEFAULT_LISTS),
});
export const REPORTING_TIMEZONE = "America/New_York";
export function todayISO(now = new Date(), timeZone = REPORTING_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function toDay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return NaN;
  const ms = Date.parse(iso + "T00:00:00Z");
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== iso)
    return NaN;
  return ms / 86400000;
}
export function differenceDays(end: string, start: string) {
  return toDay(end) - toDay(start);
}
export function plannedCompletion(
  o: Objective,
  today = todayISO(),
): number | null {
  const start = toDay(o.startDate),
    end = toDay(o.endDate),
    now = toDay(today);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    !Number.isFinite(now) ||
    end < start
  )
    return null;
  if (now < start) return 0;
  if (now > end || now === end || end === start) return 1;
  return Math.max(0, Math.min(1, (now - start) / (end - start)));
}
export function kpiAchievement(k: KPI): number | null {
  if (
    k.target === null ||
    k.actual === null ||
    !Number.isFinite(k.target) ||
    !Number.isFinite(k.actual) ||
    k.target === 0
  )
    return null;
  const ratio = k.actual / k.target;
  return Number.isFinite(ratio) ? ratio : null;
}
export function avg(values: (number | null | undefined)[]): number | null {
  const nums = values.filter(
    (x): x is number => x !== null && x !== undefined && Number.isFinite(x),
  );
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
export function autoId(prefix: string, ids: string[], digits = 3): string {
  let max = 0;
  for (const id of ids) {
    const m = new RegExp("^" + prefix + "(\\d+)$", "i").exec(id.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return prefix + String(max + 1).padStart(digits, "0");
}
export type ObjectiveView = Objective & {
  planned: number | null;
  variance: number | null;
  daysRemaining: number | null;
  overdue: boolean;
  achievement: number | null;
  dataQuality: string[];
  attention: string;
  exceptionScore: number;
  primaryKpiId: string;
  goalName: string;
  year: string;
  onTrack: boolean;
  atRisk: boolean;
  sourceIndex: number;
};
export function objectiveViews(
  data: DataSet,
  today = todayISO(),
): ObjectiveView[] {
  const gmap = new Map(data.goals.map((g) => [g.id, g]));
  const counts = new Map<string, number>();
  for (const o of data.objectives)
    counts.set(o.id, (counts.get(o.id) || 0) + 1);
  const associated = new Map<string, KPI[]>();
  for (const k of data.kpis) {
    const a = associated.get(k.objectiveId) || [];
    a.push(k);
    associated.set(k.objectiveId, a);
  }
  return data.objectives.map((o, sourceIndex) => {
    const planned = plannedCompletion(o, today),
      variance =
        planned === null || !Number.isFinite(o.actual)
          ? null
          : o.actual - planned;
    const daysRemaining =
      Number.isFinite(toDay(o.endDate)) && Number.isFinite(toDay(today))
        ? differenceDays(o.endDate, today)
        : null;
    const overdue = daysRemaining !== null && daysRemaining < 0 && o.actual < 1;
    const linked = associated.get(o.id) || [];
    const achievement = avg(linked.map(kpiAchievement));
    const q: string[] = [];
    if ((counts.get(o.id) || 0) > 1) q.push("Duplicate objective ID");
    if (!o.goalId) q.push("Missing Goal ID");
    else if (!gmap.has(o.goalId)) q.push("Invalid Goal ID");
    if (!o.description.trim()) q.push("Missing description");
    if (!o.ministry.trim()) q.push("Missing ministry");
    if (!o.role.trim()) q.push("Missing role");
    if (!o.owner.trim()) q.push("Missing accountable person");
    if (!Number.isInteger(o.rating) || o.rating < 1 || o.rating > 5)
      q.push("Invalid status rating");
    if (!Number.isFinite(toDay(o.startDate)))
      q.push("Missing / invalid start date");
    if (!Number.isFinite(toDay(o.endDate)))
      q.push("Missing / invalid end date");
    if (
      Number.isFinite(toDay(o.startDate)) &&
      Number.isFinite(toDay(o.endDate)) &&
      toDay(o.endDate) < toDay(o.startDate)
    )
      q.push("End before start");
    if (!Number.isFinite(o.actual) || o.actual < 0 || o.actual > 1)
      q.push("Invalid actual completion");
    if (!o.status.trim()) q.push("Missing objective status");
    if (!o.priority.trim()) q.push("Missing priority");
    if (!Number.isFinite(toDay(o.lastUpdateDate)))
      q.push("Missing / invalid update date");
    const dueSoon =
      daysRemaining !== null &&
      daysRemaining >= 0 &&
      daysRemaining <= 30 &&
      o.actual < 0.7;
    const attention = q.length
      ? "Data Quality"
      : overdue
        ? "Overdue"
        : o.rating <= 2
          ? "Status Risk"
          : variance !== null && variance < -0.15
            ? "Behind Plan"
            : achievement !== null && achievement < 0.8
              ? "KPI Below Target"
              : dueSoon
                ? "Due Soon"
                : "";
    const exceptionScore =
      (q.length ? 100 : 0) +
      (overdue ? 40 : 0) +
      (o.rating === 1 ? 35 : o.rating === 2 ? 25 : 0) +
      (variance !== null && variance < -0.25
        ? 30
        : variance !== null && variance < -0.15
          ? 20
          : 0) +
      (achievement !== null && achievement < 0.8 ? 20 : 0) +
      (dueSoon ? 15 : 0);
    return {
      ...o,
      sourceIndex,
      planned,
      variance,
      daysRemaining,
      overdue,
      achievement,
      dataQuality: q,
      attention,
      exceptionScore,
      primaryKpiId: linked[0]?.id || "",
      goalName: gmap.get(o.goalId)?.title || o.goalId,
      year: Number.isFinite(toDay(o.lastUpdateDate))
        ? o.lastUpdateDate.slice(0, 4)
        : "",
      onTrack: o.rating >= 4 && !overdue && o.status !== "Completed",
      atRisk: o.rating <= 2,
    };
  });
}
export function matchesFilters(o: ObjectiveView, f: Filters) {
  return (
    (!f.ministry.length || f.ministry.includes(o.ministry)) &&
    (!f.goalId.length || f.goalId.includes(o.goalId)) &&
    (!f.role.length || f.role.includes(o.role)) &&
    (!f.rating.length || f.rating.includes(String(o.rating))) &&
    (!f.status.length || f.status.includes(o.status)) &&
    (!f.priority.length || f.priority.includes(o.priority)) &&
    (!f.year.length || f.year.includes(o.year))
  );
}
export function buildDashboard(rows: ObjectiveView[], kpis: KPI[] = []) {
  const active = rows,
    ids = new Set(rows.map((o) => o.id)),
    selectedKpis = kpis.filter((k) => ids.has(k.objectiveId));
  return {
    goals: new Set(active.map((o) => o.goalId)).size,
    objectives: active.length,
    kpis: selectedKpis.length,
    actual: avg(active.map((o) => o.actual)),
    planned: avg(active.map((o) => o.planned)),
    variance: avg(active.map((o) => o.variance)),
    onTrack: active.filter((o) => o.onTrack).length,
    atRisk: active.filter((o) => o.atRisk).length,
    overdue: active.filter((o) => o.overdue).length,
    completed: active.filter((o) => o.actual === 1).length,
    underperforming: active.filter(
      (o) => o.achievement !== null && o.achievement < 0.8,
    ).length,
    kpi: avg(selectedKpis.map(kpiAchievement)),
    exceptions: active
      .filter((o) => o.exceptionScore > 0)
      .sort(
        (a, b) =>
          b.exceptionScore - a.exceptionScore || b.sourceIndex - a.sourceIndex,
      ),
  };
}
export function summarizeBy(
  rows: ObjectiveView[],
  selector: (o: ObjectiveView) => string,
) {
  const groups = new Map<string, ObjectiveView[]>();
  for (const o of rows) {
    const key = selector(o) || "Unassigned";
    const list = groups.get(key) || [];
    list.push(o);
    groups.set(key, list);
  }
  return Array.from(groups, ([name, rs]) => {
    const variance = avg(rs.map((r) => r.variance)),
      rating = avg(rs.map((r) => r.rating)),
      overdue = rs.filter((r) => r.overdue).length;
    return {
      name,
      count: rs.length,
      actual: avg(rs.map((r) => r.actual)) ?? 0,
      planned: avg(rs.map((r) => r.planned)),
      variance,
      kpi: avg(rs.map((r) => r.achievement)),
      rating: rating ?? 0,
      onTrack: rs.filter((r) => r.onTrack).length,
      atRisk: rs.filter((r) => r.atRisk).length,
      overdue,
      goalCount: new Set(rs.map((r) => r.goalId)).size,
      performance: overdue
        ? "Attention"
        : variance === null
          ? "No Data"
          : variance >= 0.05
            ? "Ahead of Plan"
            : variance >= -0.05
              ? "On Plan"
              : rating !== null && rating < 3
                ? "At Risk"
                : "Behind Plan",
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export function monthlyTrend(
  rows: ObjectiveView[],
  updates: Update[],
  today = todayISO(),
) {
  const selected = new Set(rows.map((o) => o.id)),
    yr = Number(today.slice(0, 4)),
    mo = Number(today.slice(5, 7));
  const result = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(yr, mo - 1 - i, 1));
    const y = d.getUTCFullYear(),
      m = d.getUTCMonth() + 1,
      month = String(y) + "-" + String(m).padStart(2, "0");
    const matching = updates.filter(
      (u) =>
        selected.has(u.objectiveId) &&
        Number.isFinite(toDay(u.date)) &&
        u.date.slice(0, 7) === month,
    );
    result.push({
      month: new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      fullMonth: month,
      actual: avg(matching.map((u) => u.actual)),
      kpi: avg(matching.map((u) => u.achievement)),
      updates: matching.length,
    });
  }
  return result;
}
export function formatPercent(num: number | null | undefined, digits = 1) {
  return num === null || num === undefined || !Number.isFinite(num)
    ? "—"
    : `${(num * 100).toFixed(digits)}%`;
}
export function formatDelta(num: number | null | undefined) {
  return num === null || num === undefined || !Number.isFinite(num)
    ? "—"
    : `${num > 0 ? "+" : ""}${(num * 100).toFixed(1)} pp`;
}
export function validateRelationships(data: DataSet) {
  const errors: string[] = [];
  for (const name of ["goals", "objectives", "kpis", "updates"] as const) {
    const c = new Map<string, number>();
    for (const r of data[name]) {
      if (!r.id.trim()) errors.push(`Missing ${name} ID`);
      const suffix = /^(G|OBJ|KPI|UPD)(\d+)$/i.exec(r.id);
      if (
        suffix &&
        (!Number.isSafeInteger(Number(suffix[2])) ||
          Number(suffix[2]) >= Number.MAX_SAFE_INTEGER)
      )
        errors.push(`${r.id}: ID number exceeds the supported integer range`);
      const key = r.id.toUpperCase();
      c.set(key, (c.get(key) || 0) + 1);
    }
    for (const [id, n] of c)
      if (n > 1) errors.push(`Duplicate ${name} ID: ${id}`);
  }
  const gs = new Set(data.goals.map((g) => g.id)),
    os = new Set(data.objectives.map((o) => o.id));
  for (const o of data.objectives)
    if (!gs.has(o.goalId)) errors.push(`${o.id}: unmatched goal ${o.goalId}`);
  for (const k of data.kpis)
    if (!os.has(k.objectiveId))
      errors.push(`${k.id}: unmatched objective ${k.objectiveId}`);
  for (const u of data.updates)
    if (!os.has(u.objectiveId))
      errors.push(`${u.id}: unmatched objective ${u.objectiveId}`);
  return errors;
}
export function validateDataset(data: DataSet) {
  const errors = validateRelationships(data);
  for (const g of data.goals) {
    if (
      !g.title.trim() ||
      !g.owner.trim() ||
      !g.description.trim() ||
      !g.active.trim()
    )
      errors.push(`${g.id}: missing required goal fields`);
  }
  for (const o of objectiveViews(data))
    for (const issue of o.dataQuality) errors.push(`${o.id}: ${issue}`);
  for (const k of data.kpis) {
    if (!k.name.trim() || !k.unit.trim())
      errors.push(`${k.id}: missing KPI name or unit`);
    if (k.target === 0)
      errors.push(`${k.id}: zero target; achievement is unavailable`);
    if (k.target === null || k.actual === null)
      errors.push(
        `${k.id}: missing target or actual; achievement is unavailable`,
      );
    if (
      (k.target !== null && !Number.isFinite(k.target)) ||
      (k.actual !== null && !Number.isFinite(k.actual))
    )
      errors.push(`${k.id}: invalid KPI numeric value`);
    if (!Number.isFinite(toDay(k.measurementDate)))
      errors.push(`${k.id}: missing / invalid measurement date`);
  }
  const snapshots = new Set<string>();
  for (const u of data.updates) {
    if (!Number.isFinite(toDay(u.date)))
      errors.push(`${u.id}: missing / invalid update date`);
    if (!Number.isFinite(u.actual) || u.actual < 0 || u.actual > 1)
      errors.push(`${u.id}: completion must be 0–100%`);
    if (!Number.isInteger(u.rating) || u.rating < 1 || u.rating > 5)
      errors.push(`${u.id}: status rating must be 1–5`);
    if (
      u.achievement !== null &&
      (!Number.isFinite(u.achievement) ||
        u.achievement < 0 ||
        u.achievement > 3)
    )
      errors.push(
        `${u.id}: snapshot KPI achievement must be 0–300% (workbook validation)`,
      );
    const key = JSON.stringify([
      u.objectiveId,
      u.date,
      u.actual,
      u.rating,
      u.achievement,
      u.comment,
    ]);
    if (snapshots.has(key))
      errors.push(`${u.id}: duplicate historical snapshot`);
    snapshots.add(key);
  }
  for (const o of data.objectives)
    if (o.status === "Completed" && o.actual < 1)
      errors.push(`${o.id}: status is Completed but completion is below 100%`);
  return [...new Set(errors)];
}

// Each stored counter is the next unused integer, seeded before any deletions.
export function seedIdCounters(data: DataSet): DataSet {
  const idHighWater = { ...data.idHighWater };
  for (const [key, prefix, digits] of [
    ["goals", "G", 3],
    ["objectives", "OBJ", 3],
    ["kpis", "KPI", 3],
    ["updates", "UPD", 4],
  ] as const) {
    const next = Number(
      autoId(
        prefix,
        data[key].map((r) => r.id),
        digits,
      ).slice(prefix.length),
    );
    const saved = idHighWater[prefix];
    idHighWater[prefix] = Math.max(
      next,
      Number.isSafeInteger(saved) && saved > 0 ? saved : 1,
    );
  }
  return { ...data, idHighWater };
}
