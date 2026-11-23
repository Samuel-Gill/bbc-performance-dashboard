import { RATING_PROGRESS_LABELS, RATING_COLORS } from "./lib/domain";

const terms = [
  {
    group: "Planning and delivery",
    entries: [
      ["Strategic goal", "A broad church priority containing one or more objectives. Goal scorecards summarize the objectives currently in view."],
      ["Objective", "A measurable piece of work linked to a strategic goal, ministry, owner, start and end date."],
      ["Actual completion (%)", "The manually recorded fraction of objective work completed. 100% means the objective is completed for dashboard counting purposes."],
      ["Planned completion (%)", "Expected progress as of the selected reporting date: max(0, min(100%, (reporting date - start date) / (end date - start date))). Before the start date it is 0%; on or after the end date it is 100% (including same-day objectives). Invalid dates are unavailable."],
      ["Variance", "Actual completion minus planned completion. A negative result means behind plan. The displayed difference is in percentage points, even where the 'pp' suffix is omitted; it is not a relative percent change."],
      ["Objective Status Rating", "A manually assigned 1–5 assessment of schedule performance. This does not change automatically when Actual Completion changes."],
      ["Objective Progress", "The schedule description associated with the current 1–5 Objective Status Rating. It is not the numeric Actual Completion percentage."],
      ["Schedule Status", "The objective's assigned 1–5 rating and its schedule-performance description."],
      ["On track", "An objective rated 4 or 5, not overdue, and not completed. Rating and completion are separate inputs; this is not simply the same as positive schedule variance."],
      ["At risk", "An objective rated 1 or 2. This can overlap the overdue count."],
      ["Overdue", "An objective whose end date has passed and whose actual completion is below 100%."],
      ["Completed objective", "An objective with Actual Completion equal to 100%; this is distinct from a manually chosen status label."],
    ],
  },
  {
    group: "KPI measurement",
    entries: [
      ["KPI", "Key Performance Indicator: a measure linked to an objective, with target, actual result, unit and measurement date."],
      ["Target completion", "The KPI target value in its chosen unit. A percentage unit is displayed as a percentage, but count and score units remain numbers."],
      ["Actual completion (KPI)", "The KPI's recorded actual measurement, in the same unit as its target. This differs from an objective's Actual Completion %."],
      ["KPI achievement (%)", "Actual KPI value ÷ target KPI value × 100. If the target is zero or inputs are missing, achievement is unavailable. The KPI may exceed 100%."],
      ["KPI Target Status", "Met / Exceeded if KPI achievement is at least 100%; Below Target otherwise. Missing achievement is shown as unavailable."],
      ["KPIs Below Target", "Count of KPI records whose measured achievement is below 100%; values without a valid achievement are not counted as below target."],
      ["KPI achievement by ministry", "Averages the achievement percentages of KPI records linked to objectives in each ministry. The 100% reference line/bar represents meeting each KPI's own target, not a shared target in one unit."],
    ],
  },
  {
    group: "Reports and exceptions",
    entries: [
      ["Average Objective Status Rating", "Arithmetic mean of the assigned numerical status ratings (1–5) for the objectives in the selected goal or ministry."],
      ["Scorecard planned / actual", "Arithmetic means of the objectives' planned and actual completion percentages in the selected group. Objectives without valid planned completion are excluded from that planned mean."],
      ["Exception Score", "Add 100 for a data quality issue; 40 if overdue; 35 for rating 1 or 25 for rating 2; 30 if variance is below −25 percentage points or 20 if below −15; 20 if objective KPI achievement is below 80%; 15 if due in 30 days with completion below 70%. Higher scores rank first."],
      ["Attention Required", "Objectives with a positive exception score, ranked from highest severity to lowest. The Issue label shows a primary reason, while Score includes all applicable penalties."],
      ["Reporting date", "Date used to calculate planned completion, variance, days remaining and overdue status. Changing this date recalculates dashboard-derived measures."],
      ["Filters", "Ministry, goal, role, rating, status, priority and year selections limit the objectives included in the linked dashboards and reports."],
      ["Historical update", "A dated progress snapshot. Historical updates are separate from the current objective record unless the editor explicitly applies the snapshot to current progress."],
    ],
  },
] as const;

export default function Glossary() {
  return (
    <div className="glossary-page page-stack">
      <div className="glossary-intro">
        <h2>Performance terms and calculations</h2>
        <p>Clear definitions for the measures used across BBC Perfomance Dashboard. Formula meanings follow the existing workbook and React calculation rules.</p>
      </div>
      {terms.map((section) => (
        <section key={section.group} className="surface glossary-section">
          <h3>{section.group}</h3>
          <dl>
            {section.entries.map(([name, definition]) => (
              <div className="glossary-entry" key={name}>
                <dt>{name}</dt><dd>{definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section className="surface glossary-section">
        <h3>Objective Status Rating — the five schedule levels</h3>
        <div className="glossary-rating-list">
          {[1, 2, 3, 4, 5].map((rating) => (
            <div key={rating}>
              <span className="glossary-rating-dot" style={{background: RATING_COLORS[rating]}} />
              <strong>{rating}</strong> {RATING_PROGRESS_LABELS[rating]}
            </div>
          ))}
        </div>
        <p className="glossary-footnote">Ratings are assigned by a person and are not automatically inferred from completion percentages. Check any apparent mismatch before changing historical data.</p>
      </section>
    </div>
  );
}
