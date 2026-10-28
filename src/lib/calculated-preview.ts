import type { DataSet, Goal, Objective, KPI, Update } from "./domain";
import {
  formatDelta,
  formatPercent,
  kpiAchievement,
  objectiveViews,
} from "./domain";
import { saveRecordData, type RecordKind } from "./records";

export type CalculatedField = { label: string; value: string };

/**
 * Read-only live preview for the *existing* Excel calculated/lookup columns.
 * Reuses the exact save transformation and dashboard calculations, on copies;
 * it never writes to the workspace or changes source workbook formulas.
 * Excel's filter-specific SUBTOTAL / Filtered Exception Key is intentionally
 * excluded because it cannot be predicted from the React editor.
 */
export function calculatedFieldPreview(
  data: DataSet,
  kind: RecordKind,
  form: Record<string, string>,
  previous: Goal | Objective | KPI | Update | undefined,
  reportingDate: string,
): CalculatedField[] | null {
  if (kind === "goal") return null; // Goals has no calculated Excel columns.
  try {
    const result = saveRecordData(data, kind, form, previous);
    const updated = result.data;
    const record = result.record;
    const views = objectiveViews(updated, reportingDate);
    if (kind === "objective") {
      const view = views.find((o) => o.id === record.id);
      if (!view) return null;
      return [
        { label: "Planned Completion %", value: formatPercent(view.planned) },
        { label: "Variance %", value: formatDelta(view.variance) },
        { label: "Days Remaining", value: view.daysRemaining === null ? "—" : String(view.daysRemaining) },
        { label: "Overdue", value: view.overdue ? "Yes" : "No" },
        { label: "KPI Achievement %", value: formatPercent(view.achievement) },
        { label: "Data Quality Check", value: view.dataQuality.length ? view.dataQuality.join("; ") : "OK" },
        { label: "Attention Flag", value: view.attention || "None" },
        { label: "Exception Score", value: String(view.exceptionScore) },
        { label: "Primary KPI ID", value: view.primaryKpiId || "—" },
        { label: "Dashboard Year", value: view.year || "—" },
        { label: "Goal Description", value: view.goalName || "—" },
        { label: "Objective Status Description", value: view.status },
      ];
    }
    const parentId = kind === "kpi" ? (record as KPI).objectiveId : (record as Update).objectiveId;
    const parent = views.find((o) => o.id === parentId);
    if (!parent) return null;
    const linkedFields: CalculatedField[] = [
      { label: "Goal ID", value: parent.goalId },
      { label: "Ministry", value: parent.ministry },
      { label: "Assigned Role", value: parent.role },
      { label: "Priority", value: parent.priority },
      { label: "Objective Progress", value: parent.status },
    ];
    if (kind === "kpi") {
      const achievement = kpiAchievement(record as KPI);
      return [
        { label: "KPI Achievement %", value: formatPercent(achievement) },
        { label: "KPI Status", value: achievement === null ? "—" : achievement >= 1 ? "Met / Exceeded" : "Below Target" },
        ...linkedFields,
        { label: "Objective Status Rating", value: String(parent.rating) },
      ];
    }
    return linkedFields;
  } catch {
    // Keep partially completed forms usable. The real Save action still
    // supplies the complete validation error to the user.
    return null;
  }
}
