import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, ChangeEvent, FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Filter,
  Goal as GoalIcon,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DataSet,
  Filters,
  FilterKey,
  Goal,
  Objective,
  KPI,
  Update,
  ObjectiveView,
} from "./lib/domain";
import {
  avg,
  blankData,
  buildDashboard,
  EMPTY_FILTERS,
  formatDelta,
  formatPercent,
  kpiAchievement,
  matchesFilters,
  monthlyTrend,
  objectiveViews,
  RATING_COLORS,
  RATING_LABELS,
  summarizeBy,
  todayISO,
  toDay,
  validateDataset,
  validateRelationships,
  seedIdCounters,
  REPORTING_TIMEZONE,
} from "./lib/domain";
import { saveRecordData, deleteRecordData } from "./lib/records";
import {
  clearWorkspace,
  downloadBlob,
  exportWorkbook,
  importWorkbook,
  readWorkbookFile,
  loadWorkspace,
  saveWorkspace,
} from "./lib/workbook";

type Page =
  | "Overview"
  | "Dashboard"
  | "Goals"
  | "Objectives"
  | "KPI Tracking"
  | "Updates"
  | "Insights"
  | "Data Quality"
  | "Workbook";
type Kind = "goal" | "objective" | "kpi" | "update";
type Modal = { kind: Kind; record?: Goal | Objective | KPI | Update } | null;
const LINKS: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Overview", icon: Sparkles },
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Goals", icon: GoalIcon },
  { name: "Objectives", icon: Target },
  { name: "KPI Tracking", icon: Activity },
  { name: "Updates", icon: Clock3 },
  { name: "Insights", icon: BarChart3 },
  { name: "Data Quality", icon: ShieldCheck },
  { name: "Workbook", icon: FileSpreadsheet },
];
const STATUS_COLORS: Record<string, string> = {
  Completed: "#287f69",
  "In Progress": "#783eb0",
  "At Risk": "#ba3a4c",
  "On Hold": "#a66a1f",
  "Not Started": "#8293ab",
};
const fmt = (v: number | null | undefined) => formatPercent(v, 1);
const initial = (
  kind: Kind,
  record?: Goal | Objective | KPI | Update,
): Record<string, string> => {
  const r = record as unknown as Record<string, unknown> | undefined,
    str = (k: string, def = "") => String(r?.[k] ?? def);
  const p = (k: string, def = "0") =>
    String(r?.[k] === undefined ? def : Number(r[k]) * 100);
  if (kind === "goal")
    return {
      title: str("title"),
      owner: str("owner"),
      description: str("description"),
      active: str("active", "Active"),
    };
  if (kind === "objective")
    return {
      goalId: str("goalId"),
      description: str("description"),
      ministry: str("ministry"),
      role: str("role"),
      owner: str("owner"),
      rating: str("rating", "4"),
      startDate: str("startDate", todayISO()),
      endDate: str("endDate", todayISO()),
      actual: p("actual"),
      status: str("status", "Not Started"),
      priority: str("priority", "Medium"),
      comments: str("comments"),
      lastUpdateDate: str("lastUpdateDate", todayISO()),
      updatedBy: str("updatedBy"),
    };
  if (kind === "kpi") {
    const k = r as unknown as KPI | undefined,
      ratio = k?.unit === "%" ? 100 : 1;
    return {
      objectiveId: str("objectiveId"),
      name: str("name"),
      description: str("description"),
      unit: str("unit", "%"),
      target:
        k?.target === null || k?.target === undefined
          ? ""
          : String(Number(k.target) * ratio),
      actual:
        k?.actual === null || k?.actual === undefined
          ? ""
          : String(Number(k.actual) * ratio),
      measurementDate: str("measurementDate", todayISO()),
      comment: str("comment"),
    };
  }
  return {
    objectiveId: str("objectiveId"),
    date: str("date", todayISO()),
    actual: p("actual"),
    rating: str("rating", "4"),
    achievement:
      r?.achievement === null || r?.achievement === undefined
        ? ""
        : p("achievement"),
    comment: str("comment"),
    updatedBy: "",
    applyToCurrent: "false",
  };
};
const uniq = (items: string[]) =>
  Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b));

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={"surface " + className}>{children}</div>;
}
function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "red" | "amber" | "yellow" | "green" | "teal" | "blue" | "neutral";
}) {
  return <span className={"pill pill-" + tone}>{children}</span>;
}
function Rating({ rating }: { rating: number }) {
  return (
    <span className="rating">
      <span
        className="rating-dot"
        style={{ background: RATING_COLORS[rating] || "#9aa6b6" }}
      />
      {rating} · {RATING_LABELS[rating] || "Unknown"}
    </span>
  );
}
function Progress({
  value,
  planned,
}: {
  value: number;
  planned?: number | null;
}) {
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${Math.max(0, Math.min(100, value * 100))}%`,
            background:
              planned !== undefined &&
              planned !== null &&
              value + 0.15 < planned
                ? "#a66a1f"
                : "#287f69",
          }}
        />
        {planned !== undefined && planned !== null && (
          <span
            className="progress-marker"
            style={{ left: `${Math.min(100, Math.max(0, planned * 100))}%` }}
          />
        )}
      </div>
      <span className="tiny-numeric">{fmt(value)}</span>
    </div>
  );
}
function Empty({
  text = "No records match your selection.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Search size={24} />
      <strong>Nothing to display</strong>
      <span>{text}</span>
    </div>
  );
}
const colorVariance = (v: number | null) =>
  v === null ? "muted" : v < -0.15 ? "bad" : v < 0 ? "warn" : "good";
const withPercent = (v: number | null) =>
  v === null ? null : Number((v * 100).toFixed(2));
function Metric({
  label,
  value,
  icon: Icon,
  sub,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  icon: typeof Target;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <div className={"metric-icon " + tone}>
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}
function FilterDropdown({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="filter-wrap" ref={ref}>
      <button
        aria-expanded={open}
        aria-label={`${label}: ${values.length ? values.length + " selected" : "All"}`}
        className={"filter-button " + (values.length ? "active" : "")}
        onClick={() => setOpen(!open)}
      >
        <span>{label}</span>
        <strong>{values.length ? `${values.length} selected` : "All"}</strong>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="filter-popover">
          <div className="filter-pop-head">
            <span>{label}</span>
            <button onClick={() => onChange([])}>Clear</button>
          </div>
          <div className="filter-options">
            {options.map((o) => (
              <label key={o.value} className="filter-option">
                <input
                  type="checkbox"
                  checked={values.includes(o.value)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...values, o.value]
                        : values.filter((x) => x !== o.value),
                    )
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function ChartBox({
  title,
  sub,
  children,
  className = "",
  empty = false,
}: {
  title: string;
  sub: string;
  children: ReactNode;
  className?: string;
  empty?: boolean;
}) {
  return (
    <Card className={"chart-card " + className}>
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
      </div>
      {empty ? (
        <Empty text="No observations for the current filters and reporting period." />
      ) : (
        children
      )}
    </Card>
  );
}
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #d4deea",
  boxShadow: "0 14px 38px #1c2e5220",
  fontSize: 14,
  color: "#24344b",
};

function useDialogFocus(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hidden);
    focusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return dialogRef;
}

function Editor({
  modal,
  data,
  onClose,
  onSave,
}: {
  modal: NonNullable<Modal>;
  data: DataSet;
  onClose: () => void;
  onSave: (
    kind: Kind,
    record: Record<string, string>,
    old?: Goal | Objective | KPI | Update,
  ) => string | null;
}) {
  const dialogRef = useDialogFocus(onClose);
  const [form, setForm] = useState(() => initial(modal.kind, modal.record));
  const [error, setError] = useState("");
  const editing = Boolean(modal.record);
  const kind = modal.kind;
  const field = (
    key: string,
    label: string,
    type = "text",
    options?: string[],
    required = true,
  ) => (
    <label
      className={
        "form-field " +
        (key === "description" || key === "comments" || key === "comment"
          ? "full"
          : "")
      }
      key={key}
    >
      <span>
        {label}
        {required && <i aria-hidden="true">*</i>}
      </span>
      {options && !["ministry", "role"].includes(key) ? (
        <select
          required={required}
          value={form[key] || ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        >
          <option value="">Choose...</option>
          {uniq([...options, form[key] || ""]).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : key === "description" || key === "comments" || key === "comment" ? (
        <textarea
          rows={key === "description" ? 3 : 2}
          value={form[key] || ""}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          required={required}
          maxLength={32767}
        />
      ) : (
        <>
          <input
            type={type}
            step={type === "number" ? "any" : undefined}
            list={options ? `options-${key}` : undefined}
            value={form[key] ?? ""}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            required={required}
            maxLength={32767}
          />
          {options && (
            <datalist id={`options-${key}`}>
              {uniq(options).map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          )}
        </>
      )}
    </label>
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const message = onSave(kind, form, modal.record);
    if (message) setError(message);
    else onClose();
  };
  const formLabel: { [k in Kind]: string } = {
    goal: "Strategic Goal",
    objective: "Objective",
    kpi: "Key Performance Indicator",
    update: "Progress Update",
  };
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={formLabel[kind]}
      >
        <div className="dialog-top">
          <div>
            <span className="eyebrow">RECORD MANAGEMENT</span>
            <h2>
              {editing ? "Edit" : "Add"} {formLabel[kind]}
            </h2>
            <p>
              {editing
                ? "Save your changes to update connected analytics."
                : "A unique identifier will be generated automatically."}
            </p>
          </div>
          <button
            aria-label="Close editor"
            className="icon-button"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {kind === "goal" && (
              <>
                {field("title", "Strategic goal")}
                {field("owner", "Accountable person")}
                {field("description", "Goal description")}
                {field(
                  "active",
                  "Active status",
                  "text",
                  data.lists.active.length
                    ? data.lists.active
                    : ["Active", "Inactive"],
                )}
              </>
            )}
            {kind === "objective" && (
              <>
                {field(
                  "goalId",
                  "Linked goal",
                  "text",
                  data.goals.map((g) => g.id),
                )}
                {field("description", "Objective description")}
                {field("ministry", "Ministry", "text", [
                  ...data.lists.ministries,
                  ...data.objectives.map((o) => o.ministry),
                ])}
                {field("role", "Assigned role", "text", [
                  ...data.lists.roles,
                  ...data.objectives.map((o) => o.role),
                ])}
                {field("owner", "Accountable person")}
                {field("rating", "Status rating", "text", [
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                ])}
                {field("startDate", "Start date", "date")}
                {field("endDate", "End date", "date")}
                {field("actual", "Actual completion (%)", "number")}
                {field(
                  "status",
                  "Objective status",
                  "text",
                  data.lists.statuses,
                )}
                {field("priority", "Priority", "text", data.lists.priorities)}
                {field("lastUpdateDate", "Last update date", "date")}
                {field(
                  "updatedBy",
                  "Last updated by",
                  "text",
                  undefined,
                  false,
                )}
                {field("comments", "Comments", "text", undefined, false)}
              </>
            )}
            {kind === "kpi" && (
              <>
                {field(
                  "objectiveId",
                  "Linked objective",
                  "text",
                  data.objectives.map((o) => o.id),
                )}
                {field("name", "KPI name")}
                {field(
                  "description",
                  "KPI description",
                  "text",
                  undefined,
                  false,
                )}
                {field("unit", "Unit", "text", data.lists.units)}
                {field(
                  "target",
                  `Target ${form.unit === "%" ? "(%)" : "(numeric)"}`,
                  "number",
                  undefined,
                  false,
                )}
                {field(
                  "actual",
                  `Actual ${form.unit === "%" ? "(%)" : "(numeric)"}`,
                  "number",
                  undefined,
                  false,
                )}
                {field("measurementDate", "Measurement date", "date")}
                {field("comment", "Comment", "text", undefined, false)}
                <p className="form-note full">
                  For % measures, enter 90 for 90%. A blank measurement or zero
                  target has no achievement ratio. Negative values use the
                  workbook’s Actual ÷ Target rule.
                </p>
              </>
            )}
            {kind === "update" && (
              <>
                {field(
                  "objectiveId",
                  "Linked objective",
                  "text",
                  data.objectives.map((o) => o.id),
                )}
                {field("date", "Update date", "date")}
                {field("actual", "Completion (%)", "number")}
                {field("rating", "Status rating", "text", [
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                ])}
                {field(
                  "achievement",
                  "KPI achievement (%)",
                  "number",
                  undefined,
                  false,
                )}
                {field("updatedBy", "Updated by", "text", undefined, false)}
                {field("comment", "Update comment", "text", undefined, false)}
              </>
            )}
            {kind === "update" && (
              <label className="apply-update full">
                <input
                  type="checkbox"
                  checked={form.applyToCurrent === "true"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      applyToCurrent: String(e.target.checked),
                    })
                  }
                />
                <span>
                  Also apply completion and rating to the current objective. The
                  date must be on or after its last update.
                </span>
              </label>
            )}
            {kind === "objective" && editing && (
              <p className="form-note full">
                Changing completion or rating also adds a historical snapshot.
                Status and completion remain separate workbook fields.
              </p>
            )}
          </div>
          {error && (
            <div className="form-error" role="alert">
              <AlertCircle size={15} />
              {error}
            </div>
          )}
          <div className="dialog-actions">
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary">
              <Check size={16} /> {editing ? "Save changes" : "Create record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ObjectiveDetail({
  row,
  data,
  onClose,
  onEdit,
}: {
  row: ObjectiveView;
  data: DataSet;
  onClose: () => void;
  onEdit: () => void;
}) {
  const dialogRef = useDialogFocus(onClose);
  const relatedKpis = data.kpis.filter((k) => k.objectiveId === row.id);
  const updates = data.updates
    .filter((u) => u.objectiveId === row.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const details: [string, string | number][] = [
    ["Goal", `${row.goalId} · ${row.goalName}`],
    ["Ministry", row.ministry],
    ["Assigned role", row.role],
    ["Accountable person", row.owner],
    ["Objective status", row.status],
    ["Priority", row.priority],
    ["Start date", row.startDate],
    ["End date", row.endDate],
    ["Last update", row.lastUpdateDate],
    ["Last updated by", row.updatedBy || "—"],
    ["Status rating", `${row.rating} · ${RATING_LABELS[row.rating]}`],
    ["Actual completion", fmt(row.actual)],
    ["Planned completion", fmt(row.planned)],
    ["Variance", formatDelta(row.variance)],
    ["Days remaining", row.daysRemaining === null ? "—" : row.daysRemaining],
    ["Overdue", row.overdue ? "Yes" : "No"],
    ["KPI achievement", fmt(row.achievement)],
    ["Primary KPI ID", row.primaryKpiId || "—"],
    [
      "Data quality",
      row.dataQuality.length ? row.dataQuality.join("; ") : "OK",
    ],
    ["Attention flag", row.attention || "None"],
    ["Exception severity", row.exceptionScore],
    ["Dashboard year", row.year],
  ];
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="dialog detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${row.id} objective details`}
      >
        <div className="dialog-top">
          <div>
            <span className="eyebrow">OBJECTIVE DETAIL / {row.id}</span>
            <h2>{row.description}</h2>
            <p>
              Complete current-state record with calculated fields and linked
              history.
            </p>
          </div>
          <button
            aria-label="Close details"
            className="icon-button"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="detail-body">
          <div className="detail-stats">
            <div>
              <span>Actual</span>
              <strong>{fmt(row.actual)}</strong>
            </div>
            <div>
              <span>Variance</span>
              <strong className={colorVariance(row.variance)}>
                {formatDelta(row.variance)}
              </strong>
            </div>
            <div>
              <span>Exception score</span>
              <strong>{row.exceptionScore}</strong>
            </div>
          </div>
          <p className="detail-comment">
            On track means rating 4–5, not overdue, and status other than
            Completed. At risk means rating 1–2. Overdue means the due date has
            passed and actual completion is below 100%. These counts can
            overlap.
          </p>
          <h3>All objective fields</h3>
          <div className="detail-list">
            {details.map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <h3>Comments</h3>
          <p className="detail-comment">
            {row.comments || "No comments recorded."}
          </p>
          <h3>Linked KPIs ({relatedKpis.length})</h3>
          <div className="detail-linked">
            {relatedKpis.map((k) => (
              <div key={k.id}>
                <b>{k.id}</b>
                <span>{k.name}</span>
                <strong>{fmt(kpiAchievement(k))}</strong>
              </div>
            ))}
            {!relatedKpis.length && <p>No KPIs linked.</p>}
          </div>
          <h3>
            Recent updates (
            {data.updates.filter((u) => u.objectiveId === row.id).length} total)
          </h3>
          <div className="detail-linked">
            {updates.map((u) => (
              <div key={u.id}>
                <b>{u.id}</b>
                <span>
                  {u.date} · {u.comment}
                </span>
                <strong>{fmt(u.actual)}</strong>
              </div>
            ))}
            {!updates.length && <p>No historical updates linked.</p>}
          </div>
        </div>
        <div className="dialog-actions">
          <button className="secondary" onClick={onClose}>
            Close
          </button>
          <button className="primary" onClick={onEdit}>
            <Settings2 size={16} /> Edit objective
          </button>
        </div>
      </div>
    </div>
  );
}

