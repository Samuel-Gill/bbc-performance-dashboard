import type { DataSet, Goal, Objective, KPI, Update } from "./domain";
import { avg, CHURCH_ROLES, RATING_PROGRESS_LABELS, kpiAchievement, seedIdCounters, toDay } from "./domain";

export type RecordKind = "goal" | "objective" | "kpi" | "update";
export type BusinessRecord = Goal | Objective | KPI | Update;
export type RecordForm = Record<string, string>;
export class RecordError extends Error {}

export function saveRecordData(
  input: DataSet,
  kind: RecordKind,
  form: RecordForm,
  previous?: BusinessRecord,
) {
  const data = seedIdCounters(input),
    updated = { ...data, idHighWater: { ...data.idHighWater } };
  const required = (...keys: string[]) => {
    for (const key of keys)
      if (!String(form[key] ?? "").trim())
        throw new RecordError(
          `Please complete ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`,
        );
  };
  const date = (key: string) => {
    if (!Number.isFinite(toDay(form[key])))
      throw new RecordError(
        `Enter a valid ${key.replace(/([A-Z])/g, " $1").toLowerCase()}.`,
      );
  };
  const allocate = (prefix: string, digits = 3) => {
    const next = updated.idHighWater[prefix];
    if (!Number.isSafeInteger(next) || next >= Number.MAX_SAFE_INTEGER)
      throw new RecordError(
        "The identifier counter is outside the supported integer range.",
      );
    updated.idHighWater[prefix] = next + 1;
    return prefix + String(next).padStart(digits, "0");
  };
  let record: BusinessRecord;
  if (kind === "goal") {
    required("title", "owner", "description", "active");
    record = {
      id: previous?.id || allocate("G"),
      title: form.title.trim(),
      owner: form.owner.trim(),
      description: form.description.trim(),
      active: form.active,
    } as Goal;
    updated.goals = previous
      ? data.goals.map((g) => (g.id === previous.id ? (record as Goal) : g))
      : [...data.goals, record as Goal];
  } else if (kind === "objective") {
    required(
      "goalId",
      "description",
      "ministry",
      "role",
      "owner",
      "rating",
      "startDate",
      "endDate",
      "actual",
      "status",
      "priority",
      "lastUpdateDate",
    );
    if (!data.goals.some((g) => g.id === form.goalId))
      throw new RecordError("Select a valid linked goal.");
    // Older Excel records can retain their previous assignment when edited,
    // but new or reassigned objectives must use an approved church role.
    const role = form.role.trim();
    if (!CHURCH_ROLES.includes(role) && role !== (previous as Objective | undefined)?.role)
      throw new RecordError("Select an approved church role for this objective.");
    date("startDate");
    date("endDate");
    date("lastUpdateDate");
    if (form.endDate < form.startDate)
      throw new RecordError("End date must be on or after start date.");
    const actual = Number(form.actual) / 100,
      rating = Number(form.rating);
    if (!Number.isFinite(actual) || actual < 0 || actual > 1)
      throw new RecordError("Actual completion must be between 0 and 100%.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new RecordError("Status rating must be an integer from 1 to 5.");
    record = {
      id: previous?.id || allocate("OBJ"),
      goalId: form.goalId,
      description: form.description.trim(),
      ministry: form.ministry,
      role,
      owner: form.owner.trim(),
      rating,
      startDate: form.startDate,
      endDate: form.endDate,
      actual,
      // Keep the schedule description synchronized with the numerical rating.
      status: RATING_PROGRESS_LABELS[rating],
      priority: form.priority,
      comments: form.comments || "",
      lastUpdateDate: form.lastUpdateDate,
      updatedBy: form.updatedBy || "",
    } as Objective;
    updated.objectives = previous
      ? data.objectives.map((o) =>
          o.id === previous.id ? (record as Objective) : o,
        )
      : [...data.objectives, record as Objective];
    const old = previous as Objective | undefined;
    if (old && (old.actual !== actual || old.rating !== rating))
      updated.updates = [
        ...data.updates,
        {
          id: allocate("UPD", 4),
          objectiveId: record.id,
          date: form.lastUpdateDate,
          actual,
          rating,
          achievement: avg(
            data.kpis
              .filter((k) => k.objectiveId === record.id)
              .map(kpiAchievement),
          ),
          comment: "Progress changed from objective editor.",
        },
      ];
  } else if (kind === "kpi") {
    required("objectiveId", "name", "unit", "measurementDate");
    date("measurementDate");
    if (!data.objectives.some((o) => o.id === form.objectiveId))
      throw new RecordError("Select a valid linked objective.");
    const divisor = form.unit === "%" ? 100 : 1;
    const numeric = (key: string) => {
      if (!form[key]?.trim()) return null;
      const n = Number(form[key]) / divisor;
      if (!Number.isFinite(n))
        throw new RecordError(`Enter a finite numeric ${key}.`);
      return n;
    };
    record = {
      id: previous?.id || allocate("KPI"),
      objectiveId: form.objectiveId,
      name: form.name.trim(),
      description: form.description?.trim() || "",
      unit: form.unit,
      target: numeric("target"),
      actual: numeric("actual"),
      measurementDate: form.measurementDate,
      comment: form.comment || "",
    } as KPI;
    updated.kpis = previous
      ? data.kpis.map((k) => (k.id === previous.id ? (record as KPI) : k))
      : [...data.kpis, record as KPI];
  } else {
    required("objectiveId", "date", "actual", "rating");
    date("date");
    const objective = data.objectives.find((o) => o.id === form.objectiveId);
    if (!objective) throw new RecordError("Select a valid linked objective.");
    const actual = Number(form.actual) / 100,
      rating = Number(form.rating),
      achievement = form.achievement?.trim()
        ? Number(form.achievement) / 100
        : null;
    if (!Number.isFinite(actual) || actual < 0 || actual > 1)
      throw new RecordError("Completion must be between 0 and 100%.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new RecordError("Status rating must be an integer from 1 to 5.");
    if (
      achievement !== null &&
      (!Number.isFinite(achievement) || achievement < 0 || achievement > 3)
    )
      throw new RecordError(
        "KPI snapshot achievement must be between 0 and 300%, matching the workbook validation.",
      );
    if (form.applyToCurrent === "true" && form.date < objective.lastUpdateDate)
      throw new RecordError(
        "This snapshot predates the current objective. Save it as history without applying it to current progress.",
      );
    const duplicate = data.updates.some(
      (u) =>
        u.id !== previous?.id &&
        u.objectiveId === form.objectiveId &&
        u.date === form.date &&
        u.actual === actual &&
        u.rating === rating &&
        u.achievement === achievement &&
        u.comment === (form.comment || ""),
    );
    if (duplicate)
      throw new RecordError(
        "An identical historical update already exists. Edit the existing update instead.",
      );
    record = {
      id: previous?.id || allocate("UPD", 4),
      objectiveId: form.objectiveId,
      date: form.date,
      actual,
      rating,
      achievement,
      comment: form.comment || "",
    } as Update;
    updated.updates = previous
      ? data.updates.map((u) => (u.id === previous.id ? (record as Update) : u))
      : [...data.updates, record as Update];
    if (form.applyToCurrent === "true")
      updated.objectives = data.objectives.map((o) =>
        o.id === form.objectiveId
          ? {
              ...o,
              actual,
              rating,
              status: RATING_PROGRESS_LABELS[rating],
              lastUpdateDate: form.date,
              updatedBy: form.updatedBy || o.updatedBy,
            }
          : o,
      );
  }
  if (kind === "objective") {
    const o = record as Objective;
    updated.lists = {
      ...data.lists,
      ministries: [...new Set([...data.lists.ministries, o.ministry])],
      roles: [...CHURCH_ROLES],
    };
  }
  return {
    data: updated,
    record,
    message: `${kind === "kpi" ? "KPI" : kind[0].toUpperCase() + kind.slice(1)} ${record.id} saved.`,
  };
}

export function deleteRecordData(
  input: DataSet,
  kind: RecordKind,
  id: string,
): DataSet {
  const data = seedIdCounters(input);
  if (kind === "goal" && data.objectives.some((o) => o.goalId === id))
    throw new RecordError(
      "This goal is linked to objectives. Reassign or remove those objectives first.",
    );
  if (
    kind === "objective" &&
    (data.kpis.some((k) => k.objectiveId === id) ||
      data.updates.some((u) => u.objectiveId === id))
  )
    throw new RecordError(
      "This objective has KPIs or historical updates. Remove those records first.",
    );
  return {
    ...data,
    goals: kind === "goal" ? data.goals.filter((r) => r.id !== id) : data.goals,
    objectives:
      kind === "objective"
        ? data.objectives.filter((r) => r.id !== id)
        : data.objectives,
    kpis: kind === "kpi" ? data.kpis.filter((r) => r.id !== id) : data.kpis,
    updates:
      kind === "update"
        ? data.updates.filter((r) => r.id !== id)
        : data.updates,
  };
}