function Welcome({
  data,
  views,
  reportingDate,
  hasWorkspace,
  saveStatus,
  onNavigate,
  onUpload,
  busy,
}: {
  data: DataSet;
  views: ObjectiveView[];
  reportingDate: string;
  hasWorkspace: boolean;
  saveStatus: string;
  onNavigate: (p: Page) => void;
  onUpload: () => void;
  busy: boolean;
}) {
  const snapshot = buildDashboard(views, data.kpis);
  const attentionCount = views.filter((o) => o.atRisk || o.overdue).length;
  const latest = data.objectives
    .map((o) => o.lastUpdateDate)
    .filter((d) => Number.isFinite(toDay(d)))
    .sort()
    .at(-1);
  const steps = [
    [
      "Open your workbook",
      "Upload your Excel workbook, or return to the workspace saved in this browser.",
    ],
    [
      "Review the dashboard",
      "Compare planned and actual progress, then review the objectives needing attention.",
    ],
    [
      "Explore your goals",
      "Follow each strategic goal through its objectives, ministry and accountable person.",
    ],
    [
      "Record meaningful progress",
      "Update KPI measurements and add dated snapshots to build a clear history.",
    ],
    [
      "Take your work with you",
      "Export an updated workbook for review and keep a backup of your changes.",
    ],
  ];
  return (
    <div className="page-stack welcome-page">
      <section className="welcome-banner" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <span className="welcome-kicker">
            <span /> PURPOSE. PROGRESS. ACCOUNTABILITY.
          </span>
          <h2 id="welcome-title">
            Welcome to
            <br />
            BBC Perfomance Dashboard
          </h2>
          <p>Helping our church turn vision into measurable progress.</p>
          <p className="welcome-description">
            A central place to plan strategic goals, monitor ministry
            objectives, and review the outcomes that matter to our church and
            community.
          </p>
          <div className="welcome-actions">
            <button className="primary" onClick={() => onNavigate("Dashboard")}>
              <LayoutDashboard size={18} /> View Dashboard{" "}
              <ArrowRight size={17} />
            </button>
            <button
              className="welcome-upload"
              onClick={onUpload}
              disabled={busy}
            >
              <UploadCloud size={18} />{" "}
              {hasWorkspace
                ? "Upload another workbook"
                : "Upload your workbook"}
            </button>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="church-arch">
            <svg viewBox="0 0 200 240">
              <path
                d="M100 38v45m-18-27h36"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M39 211v-91l61-45 61 45v91H39Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinejoin="round"
              />
              <path
                d="M84 211v-43a16 16 0 0 1 32 0v43M61 135v22m78-22v22"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M21 215h158"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="art-caption">
            Growing together,
            <br />
            <strong>with purpose.</strong>
          </div>
        </div>
      </section>
      <section
        className={"workspace-strip " + (hasWorkspace ? "loaded" : "")}
        aria-label="Workspace status"
      >
        <div className="workspace-status-icon">
          {hasWorkspace ? (
            <ShieldCheck size={23} />
          ) : (
            <FileSpreadsheet size={23} />
          )}
        </div>
        <div>
          <strong>
            {hasWorkspace
              ? "Your workspace is ready"
              : "Start with your church’s Excel workbook"}
          </strong>
          <p>
            {hasWorkspace
              ? `${saveStatus}. Export regularly to keep a separate backup.`
              : "Upload the supplied workbook to load your goals, objectives, KPIs and progress history."}
          </p>
        </div>
        <button className="link-action" onClick={() => onNavigate("Workbook")}>
          {hasWorkspace ? "Manage workbook" : "Import Excel"}{" "}
          <ArrowRight size={17} />
        </button>
      </section>
      <section aria-label="Strategic summary" className="welcome-counts">
        <Metric
          icon={GoalIcon}
          label="Strategic goals"
          value={data.goals.length}
          sub="All goals in this workspace"
        />
        <Metric
          icon={Target}
          label="Ministry objectives"
          value={data.objectives.length}
          sub="Current objective records"
          tone="teal"
        />
        <Metric
          icon={Activity}
          label="KPIs tracked"
          value={data.kpis.length}
          sub="Measures linked to objectives"
          tone="purple"
        />
        <Metric
          icon={CheckCircle2}
          label="Completed objectives"
          value={snapshot.completed}
          sub="Actual completion at 100%"
          tone="green"
        />
      </section>
      <div className="welcome-middle">
        <Card className="snapshot-card">
          <SectionHead
            title="Current performance"
            description={`All objectives · Reporting date ${reportingDate}`}
          />
          <div className="snapshot-main">
            <div>
              <span>Average actual progress</span>
              <strong>{fmt(snapshot.actual)}</strong>
            </div>
            <div className="snapshot-planned">
              <span>Planned progress</span>
              <strong>{fmt(snapshot.planned)}</strong>
              <small className={colorVariance(snapshot.variance)}>
                {formatDelta(snapshot.variance)} variance
              </small>
            </div>
          </div>
          {hasWorkspace ? (
            <div className="snapshot-progress">
              <Progress
                value={snapshot.actual ?? 0}
                planned={snapshot.planned}
              />
              <div className="snapshot-key">
                <span>
                  <i /> Actual completion
                </span>
                <span>
                  <b /> Planned completion
                </span>
              </div>
            </div>
          ) : (
            <p className="snapshot-empty">
              Your performance summary will appear after you upload a workbook.
            </p>
          )}
          <div className="snapshot-status">
            <div>
              <CheckCircle2 size={18} />
              <strong>{snapshot.onTrack}</strong>
              <span>On track</span>
            </div>
            <div>
              <AlertTriangle size={18} />
              <strong>{attentionCount}</strong>
              <span>At risk or overdue</span>
            </div>
          </div>
          <div className="snapshot-foot">
            {latest
              ? `Latest objective update: ${latest}`
              : "No objective updates loaded."}
            <button
              className="link-action"
              onClick={() => onNavigate("Dashboard")}
            >
              View all metrics <ArrowRight size={15} />
            </button>
          </div>
        </Card>
        <Card className="getting-started">
          <SectionHead
            title="A clear path to progress"
            description="Five steps for your ministry team"
          />
          <ol>
            {steps.map(([title, description]) => (
              <li key={title}>
                <div>
                  <strong>{title}</strong>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <section className="workspace-navigation">
        <SectionHead
          title="Explore your workspace"
          description="From strategic direction to day-to-day accountability"
        />
        <div className="navigation-grid">
          {LINKS.filter(
            (l) => l.name !== "Overview" && l.name !== "Data Quality",
          ).map(({ name, icon: Icon }) => (
            <button key={name} onClick={() => onNavigate(name)}>
              <Icon size={23} />
              <strong>
                {name === "Updates"
                  ? "Objective Updates"
                  : name === "Workbook"
                    ? "Excel Import / Export"
                    : name}
              </strong>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      </section>
      <p className="privacy-note">
        <ShieldCheck size={16} /> Your records stay in this browser. This
        workspace does not provide cloud backup or shared editing.
      </p>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Overview"),
    [data, setData] = useState<DataSet | null>(blankData),
    [source, setSource] = useState<ArrayBuffer | null>(null),
    [sourceName, setSourceName] = useState("No workbook loaded");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [filters, setFilters] = useState<Filters>(EMPTY_FILTERS),
    [search, setSearch] = useState(""),
    [mobileMenu, setMobileMenu] = useState(false),
    [pageNo, setPageNo] = useState(0),
    [detail, setDetail] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null),
    booted = useRef(false);
  const [today, setToday] = useState(todayISO()),
    [liveDate, setLiveDate] = useState(true),
    [saveStatus, setSaveStatus] = useState("No workbook loaded"),
    [sortBy, setSortBy] = useState("severity");
  const saveQueue = useRef(Promise.resolve()),
    dataRef = useRef(data);
  dataRef.current = data;
  // Upload/edit availability must not depend on a lifetime Web Lock.
  const canEdit = true;
  const [starterPassword, setStarterPassword] = useState("");
  const [starterMessage, setStarterMessage] = useState("");
  const loadIncludedWorkbook = async (password = "") => {
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/starter-workbook", {
        signal: controller.signal,
        headers: password ? { Authorization: "Bearer " + password } : {},
        cache: "no-store",
      });
      if (!response.ok) {
        setStarterMessage(
          response.status === 404
            ? "Upload your workbook, or use npm run dev to open the included church data."
            : await response.text(),
        );
        return;
      }
      const loaded = await importWorkbook(
        await response.arrayBuffer(),
        "BBC_Church_Workbook.xlsx",
      );
      setData(loaded.data);
      setSource(loaded.buffer);
      setSourceName(loaded.filename);
      setLiveDate(loaded.liveDate !== false);
      setToday(loaded.reportingDate || todayISO());
      setStarterPassword("");
      setStarterMessage("");
      setSaveStatus("Included church workbook loaded");
    } catch {
      setStarterMessage(
        "The included workbook is unavailable. You can upload your Excel copy directly.",
      );
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!liveDate) return;
    setToday(todayISO());
    const timer = window.setInterval(() => setToday(todayISO()), 60000);
    return () => window.clearInterval(timer);
  }, [liveDate]);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    (async () => {
      try {
        const old = await loadWorkspace().catch(() => null);
        if (old) {
          setData(seedIdCounters(old.data));
          setSource(old.buffer);
          setSourceName(old.filename);
          if (
            old.liveDate === false &&
            old.reportingDate &&
            Number.isFinite(toDay(old.reportingDate))
          ) {
            setLiveDate(false);
            setToday(old.reportingDate);
          }
          setSaveStatus("Saved in this browser");
        } else {
          await loadIncludedWorkbook();
        }
      } catch (e) {
        setMessage(
          "Local workspace could not be opened. Upload your last exported workbook. " +
            (e instanceof Error ? e.message : ""),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  useEffect(() => {
    if (!data || !source || loading || !canEdit) return;
    setSaveStatus("Saving…");
    const item = {
      data,
      buffer: source,
      filename: sourceName,
      reportingDate: today,
      liveDate,
    };
    const id = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveWorkspace(item));
      void saveQueue.current.then(
        () => {
          if (dataRef.current === item.data)
            setSaveStatus("Saved in this browser");
        },
        () => {
          if (dataRef.current === item.data) {
            setSaveStatus("Not saved — export a backup");
            setMessage(
              "Browser storage could not save your changes. Export your workbook now.",
            );
          }
        },
      );
    }, 100);
    return () => window.clearTimeout(id);
  }, [data, source, sourceName, loading, canEdit, today, liveDate]);
  useEffect(() => {
    if (saveStatus !== "Saving…") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveStatus]);
  useEffect(() => {
    setPageNo(0);
  }, [page, search, filters, data]);
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(""), 6500);
    return () => window.clearTimeout(id);
  }, [message]);
  const views = useMemo(
    () => (data ? objectiveViews(data, today) : []),
    [data, today],
  );
  const filtered = useMemo(
    () =>
      views
        .filter((o) => matchesFilters(o, filters))
        .filter(
          (o) =>
            !["Dashboard", "Insights"].includes(page) ||
            !search.trim() ||
            [
              o.id,
              o.description,
              o.goalName,
              o.ministry,
              o.role,
              o.owner,
              o.status,
              o.priority,
            ].some((v) =>
              v.toLowerCase().includes(search.trim().toLowerCase()),
            ),
        ),
    [views, filters, page, search],
  );
  const scopedIds = useMemo(
    () => new Set(filtered.map((o) => o.id)),
    [filtered],
  );
  const scopedKpis = useMemo(
    () => data?.kpis.filter((k) => scopedIds.has(k.objectiveId)) || [],
    [data, scopedIds],
  );
  const scopedUpdates = useMemo(
    () => data?.updates.filter((u) => scopedIds.has(u.objectiveId)) || [],
    [data, scopedIds],
  );
  const overview = useMemo(
    () => buildDashboard(filtered, scopedKpis),
    [filtered, scopedKpis],
  );
  const goalMap = useMemo(
    () => new Map(data?.goals.map((g) => [g.id, g]) || []),
    [data],
  );
  const searchLower = search.toLowerCase().trim();
  const matchText = (...xs: unknown[]) =>
    !searchLower ||
    xs.some((x) =>
      String(x ?? "")
        .toLowerCase()
        .includes(searchLower),
    );
  const allGoalRows = useMemo(
    () =>
      data?.goals.filter(
        (g) =>
          filtered.some((o) => o.goalId === g.id) ||
          Object.values(filters).every((v) => !v.length),
      ) || [],
    [data, filtered, filters],
  );
  const filterOptions = useMemo(() => {
    if (!data)
      return {} as Record<FilterKey, { value: string; label: string }[]>;
    const make = (a: string[]) => uniq(a).map((v) => ({ value: v, label: v }));
    return {
      ministry: make(views.map((o) => o.ministry)),
      goalId: make(views.map((o) => o.goalId)).map((o) => ({
        ...o,
        label: `${o.value} · ${goalMap.get(o.value)?.title || o.value}`,
      })),
      role: make(views.map((o) => o.role)),
      rating: make(views.map((o) => String(o.rating))).map((o) => ({
        ...o,
        label: `${o.value} · ${RATING_LABELS[Number(o.value)]}`,
      })),
      status: make(views.map((o) => o.status)),
      priority: make(views.map((o) => o.priority)),
      year: make(views.map((o) => o.year)),
    };
  }, [data, views, goalMap]);
  const activeFilterCount = Object.values(filters).reduce(
    (n, v) => n + v.length,
    0,
  );
  const go = (to: Page) => {
    setPage(to);
    setSearch("");
    setMobileMenu(false);
  };
  const changeFilters = (key: FilterKey, selection: string[]) =>
    setFilters((f) => ({ ...f, [key]: selection }));
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!/\.xlsx$/i.test(file.name)) {
      setMessage("Please select an .xlsx Excel workbook.");
      return;
    }
    if (!canEdit) return;
    setBusy(true);
    try {
      const buffer = await readWorkbookFile(file);
      const loaded = await importWorkbook(buffer, file.name);
      const issues = loaded.warnings || [];
      if (
        source &&
        !window.confirm(
          "Replace this workspace with " +
            file.name +
            "? Export your current changes first if you need to keep them.",
        )
      )
        return;
      await saveQueue.current.catch(() => {});
      setData(loaded.data);
      setSource(loaded.buffer);
      setSourceName(file.name);
      setLiveDate(loaded.liveDate !== false);
      setToday(loaded.reportingDate || todayISO());
      setFilters({ ...EMPTY_FILTERS });
      setSearch("");
      setModal(null);
      setDetail(null);
      go("Overview");
      setMessage(
        `Imported ${loaded.data.goals.length} goals, ${loaded.data.objectives.length} objectives, ${loaded.data.kpis.length} KPIs and ${loaded.data.updates.length} updates.${issues.length ? " Review " + issues.length + " integrity alerts." : ""}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Workbook import failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    if (!source || !data) return;
    setBusy(true);
    try {
      const blob = await exportWorkbook(source, data, today);
      const filename = "BBC_Perfomance_Dashboard_" + today + ".xlsx";
      downloadBlob(blob, filename);
      setMessage(
        "Updated Excel workbook exported. Open it in Excel to recalculate the native reports for the selected reporting date.",
      );
    } catch (e) {
      setMessage(
        "Export failed: " + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (
      !canEdit ||
      !window.confirm(
        "Clear this browser workspace? Export a backup before clearing. Your source workbook on disk is unchanged.",
      )
    )
      return;
    setBusy(true);
    try {
      await saveQueue.current.catch(() => {});
      await clearWorkspace();
      setData(blankData());
      setSource(null);
      setSourceName("No workbook loaded");
      setLiveDate(true);
      setToday(todayISO());
      setSaveStatus("No workbook loaded");
      setFilters({ ...EMPTY_FILTERS });
      go("Overview");
      setMessage("Workspace cleared. Upload a workbook to get started.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  };
  const saveRecord = (
    kind: Kind,
    form: Record<string, string>,
    previous?: Goal | Objective | KPI | Update,
  ): string | null => {
    if (!dataRef.current || !source)
      return "Upload a workbook before adding records.";
    if (!canEdit) return "Another tab is editing this workspace.";
    try {
      const result = saveRecordData(dataRef.current, kind, form, previous);
      dataRef.current = result.data;
      setData(result.data);
      setMessage(result.message);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  const removeRecord = (kind: Kind, id: string) => {
    if (!dataRef.current || !canEdit) return;
    try {
      const updated = deleteRecordData(dataRef.current, kind, id);
      if (
        !window.confirm(
          `Delete ${id}? This removes the record from this workspace. Export a backup first if needed.`,
        )
      )
        return;
      dataRef.current = updated;
      setData(updated);
      setMessage(`${id} deleted.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const actions = (kind: Kind, record: Goal | Objective | KPI | Update) => (
    <div className="row-actions">
      <button
        aria-label={`Edit ${record.id}`}
        disabled={!canEdit || busy}
        title="Edit record"
        onClick={() => setModal({ kind, record })}
      >
        <Settings2 size={15} />
      </button>
      <button
        aria-label={`Delete ${record.id}`}
        disabled={!canEdit || busy}
        title="Delete record"
        className="delete"
        onClick={() => removeRecord(kind, record.id)}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
  const add = (kind: Kind) => (
    <button
      className="primary small"
      disabled={!source || !canEdit || busy}
      onClick={() => setModal({ kind })}
    >
      <Plus size={16} /> Add {kind === "kpi" ? "KPI" : kind}
    </button>
  );
  const paginate = <T,>(rs: T[], size = 12) => ({
    total: rs.length,
    items: rs.slice(pageNo * size, pageNo * size + size),
    pages: Math.max(1, Math.ceil(rs.length / size)),
  });
  const tableFooter = (total: number, pages: number) => (
    <div className="table-foot">
      <span>
        Showing {total ? Math.min(pageNo * 12 + 1, total) : 0}–
        {Math.min((pageNo + 1) * 12, total)} of {total}
      </span>
      <div>
        <button
          aria-label="Previous page"
          disabled={pageNo === 0}
          onClick={() => setPageNo(Math.max(0, pageNo - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {pageNo + 1} of {pages}
        </span>
        <button
          aria-label="Next page"
          disabled={pageNo >= pages - 1}
          onClick={() => setPageNo(pageNo + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
  const sectionSummary = () =>
    data
      ? `Viewing ${filtered.length} of ${data.objectives.length} objectives in the current filter context.`
      : "";

  if (loading)
    return (
      <div className="initial-load">
        <div className="loading-mark">
          <BarChart3 size={32} />
        </div>
        <h2>Loading BBC Perfomance Dashboard</h2>
        <p>Reading the Excel data model…</p>
        <span className="spinner" />
      </div>
    );
  if (!data)
    return (
      <div className="initial-load">
        <AlertTriangle size={34} color="#d75f62" />
        <h2>Could not open workbook</h2>
        <p>{message}</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  const goalSummaries = summarizeBy(filtered, (o) => o.goalId).map((s) => ({
    ...s,
    label: goalMap.get(s.name)?.title || s.name,
    actualP: Number((s.actual * 100).toFixed(2)),
    plannedP: s.planned === null ? null : Number((s.planned * 100).toFixed(2)),
  }));
  const ministrySummaries = summarizeBy(filtered, (o) => o.ministry);
  const ratings = [1, 2, 3, 4, 5].map((n) => ({
    name: RATING_LABELS[n],
    rating: n,
    value: filtered.filter((o) => o.rating === n).length,
    fill: RATING_COLORS[n],
  }));
  const trend = monthlyTrend(filtered, scopedUpdates, today).map((r) => ({
    ...r,
    actual: withPercent(r.actual),
    kpi: withPercent(r.kpi),
  }));
  const attention = overview.exceptions.filter((o) =>
    matchText(o.id, o.description, o.goalName, o.ministry, o.attention),
  );
  const onTrackRate = filtered.length
    ? overview.onTrack / filtered.length
    : null;
  const thisPageDesc: Record<Page, string> = {
    Overview: "Helping our church turn vision into measurable progress.",
    Dashboard:
      "Live progress, ministry performance, risk and historical trends.",
    Goals: "Organizational strategic priorities and accountable leadership.",
    Objectives: "Track delivery, milestones and performance across teams.",
    "KPI Tracking":
      "Measure targets, actuals and outcomes for every objective.",
    Updates: "Historical progress entries and the latest delivery changes.",
    Insights: "Compare strategic goals, ministries and performance drivers.",
    "Data Quality":
      "Find missing information, invalid references and reporting risks.",
    Workbook: "Import and export your full Excel performance model.",
  };
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={"sidebar " + (mobileMenu ? "show" : "")}>
        <div className="brand" aria-label="BBC Perfomance Dashboard">
          <div className="brand-mark">
            <img src="/favicon.svg" alt="" />
          </div>
          <div>
            <strong>BBC</strong>
            <small>Perfomance Dashboard</small>
          </div>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {LINKS.slice(0, 7).map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "selected" : ""}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Data Quality" && <small>!</small>}
            </button>
          ))}
        </nav>
        <div className="side-label section-second">MANAGE</div>
        <nav aria-label="Workspace tools">
          {LINKS.slice(7).map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              className={page === name ? "selected" : ""}
              onClick={() => go(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-info">
            <div className="side-info-icon">
              <Sparkles size={17} />
            </div>
            <strong>Live performance</strong>
            <p>Dashboards refresh instantly as records change.</p>
            <button onClick={() => go("Insights")}>
              Explore insights <ArrowRight size={14} />
            </button>
          </div>
          <div className="side-foot">
            <span className="avatar">BBC</span>
            <div>
              <strong>Local workspace</strong>
              <small>Private to this browser</small>
            </div>
            <span className="status-online" />
          </div>
        </div>
      </aside>
      {mobileMenu && (
        <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />
      )}
      <main id="main-content" className="main">
        <header className="topbar">
          <div className="top-left">
            <button
              aria-label="Toggle navigation"
              aria-expanded={mobileMenu}
              className="mobile-toggle"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu size={21} />
            </button>
            <div className="breadcrumb">
              Workspace <ChevronRight size={14} /> <strong>{page}</strong>
            </div>
          </div>
          <div className="top-actions">
            {page !== "Overview" && page !== "Workbook" && (
              <label className="global-search">
                <Search size={15} />
                <input
                  aria-label="Search current records"
                  placeholder="Search records..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            )}
            <div
              className="reporting-control"
              title={"Calendar: " + REPORTING_TIMEZONE}
            >
              <label>
                <span>Reporting date</span>
                <input
                  aria-label="Reporting date"
                  type="date"
                  value={today}
                  onChange={(e) => {
                    if (Number.isFinite(toDay(e.target.value))) {
                      setLiveDate(false);
                      setToday(e.target.value);
                    }
                  }}
                />
              </label>
              <button
                className="date-today"
                aria-pressed={liveDate}
                onClick={() => {
                  setLiveDate(true);
                  setToday(todayISO());
                }}
              >
                Today
              </button>
            </div>
            <button
              className="secondary upload-button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !canEdit}
            >
              <UploadCloud size={17} /> Upload Excel
            </button>
            <button
              className="primary download-button"
              onClick={download}
              disabled={busy || !source}
            >
              <Download size={17} />
              {busy ? "Processing..." : "Export Excel"}
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-intro">
            <div>
              <div className="eyebrow">
                <span className="pulse-dot" /> PERFORMANCE CENTER /{" "}
                {page.toUpperCase()}
              </div>
              <h1>{page}</h1>
              <p>{thisPageDesc[page]}</p>
            </div>
            <div className="page-intro-right">
              <div
                className="workbook-name"
                title={
                  canEdit ? saveStatus : "View only — another tab is editing"
                }
              >
                <FileSpreadsheet size={16} />
                <span title={sourceName}>
                  {source ? sourceName : saveStatus}
                </span>
              </div>
            </div>
          </div>
          {page !== "Overview" && page !== "Workbook" && (
            <label className="mobile-search">
              <Search size={15} />
              <input
                placeholder="Search records..."
                aria-label="Search records"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          )}
          {page !== "Workbook" &&
            page !== "Overview" &&
            page !== "Data Quality" && (
              <Card className="filter-panel">
                <div className="filter-heading">
                  <div>
                    <Filter size={16} />
                    <strong>Dashboard filters</strong>
                    <span>Cross-filter all connected reports</span>
                  </div>
                  {activeFilterCount > 0 && (
                    <button
                      className="reset-filters"
                      onClick={() => setFilters({ ...EMPTY_FILTERS })}
                    >
                      <X size={14} /> Clear all ({activeFilterCount})
                    </button>
                  )}
                </div>
                <div className="filters">
                  {(
                    [
                      "ministry",
                      "goalId",
                      "role",
                      "rating",
                      "status",
                      "priority",
                      "year",
                    ] as FilterKey[]
                  ).map((key) => (
                    <FilterDropdown
                      key={key}
                      label={
                        {
                          ministry: "Ministry",
                          goalId: "Goal",
                          role: "Assigned role",
                          rating: "Status rating",
                          status: "Status",
                          priority: "Priority",
                          year: "Year",
                        }[key]
                      }
                      options={filterOptions[key] || []}
                      values={filters[key]}
                      onChange={(v) => changeFilters(key, v)}
                    />
                  ))}
                </div>
              </Card>
            )}
          {page === "Overview" && (
            <>
              <Welcome
                data={data}
                views={views}
                reportingDate={today}
                hasWorkspace={Boolean(source)}
                saveStatus={
                  canEdit ? saveStatus : "View only — another tab is editing"
                }
                onNavigate={go}
                onUpload={() => fileRef.current?.click()}
                busy={busy || !canEdit}
              />
              {!source && (
                <section className="included-workbook surface">
                  <h2>Open your included church workbook</h2>
                  <p>
                    {starterMessage ||
                      "Your original Excel workbook is included with this project."}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void loadIncludedWorkbook(starterPassword);
                    }}
                  >
                    <label>
                      Workbook password
                      <input
                        type="password"
                        autoComplete="off"
                        value={starterPassword}
                        onChange={(e) => setStarterPassword(e.target.value)}
                      />
                    </label>
                    <button className="primary" disabled={busy} type="submit">
                      Load included workbook
                    </button>
                  </form>
                  <p>
                    Your Vercel administrator sets the password. You can also
                    use Upload Excel without a password.
                  </p>
                </section>
              )}
            </>
          )}
          {page === "Dashboard" && (
            <div className="page-stack">
              <div className="metric-grid">
                <Metric
                  icon={GoalIcon}
                  label="Goals represented"
                  value={overview.goals}
                  sub="Goals with matching objectives"
                  tone="blue"
                />
                <Metric
                  icon={Target}
                  label="Total objectives"
                  value={overview.objectives}
                  sub="Currently in view"
                  tone="purple"
                />
                <Metric
                  icon={TrendingUp}
                  label="Actual completion"
                  value={fmt(overview.actual)}
                  sub="Average across objectives"
                  tone="teal"
                />
                <Metric
                  icon={CalendarDays}
                  label="Planned completion"
                  value={fmt(overview.planned)}
                  sub="Time-elapsed schedule"
                  tone="blue"
                />
                <Metric
                  icon={
                    overview.variance !== null && overview.variance < 0
                      ? ArrowDownRight
                      : ArrowUpRight
                  }
                  label="Progress variance"
                  value={formatDelta(overview.variance)}
                  sub="Actual minus planned"
                  tone={
                    overview.variance !== null && overview.variance < -0.15
                      ? "red"
                      : "amber"
                  }
                />
                <Metric
                  icon={CheckCircle2}
                  label="On track"
                  value={overview.onTrack}
                  sub={`${fmt(onTrackRate)} of all objectives`}
                  tone="green"
                />
                <Metric
                  icon={AlertTriangle}
                  label="At risk"
                  value={overview.atRisk}
                  sub="Rating 1–2 (may overlap overdue)"
                  tone="amber"
                />
                <Metric
                  icon={Clock3}
                  label="Overdue"
                  value={overview.overdue}
                  sub="Past end date and incomplete"
                  tone="red"
                />
                <Metric
                  icon={Activity}
                  label="KPI achievement"
                  value={fmt(overview.kpi)}
                  sub="Average across selected KPIs"
                  tone="purple"
                />
                <Metric
                  icon={Activity}
                  label="Total KPIs"
                  value={overview.kpis}
                  sub="Linked to selected objectives"
                  tone="blue"
                />
                <Metric
                  icon={CheckCircle2}
                  label="Completed objectives"
                  value={overview.completed}
                  sub="Actual completion at 100%"
                  tone="green"
                />
                <Metric
                  icon={AlertCircle}
                  label="KPI below 80%"
                  value={overview.underperforming}
                  sub="Objectives below the workbook threshold"
                  tone="amber"
                />
              </div>
              <div className="chart-grid">
                <ChartBox
                  empty={!filtered.length}
                  title="Goal performance"
                  sub="Actual completion vs. planned completion (%)"
                >
                  <div className="chart-content">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={goalSummaries}
                        margin={{ left: -17, right: 10, top: 12, bottom: 4 }}
                      >
                        <CartesianGrid vertical={false} stroke="#edf1f5" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 13, fill: "#46566d" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 13, fill: "#46566d" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v, name) => [`${v}%`, name]}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: 13 }}
                        />
                        <Bar
                          dataKey="plannedP"
                          name="Planned"
                          fill="#b18a35"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={25}
                        />
                        <Bar
                          dataKey="actualP"
                          name="Actual"
                          fill="#783eb0"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={25}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartBox>
                <ChartBox
                  empty={!filtered.length}
                  title="Status rating mix"
                  sub="Distribution across five performance levels"
                >
                  <div className="rating-chart">
                    <div className="donut-holder">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={ratings.filter((r) => r.value > 0)}
                            dataKey="value"
                            innerRadius={66}
                            outerRadius={96}
                            strokeWidth={4}
                            stroke="#fff"
                            paddingAngle={3}
                          >
                            {ratings
                              .filter((r) => r.value > 0)
                              .map((r) => (
                                <Cell key={r.rating} fill={r.fill} />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-label">
                        <b>{filtered.length}</b>
                        <span>Objectives</span>
                      </div>
                    </div>
                    <div className="rating-legend">
                      {ratings.map((r) => (
                        <div key={r.rating}>
                          <span
                            className="legend-circle"
                            style={{ background: r.fill }}
                          />
                          <span>{r.name}</span>
                          <strong>{r.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </ChartBox>
              </div>
              <div className="chart-grid">
                <ChartBox
                  empty={!filtered.length}
                  title="Ministry risk profile"
                  sub="Overdue first; remaining objectives grouped by status rating"
                >
                  <div className="chart-content">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={ministrySummaries.map((s) => {
                          const risk = filtered.filter(
                            (o) =>
                              o.ministry === s.name && o.atRisk && !o.overdue,
                          ).length;
                          return {
                            ...s,
                            atRisk: risk,
                            other: s.count - s.overdue - s.onTrack - risk,
                          };
                        })}
                        layout="vertical"
                        margin={{ left: 9, right: 18, bottom: 5, top: 5 }}
                      >
                        <CartesianGrid horizontal={false} stroke="#edf1f5" />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fontSize: 13, fill: "#46566d" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={145}
                          tick={{ fontSize: 13, fill: "#46566d" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: 13 }}
                        />
                        <Bar
                          dataKey="overdue"
                          stackId="s"
                          name="Overdue"
                          fill="#ba3a4c"
                          maxBarSize={21}
                        />
                        <Bar
                          dataKey="onTrack"
                          stackId="s"
                          name="On track"
                          fill="#2f8a72"
                          maxBarSize={21}
                        />
                        <Bar
                          dataKey="atRisk"
                          stackId="s"
                          name="At risk"
                          fill="#b8752b"
                          maxBarSize={21}
                        />
                        <Bar
                          dataKey="other"
                          stackId="s"
                          name="Other"
                          fill="#8293ab"
                          radius={[4, 4, 4, 4]}
                          maxBarSize={21}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartBox>
                <ChartBox
                  empty={
                    !trend.some((t) => t.actual !== null || t.kpi !== null)
                  }
                  title="12-month performance trend"
                  sub="Monthly update averages, including the reporting month; gaps mean no observations"
                >
                  <div className="chart-content">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trend}
                        margin={{ left: -12, right: 12, top: 12, bottom: 7 }}
                      >
                        <CartesianGrid vertical={false} stroke="#edf1f5" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 13, fill: "#46566d" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `${v}%`}
                          tick={{ fontSize: 13, fill: "#46566d" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v, name) => [`${v}%`, name]}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: 13 }}
                        />
                        <Line
                          dataKey="actual"
                          name="Completion"
                          connectNulls={false}
                          stroke="#783eb0"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                        />
                        <Line
                          dataKey="kpi"
                          name="KPI achievement"
                          connectNulls={false}
                          stroke="#51b99d"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ChartBox>
              </div>
              <Card className="table-card">
                <SectionHead
                  title="Attention required"
                  description="Priority-ranked exceptions based on workbook severity logic."
                  action={
                    <button
                      className="link-action"
                      onClick={() => go("Objectives")}
                    >
                      View objectives <ArrowRight size={15} />
                    </button>
                  }
                />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>OBJECTIVE</th>
                        <th>MINISTRY</th>
                        <th>RATING</th>
                        <th>VARIANCE</th>
                        <th>KPI</th>
                        <th>ISSUE</th>
                        <th>SCORE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attention.slice(0, 10).map((o) => (
                        <tr key={o.id}>
                          <td className="main-cell">
                            <button
                              className="id-link"
                              onClick={() => setDetail(o.id)}
                            >
                              {o.id}
                            </button>
                            <span>{o.description}</span>
                          </td>
                          <td>{o.ministry}</td>
                          <td>
                            <Rating rating={o.rating} />
                          </td>
                          <td>
                            <span className={colorVariance(o.variance)}>
                              {formatDelta(o.variance)}
                            </span>
                          </td>
                          <td>{fmt(o.achievement)}</td>
                          <td>
                            <Pill tone={o.overdue ? "red" : "amber"}>
                              {o.attention}
                            </Pill>
                          </td>
                          <td>
                            <b>{o.exceptionScore}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!attention.length && (
                    <Empty text="No exceptions for the current filters." />
                  )}
                </div>
              </Card>
            </div>
          )}
          {page === "Goals" &&
            (() => {
              const rows = allGoalRows.filter((g) =>
                matchText(g.id, g.title, g.owner, g.description),
              );
              const p = paginate(rows);
              return (
                <div className="page-stack">
                  <div className="report-bar">
                    <span>
                      {rows.length} strategic goals · {sectionSummary()}
                    </span>
                    {add("goal")}
                  </div>
                  <div className="goal-grid">
                    {p.items.map((g) => {
                      const s = filtered.filter((o) => o.goalId === g.id);
                      const a = avg(s.map((o) => o.actual));
                      const score = goalSummaries.find((x) => x.name === g.id);
                      return (
                        <Card key={g.id} className="goal-card">
                          <div className="goal-top">
                            <span className="id-label">{g.id}</span>
                            <Pill
                              tone={g.active === "Active" ? "teal" : "neutral"}
                            >
                              {g.active}
                            </Pill>
                          </div>
                          <h3>{g.title}</h3>
                          <p>{g.description}</p>
                          <div className="goal-performance">
                            <Pill
                              tone={
                                score?.performance === "Attention" ||
                                score?.performance === "At Risk"
                                  ? "amber"
                                  : score?.performance === "Ahead of Plan" ||
                                      score?.performance === "On Plan"
                                    ? "green"
                                    : "neutral"
                              }
                            >
                              {score?.performance || "No Data"}
                            </Pill>
                          </div>
                          <div className="goal-line">
                            <span>Accountable</span>
                            <strong>{g.owner}</strong>
                          </div>
                          <div className="goal-line">
                            <span>Objectives</span>
                            <strong>{s.length}</strong>
                          </div>
                          <div className="goal-line">
                            <span>Avg. completion</span>
                            <strong>{fmt(a)}</strong>
                          </div>
                          <div className="goal-line">
                            <span>Avg. KPI achievement</span>
                            <strong>{fmt(score?.kpi)}</strong>
                          </div>
                          <Progress value={a || 0} />
                          <div className="goal-actions">
                            <button
                              onClick={() => {
                                setFilters({
                                  ...EMPTY_FILTERS,
                                  goalId: [g.id],
                                });
                                go("Objectives");
                              }}
                            >
                              View objectives <ArrowRight size={14} />
                            </button>
                            {actions("goal", g)}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  {!rows.length && <Empty />}
                  {tableFooter(p.total, p.pages)}
                </div>
              );
            })()}
          {page === "Objectives" &&
            (() => {
              const rows = filtered
                .filter((o) =>
                  matchText(
                    o.id,
                    o.goalName,
                    o.description,
                    o.ministry,
                    o.role,
                    o.owner,
                    o.status,
                    o.priority,
                  ),
                )
                .sort((a, b) =>
                  sortBy === "id"
                    ? a.id.localeCompare(b.id)
                    : sortBy === "date"
                      ? a.endDate.localeCompare(b.endDate)
                      : sortBy === "progress"
                        ? b.actual - a.actual
                        : b.exceptionScore - a.exceptionScore ||
                          b.sourceIndex - a.sourceIndex,
                );
              const p = paginate(rows);
              return (
                <div className="page-stack">
                  <div className="report-bar">
                    <span>{rows.length} matching objectives</span>
                    <label className="sort-control">
                      Sort objectives
                      <select
                        aria-label="Sort objectives"
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value);
                          setPageNo(0);
                        }}
                      >
                        <option value="severity">Exception severity</option>
                        <option value="id">Objective ID</option>
                        <option value="date">Due date</option>
                        <option value="progress">Completion</option>
                      </select>
                    </label>
                    {add("objective")}
                  </div>
                  <Card className="table-card">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>OBJECTIVE</th>
                            <th>GOAL / MINISTRY</th>
                            <th>PROGRESS</th>
                            <th>VARIANCE</th>
                            <th>STATUS RATING</th>
                            <th>PRIORITY</th>
                            <th>END DATE</th>
                            <th>ATTENTION</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((o) => (
                            <tr key={o.id}>
                              <td className="main-cell wide">
                                <button
                                  className="id-link"
                                  onClick={() => setDetail(o.id)}
                                >
                                  {o.id}
                                </button>
                                <span>{o.description}</span>
                              </td>
                              <td className="two-line">
                                <strong>{o.goalName}</strong>
                                <span>{o.ministry}</span>
                              </td>
                              <td>
                                <Progress
                                  value={o.actual}
                                  planned={o.planned}
                                />
                              </td>
                              <td>
                                <span className={colorVariance(o.variance)}>
                                  {formatDelta(o.variance)}
                                </span>
                              </td>
                              <td>
                                <Rating rating={o.rating} />
                              </td>
                              <td>
                                <Pill
                                  tone={
                                    o.priority === "Critical"
                                      ? "red"
                                      : o.priority === "High"
                                        ? "amber"
                                        : "neutral"
                                  }
                                >
                                  {o.priority}
                                </Pill>
                              </td>
                              <td className="date-cell">{o.endDate || "—"}</td>
                              <td>
                                {o.attention ? (
                                  <Pill tone={o.overdue ? "red" : "amber"}>
                                    {o.attention}
                                  </Pill>
                                ) : (
                                  <Pill tone="green">Clear</Pill>
                                )}
                              </td>
                              <td>{actions("objective", o)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!rows.length && <Empty />}
                    </div>
                    {tableFooter(p.total, p.pages)}
                  </Card>
                </div>
              );
            })()}
          {page === "KPI Tracking" &&
            (() => {
              const rows = scopedKpis.filter((k) =>
                matchText(
                  k.id,
                  k.objectiveId,
                  k.name,
                  k.description,
                  k.unit,
                  k.comment,
                ),
              );
              const p = paginate(rows);
              return (
                <div className="page-stack">
                  <div className="report-bar">
                    <span>
                      {rows.length} KPIs across{" "}
                      {new Set(rows.map((r) => r.objectiveId)).size} objectives
                    </span>
                    {add("kpi")}
                  </div>
                  <div className="mini-metrics">
                    <div>
                      <span>KPIs meeting target</span>
                      <strong>
                        {
                          rows.filter(
                            (k) => (kpiAchievement(k) ?? -Infinity) >= 1,
                          ).length
                        }
                      </strong>
                    </div>
                    <div>
                      <span>Below target</span>
                      <strong>
                        {
                          rows.filter(
                            (k) => (kpiAchievement(k) ?? Infinity) < 1,
                          ).length
                        }
                      </strong>
                    </div>
                    <div>
                      <span>Average KPI achievement</span>
                      <strong>{fmt(avg(rows.map(kpiAchievement)))}</strong>
                    </div>
                  </div>
                  <Card className="table-card">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>KPI ID</th>
                            <th>MEASURE</th>
                            <th>OBJECTIVE</th>
                            <th>TARGET</th>
                            <th>ACTUAL</th>
                            <th>ACHIEVEMENT</th>
                            <th>STATUS</th>
                            <th>MEASURED</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((k) => {
                            const a = kpiAchievement(k);
                            return (
                              <tr key={k.id}>
                                <td>
                                  <strong>{k.id}</strong>
                                </td>
                                <td className="main-cell wide">
                                  <strong>{k.name}</strong>
                                  <span>{k.description}</span>
                                </td>
                                <td>{k.objectiveId}</td>
                                <td>
                                  {k.target === null
                                    ? "—"
                                    : k.unit === "%"
                                      ? fmt(k.target)
                                      : k.target.toLocaleString() +
                                        " " +
                                        k.unit}
                                </td>
                                <td>
                                  {k.actual === null
                                    ? "—"
                                    : k.unit === "%"
                                      ? fmt(k.actual)
                                      : k.actual.toLocaleString() +
                                        " " +
                                        k.unit}
                                </td>
                                <td>
                                  <strong
                                    className={
                                      a !== null && a >= 1 ? "good" : "bad"
                                    }
                                  >
                                    {fmt(a)}
                                  </strong>
                                </td>
                                <td>
                                  {a === null ? (
                                    <Pill>Not measured</Pill>
                                  ) : a >= 1 ? (
                                    <Pill tone="green">Met / Exceeded</Pill>
                                  ) : (
                                    <Pill tone="amber">Below Target</Pill>
                                  )}
                                </td>
                                <td className="date-cell">
                                  {k.measurementDate}
                                </td>
                                <td>{actions("kpi", k)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!rows.length && <Empty />}
                    </div>
                    {tableFooter(p.total, p.pages)}
                  </Card>
                </div>
              );
            })()}
          {page === "Updates" &&
            (() => {
              const rows = scopedUpdates
                .filter((u) =>
                  matchText(u.id, u.objectiveId, u.comment, u.date),
                )
                .sort(
                  (a, b) =>
                    b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
                );
              const p = paginate(rows);
              return (
                <div className="page-stack">
                  <div className="report-bar">
                    <span>{rows.length} historical records · Latest first</span>
                    {add("update")}
                  </div>
                  <Card className="table-card">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>UPDATE</th>
                            <th>OBJECTIVE</th>
                            <th>UPDATE DATE</th>
                            <th>COMPLETION</th>
                            <th>RATING</th>
                            <th>KPI ACHIEVEMENT</th>
                            <th>COMMENT</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((u) => (
                            <tr key={u.id}>
                              <td>
                                <strong>{u.id}</strong>
                              </td>
                              <td>{u.objectiveId}</td>
                              <td className="date-cell">{u.date}</td>
                              <td>
                                <Progress value={u.actual} />
                              </td>
                              <td>
                                <Rating rating={u.rating} />
                              </td>
                              <td>{fmt(u.achievement)}</td>
                              <td className="comment-cell">
                                {u.comment || "—"}
                              </td>
                              <td>{actions("update", u)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!rows.length && <Empty />}
                    </div>
                    {tableFooter(p.total, p.pages)}
                  </Card>
                  <div className="hint">
                    <Clock3 size={16} /> Updates are historical snapshots.
                    Select “Also apply” in the editor to change current
                    completion and rating. Editing or deleting history alone
                    never rewinds the current objective.
                  </div>
                </div>
              );
            })()}
          {page === "Insights" && (
            <div className="page-stack">
              <div className="insight-banner">
                <div className="insight-icon">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3>Performance intelligence</h3>
                  <p>
                    Live, filter-aware comparisons across goals and ministries.
                    Percentage variance is shown in percentage points.
                  </p>
                </div>
              </div>
              <Card className="table-card">
                <SectionHead
                  title="Strategic goal scorecard"
                  description="Roll-up of all objectives assigned to each strategic goal."
                />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>STRATEGIC GOAL</th>
                        <th>OBJECTIVES</th>
                        <th>PLANNED</th>
                        <th>ACTUAL</th>
                        <th>VARIANCE</th>
                        <th>ON TRACK</th>
                        <th>AT RISK</th>
                        <th>OVERDUE</th>
                        <th>KPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goalSummaries.map((s) => (
                        <tr key={s.name}>
                          <td className="two-line">
                            <strong>
                              {s.name} · {s.label}
                            </strong>
                          </td>
                          <td>{s.count}</td>
                          <td>{fmt(s.planned)}</td>
                          <td>
                            <Progress value={s.actual} />
                          </td>
                          <td className={colorVariance(s.variance)}>
                            {formatDelta(s.variance)}
                          </td>
                          <td className="good">{s.onTrack}</td>
                          <td className="bad">{s.atRisk}</td>
                          <td className="bad">{s.overdue}</td>
                          <td>{fmt(s.kpi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!goalSummaries.length && <Empty />}
                </div>
              </Card>
              <Card className="table-card">
                <SectionHead
                  title="Ministry scorecard"
                  description="Team-level progress and areas that need intervention."
                />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>MINISTRY</th>
                        <th>GOALS</th>
                        <th>OBJECTIVES</th>
                        <th>AVG RATING</th>
                        <th>PLANNED</th>
                        <th>ACTUAL</th>
                        <th>VARIANCE</th>
                        <th>OVERDUE</th>
                        <th>KPI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ministrySummaries.map((s) => (
                        <tr key={s.name}>
                          <td>
                            <strong>{s.name}</strong>
                          </td>
                          <td>{s.goalCount}</td>
                          <td>{s.count}</td>
                          <td>{s.rating.toFixed(1)} / 5</td>
                          <td>{fmt(s.planned)}</td>
                          <td>
                            <Progress value={s.actual} />
                          </td>
                          <td className={colorVariance(s.variance)}>
                            {formatDelta(s.variance)}
                          </td>
                          <td className={s.overdue ? "bad" : ""}>
                            {s.overdue}
                          </td>
                          <td>{fmt(s.kpi)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!ministrySummaries.length && <Empty />}
                </div>
              </Card>
              <div className="chart-grid">
                <ChartBox
                  empty={!filtered.length}
                  title="Completion by priority"
                  sub="Progress by business priority"
                >
                  <div className="chart-content">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart
                        data={summarizeBy(filtered, (o) => o.priority).map(
                          (x) => ({ ...x, value: Math.round(x.actual * 100) }),
                        )}
                      >
                        <CartesianGrid vertical={false} stroke="#edf1f5" />
                        <XAxis
                          dataKey="name"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => v + "%"}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar
                          dataKey="value"
                          name="Completion %"
                          fill="#783eb0"
                          radius={[7, 7, 0, 0]}
                          maxBarSize={56}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartBox>
                <ChartBox
                  empty={!filtered.length}
                  title="Delivery status"
                  sub="Distribution across objective status categories"
                >
                  <div className="chart-content">
                    <ResponsiveContainer height="100%" width="100%">
                      <PieChart>
                        <Pie
                          data={summarizeBy(filtered, (o) => o.status)}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="48%"
                          outerRadius={100}
                          labelLine={false}
                        >
                          {summarizeBy(filtered, (o) => o.status).map((s) => (
                            <Cell
                              key={s.name}
                              fill={STATUS_COLORS[s.name] || "#8293ab"}
                            />
                          ))}
                        </Pie>
                        <Legend
                          iconType="circle"
                          wrapperStyle={{ fontSize: 13 }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartBox>
              </div>
              <ChartBox
                className="ministry-kpi-chart"
                empty={!scopedKpis.some((k) => kpiAchievement(k) !== null)}
                title="KPI achievement by ministry"
                sub="Average of KPI rows, matching Analysis column O; scorecards above average objective results."
              >
                <div className="chart-content">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ministrySummaries.map((s) => {
                        const ids = new Set(
                          filtered
                            .filter((o) => o.ministry === s.name)
                            .map((o) => o.id),
                        );
                        return {
                          name: s.name,
                          value: withPercent(
                            avg(
                              scopedKpis
                                .filter((k) => ids.has(k.objectiveId))
                                .map(kpiAchievement),
                            ),
                          ),
                        };
                      })}
                      layout="vertical"
                      margin={{ left: 15, right: 25, top: 10, bottom: 5 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#edf1f5" />
                      <XAxis type="number" tickFormatter={(v) => `${v}%`} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={150}
                        tick={{ fontSize: 13, fill: "#46566d" }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [`${v}%`, "KPI achievement"]}
                      />
                      <Bar
                        dataKey="value"
                        name="KPI achievement"
                        fill="#612b87"
                        radius={[0, 5, 5, 0]}
                        maxBarSize={28}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartBox>
            </div>
          )}
          {page === "Data Quality" &&
            (() => {
              const issues = validateDataset(data),
                structural = validateRelationships(data),
                missingKpis = data.kpis.filter(
                  (k) => kpiAchievement(k) === null,
                );
              return (
                <div className="page-stack">
                  <div className="quality-banner">
                    <div
                      className={
                        "quality-icon " + (issues.length ? "warning" : "clean")
                      }
                    >
                      {issues.length ? (
                        <AlertTriangle size={23} />
                      ) : (
                        <ShieldCheck size={23} />
                      )}
                    </div>
                    <div>
                      <h3>
                        {issues.length
                          ? `${issues.length} data checks need review`
                          : "All key integrity checks passed"}
                      </h3>
                      <p>
                        Checks cover all four record types, required fields,
                        dates, numeric values, duplicate snapshots and record
                        relationships.
                      </p>
                    </div>
                  </div>
                  <div className="mini-metrics">
                    <div>
                      <span>Objectives with field issues</span>
                      <strong>
                        {views.filter((v) => v.dataQuality.length).length}
                      </strong>
                    </div>
                    <div>
                      <span>Relationship or ID errors</span>
                      <strong>{structural.length}</strong>
                    </div>
                    <div>
                      <span>Unavailable KPI achievements</span>
                      <strong>{missingKpis.length}</strong>
                    </div>
                  </div>
                  <Card className="table-card">
                    <SectionHead
                      title="Validation results"
                      description="Correct flagged records in their management pages. Import never substitutes zero for missing progress."
                    />
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>RECORD</th>
                            <th>FINDING</th>
                            <th>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {issues.map((issue, index) => (
                            <tr key={issue + index}>
                              <td>
                                <strong>
                                  {issue.includes(":")
                                    ? issue.split(":")[0]
                                    : "Workspace"}
                                </strong>
                              </td>
                              <td className="comment-cell">{issue}</td>
                              <td>
                                <Pill tone="amber">Needs review</Pill>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!issues.length && (
                        <div className="success-empty">
                          <ShieldCheck size={33} />
                          <h3>Validated successfully</h3>
                          <p>
                            No required-field, relationship, date or numeric
                            issues were detected.
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })()}
          {page === "Workbook" && (
            <div className="page-stack">
              <div className="import-grid">
                <Card className="import-card">
                  <div className="import-icon blue">
                    <CloudUpload size={28} />
                  </div>
                  <h2>Upload a workbook</h2>
                  <p>
                    Load another Excel file in the same 8-sheet format. The app
                    reads four source tables and controlled lists, then
                    recalculates everything.
                  </p>
                  <button
                    className="primary"
                    onClick={() => fileRef.current?.click()}
                    disabled={busy || !canEdit}
                  >
                    <UploadCloud size={17} /> Choose .xlsx file
                  </button>
                  <small>Excel .xlsx · Maximum 30 MB compressed</small>
                </Card>
                <Card className="import-card">
                  <div className="import-icon green">
                    <FileSpreadsheet size={28} />
                  </div>
                  <h2>Export your changes</h2>
                  <p>
                    Download the updated original Excel file, retaining its
                    existing chart, slicer, formatting and formula parts for
                    Excel to refresh.
                  </p>
                  <button
                    className="primary"
                    onClick={download}
                    disabled={busy || !source}
                  >
                    <Download size={17} /> Download updated Excel
                  </button>
                  <small>
                    All Goals, Objectives, KPIs and Updates included
                  </small>
                </Card>
              </div>
              <Card className="dataset-detail">
                <SectionHead
                  title="Current workbook"
                  description="Local workspace summary"
                />
                <div className="detail-rows">
                  <div>
                    <span>Source filename</span>
                    <strong>{sourceName}</strong>
                  </div>
                  <div>
                    <span>Strategic goals</span>
                    <strong>{data.goals.length}</strong>
                  </div>
                  <div>
                    <span>Objectives</span>
                    <strong>{data.objectives.length}</strong>
                  </div>
                  <div>
                    <span>KPIs</span>
                    <strong>{data.kpis.length}</strong>
                  </div>
                  <div>
                    <span>Historical updates</span>
                    <strong>{data.updates.length}</strong>
                  </div>
                  <div>
                    <span>Reporting date</span>
                    <strong>
                      {today} · {REPORTING_TIMEZONE}
                    </strong>
                  </div>
                  <div>
                    <span>Save status</span>
                    <strong>{saveStatus}</strong>
                  </div>
                  <div>
                    <span>Data storage</span>
                    <strong>IndexedDB · this browser</strong>
                  </div>
                </div>
                <div className="workspace-actions">
                  <button
                    className="secondary"
                    onClick={reset}
                    disabled={!source || !canEdit || busy}
                  >
                    <RefreshCcw size={16} /> Clear this workspace
                  </button>
                </div>
              </Card>
              <div className="hint">
                <AlertCircle size={18} /> The React app recalculates its own
                dashboard immediately. Export saves the selected reporting date.
                Open the file in Microsoft Excel to recalculate native reports.
                Original Excel charts and slicers keep their template
                capacities; use this app for reporting beyond those ranges. This
                browser workspace has no multiuser sync or cloud backup.
              </div>
            </div>
          )}
        </div>
      </main>
      <input
        ref={fileRef}
        aria-label="Upload Excel workbook"
        hidden
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={upload}
      />
      {detail && views.find((o) => o.id === detail) && (
        <ObjectiveDetail
          row={views.find((o) => o.id === detail)!}
          data={data}
          onClose={() => setDetail(null)}
          onEdit={() => {
            if (!canEdit) return;
            const obj = data.objectives.find((o) => o.id === detail);
            setDetail(null);
            if (obj) setModal({ kind: "objective", record: obj });
          }}
        />
      )}
      {modal && (
        <Editor
          key={`${modal.kind}-${modal.record?.id || "new"}`}
          modal={modal}
          data={data}
          onClose={() => setModal(null)}
          onSave={saveRecord}
        />
      )}
      {message && (
        <div className="toast" role="status">
          <span>
            <CheckCircle2 size={19} />
            {message}
          </span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
