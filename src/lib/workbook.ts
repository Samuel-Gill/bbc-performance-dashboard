import JSZip from "jszip";
import type { DataSet, Goal, Objective, KPI, Update, Lists } from "./domain";
import {
  DEFAULT_LISTS,
  CHURCH_ROLES,
  RATING_LABELS,
  objectiveViews,
  kpiAchievement,
  todayISO,
  toDay,
  seedIdCounters,
  validateDataset,
  validateRelationships,
  REPORTING_TIMEZONE,
} from "./domain";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
export const schema = {
  Goals: [
    "Goal ID",
    "BBC Strategic Goal",
    "Accountable Person",
    "Goal Description",
    "Active",
  ],
  "Objective Entry": [
    "Objective ID",
    "Goal ID",
    "Objective Description",
    "Ministry",
    "Assigned Role",
    "Accountable Person",
    "Status Rating",
    "Start Date",
    "End Date",
    "Planned Completion %",
    "Actual Completion %",
    "Variance %",
    "Objective Status",
    "Priority",
    "Comments",
    "Last Update Date",
    "Last Updated By",
    "Days Remaining",
    "Overdue",
    "KPI Achievement %",
    "Data Quality Check",
    "Attention Flag",
    "Exception Score",
    "Dashboard Include",
    "Filtered Exception Key",
    "Primary KPI ID",
    "Dashboard Year",
    "Goal Description",
    "Status Description",
  ],
  "KPI Tracking": [
    "KPI ID",
    "Objective ID",
    "KPI Name",
    "KPI Description",
    "Unit",
    "Target",
    "Actual",
    "KPI Achievement %",
    "KPI Status",
    "Measurement Date",
    "Comment",
    "Goal ID",
    "Ministry",
    "Assigned Role",
    "Priority",
    "Objective Status",
    "Status Rating",
    "Dashboard Include",
  ],
  "Objective Updates": [
    "Update ID",
    "Objective ID",
    "Update Date",
    "Actual Completion %",
    "Status Rating",
    "KPI Achievement %",
    "Update Comment",
    "Goal ID",
    "Ministry",
    "Assigned Role",
    "Priority",
    "Objective Status",
    "Dashboard Include",
  ],
} as const;
type SheetName = keyof typeof schema;
// The church's v2 template renamed only the last calculated objective column.
// Treat it as an alias, NOT a new field or an extra column: keep all other
// schema and ordering checks strict to avoid silently corrupting Excel exports.
const COLUMN_ALIASES: Partial<
  Record<SheetName, Record<string, readonly string[]>>
> = {
  "Objective Entry": { "Status Description": ["Objective Status Description"] },
};
function columnMatches(name: SheetName, expected: string, actual: string) {
  return (
    actual === expected ||
    (COLUMN_ALIASES[name]?.[expected] || []).includes(actual)
  );
}
function canonicalColumn(name: SheetName, actual: string) {
  return schema[name].find((expected) => columnMatches(name, expected, actual));
}
const tableName: Record<SheetName, string> = {
  Goals: "tblGoals",
  "Objective Entry": "tblObjectives",
  "KPI Tracking": "tblKPI",
  "Objective Updates": "tblObjectiveUpdates",
};
const parser = new DOMParser();
const serializer = new XMLSerializer();
const children = (el: Element, local: string) =>
  Array.from(el.children).filter((c) => c.localName === local);
const first = (el: Element, local: string) => children(el, local)[0];
const xmlParse = (str: string) => {
  if (/<!DOCTYPE|<!ENTITY/i.test(str))
    throw new Error("Workbook XML cannot contain DTD or entity declarations.");
  const doc = parser.parseFromString(str, "application/xml");
  if (doc.querySelector("parsererror"))
    throw new Error("Invalid workbook XML.");
  return doc;
};
const textContent = (el: Element) =>
  Array.from(el.getElementsByTagName("*"))
    .filter((x) => x.localName === "t")
    .map((x) => x.textContent || "")
    .join("");
export function serialToDate(
  x: string | number | null | undefined,
  date1904 = false,
) {
  if (x === null || x === undefined || x === "") return "";
  if (typeof x === "string" && !/^[-+]?\d+(\.\d+)?$/.test(x))
    return /^\d{4}-\d{2}-\d{2}T/.test(x) ? x.slice(0, 10) : x;
  const serial = Math.floor(Number(x));
  if (
    !Number.isFinite(serial) ||
    serial < 0 ||
    serial > 2958465 ||
    (!date1904 && serial === 60)
  )
    throw new Error(
      `Unsupported Excel date serial: ${x}. Use a valid calendar date.`,
    );
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(
    epoch + (serial + (!date1904 && serial < 60 ? 1 : 0)) * 86400000,
  )
    .toISOString()
    .slice(0, 10);
}
export function dateToSerial(s: string, date1904 = false) {
  const day = toDay(s);
  if (!Number.isFinite(day)) return null;
  if (date1904) return day - Date.UTC(1904, 0, 1) / 86400000;
  const serial = day - Date.UTC(1899, 11, 30) / 86400000;
  return serial < 61 ? serial - 1 : serial;
}
const number = (v: unknown, context = "numeric value") => {
  if (
    v === null ||
    v === undefined ||
    String(v).trim() === "" ||
    !Number.isFinite(Number(v))
  )
    throw new Error(
      `${context}: enter a numeric value. If this input is a formula, open and save it in Excel to refresh its result first.`,
    );
  return Number(v);
};
const optionalNumber = (v: unknown, context = "numeric value") =>
  v === null || v === undefined || v === "" ? null : number(v, context);
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const col = (n: number) => {
  let out = "";
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26))
    out = String.fromCharCode(65 + ((i - 1) % 26)) + out;
  return out;
};
const colNumber = (letters: string) =>
  letters.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
const baseName = (path: string) => path.replace(/^\//, "").replace(/^\.\//, "");
const normPath = (path: string) => {
  const parts = (
    path.startsWith("/")
      ? baseName(path)
      : path.startsWith("xl/")
        ? path
        : "xl/" + path
  ).split("/");
  const result: string[] = [];
  for (const p of parts) {
    if (p === "..") result.pop();
    else if (p && p !== ".") result.push(p);
  }
  return result.join("/");
};

// Bound expansion before asking JSZip to inflate any user-controlled worksheet.
function inspectZipSize(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("This file is not a valid .xlsx ZIP archive.");
  const count = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true);
  let cursor = offset,
    total = 0;
  if (count > 10000 || offset === 0xffffffff)
    throw new Error("The workbook archive is too complex for browser import.");
  const sizes = new Map<string, number>(),
    decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (
      cursor + 46 > bytes.length ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error("The workbook ZIP directory is corrupted.");
    const size = view.getUint32(cursor + 24, true),
      len = view.getUint16(cursor + 28, true),
      extra = view.getUint16(cursor + 30, true),
      comment = view.getUint16(cursor + 32, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + len));
    sizes.set(name, size);
    total += size;
    cursor += 46 + len + extra + comment;
  }
  if (total > 300 * 1024 * 1024)
    throw new Error(
      "The expanded workbook exceeds the 300 MB browser safety limit.",
    );
  return sizes;
}

async function resolveSheetPaths(zip: JSZip) {
  const xml = await zip.file("xl/workbook.xml")?.async("string");
  const rel = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!xml || !rel) throw new Error("Missing Excel workbook metadata.");
  const doc = xmlParse(xml),
    rels = xmlParse(rel),
    paths: Record<string, string> = {},
    byId: Record<string, string> = {};
  for (const x of Array.from(rels.getElementsByTagName("*")).filter(
    (n) => n.localName === "Relationship",
  ))
    byId[x.getAttribute("Id") || ""] = normPath(x.getAttribute("Target") || "");
  for (const x of Array.from(doc.getElementsByTagName("*")).filter(
    (n) => n.localName === "sheet",
  )) {
    const rid = x.getAttributeNS(REL, "id") || x.getAttribute("r:id") || "";
    paths[x.getAttribute("name") || ""] = byId[rid];
  }
  return paths;
}
function parseRows(
  doc: Document,
  shared: string[],
  inputColumns?: Set<string>,
) {
  const data = new Map<number, Record<string, string | number | null>>();
  const sheetData = Array.from(doc.getElementsByTagName("*")).find(
    (x) => x.localName === "sheetData",
  );
  if (!sheetData) return data;
  for (const row of children(sheetData, "row")) {
    const index = Number(row.getAttribute("r"));
    const vals: Record<string, string | number | null> = {};
    for (const c of children(row, "c")) {
      const ref = c.getAttribute("r") || "",
        column = ref.match(/^[A-Z]+/)?.[0] || "";
      if (!column) continue;
      let value: string | number | null = null;
      const t = c.getAttribute("t") || "";
      if (t === "inlineStr") value = textContent(c);
      else {
        const v = first(c, "v")?.textContent;
        if (
          first(c, "f") &&
          inputColumns?.has(column) &&
          (v === undefined || v === null || v === "")
        )
          throw new Error(
            `Input formula ${ref} has no cached result. Open and save the workbook in Excel, then upload again.`,
          );
        if (t === "e" && inputColumns?.has(column))
          throw new Error(
            `Input ${ref} contains the Excel error ${v}. Correct it in Excel before importing.`,
          );
        if (v !== null && v !== undefined) {
          if (t === "s") {
            if (shared[Number(v)] === undefined)
              throw new Error(`Invalid shared-string reference at ${ref}.`);
            value = shared[Number(v)];
          } else if (t === "n" || t === "") value = Number(v);
          else value = v;
        }
      }
      if (value !== null && value !== "") vals[column] = value;
    }
    if (Object.keys(vals).length) data.set(index, vals);
  }
  return data;
}
function mappedRecords(
  rows: Map<number, Record<string, string | number | null>>,
  headers: readonly string[],
  name: SheetName,
) {
  const head = rows.get(1);
  if (!head) throw new Error(`Missing header row (expected: ${headers[0]}).`);
  const actual = new Map(
    Object.entries(head).map(([letter, text]) => [String(text).trim(), letter]),
  );
  const columnFor = (header: string) =>
    actual.get(header) ||
    (COLUMN_ALIASES[name]?.[header] || [])
      .map((alias) => actual.get(alias))
      .find((letter) => letter !== undefined);
  const missing = headers.filter((h) => !columnFor(h));
  if (missing.length)
    throw new Error(
      "Workbook sheet headers do not match the template. Missing: " +
        missing.join(", "),
    );
  if (headers.some((h, i) => columnFor(h) !== col(i)))
    throw new Error(
      "Keep worksheet columns in the original template order. Rows may be reordered freely.",
    );
  if (Object.keys(head).some((letter) => colNumber(letter) >= headers.length))
    throw new Error(
      "The source table contains extra columns. Keep the original template columns to avoid losing custom data.",
    );
  const output: Record<string, string | number | null>[] = [];
  for (const [rowIndex, raw] of rows) {
    if (rowIndex < 2) continue;
    const data: Record<string, string | number | null> = {};
    for (const h of headers) data[h] = raw[columnFor(h) || ""] ?? null;
    if (str(data[headers[0]]).trim()) output.push(data);
    else {
      const inputs = headers.filter((_, i) =>
        INPUT_COLUMNS[name].includes(col(i)),
      );
      if (inputs.some((h) => h !== headers[0] && data[h] !== null))
        throw new Error(
          `Row ${rowIndex} has data but no ${headers[0]}. Supply an ID or clear the unused row.`,
        );
    }
  }
  return output;
}
const INPUT_COLUMNS: Record<SheetName, string[]> = {
  Goals: ["A", "B", "C", "D", "E"],
  "Objective Entry": [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "K",
    "M",
    "N",
    "O",
    "P",
    "Q",
  ],
  "KPI Tracking": ["A", "B", "C", "D", "E", "F", "G", "J", "K"],
  "Objective Updates": ["A", "B", "C", "D", "E", "F", "G"],
};
export type LoadedWorkbook = {
  data: DataSet;
  buffer: ArrayBuffer;
  filename: string;
  warnings?: string[];
  reportingDate?: string;
  liveDate?: boolean;
};
export async function importWorkbook(
  buffer: ArrayBuffer,
  filename = "uploaded.xlsx",
): Promise<LoadedWorkbook> {
  if (buffer.byteLength > 30 * 1024 * 1024)
    throw new Error("File is larger than the 30 MB upload limit.");
  const sizes = inspectZipSize(buffer);
  const zip = await JSZip.loadAsync(buffer);
  const paths = await resolveSheetPaths(zip);
  for (const name of [
    "Dashboard",
    ...Object.keys(schema),
    "Analysis",
    "Lists",
    "Instructions",
  ])
    if (!paths[name])
      throw new Error(`Required worksheet "${name}" is missing.`);
  const tableDefinitions = new Map<string, Element>();
  for (const path of Object.keys(zip.files).filter((p) =>
    /^xl\/tables\/[^/]+\.xml$/.test(p),
  )) {
    if ((sizes.get(path) || 0) > 1024 * 1024)
      throw new Error(
        "Excel table metadata exceeds the 1 MB browser safety limit.",
      );
    const root = xmlParse(
      await zip.file(path)!.async("string"),
    ).documentElement;
    tableDefinitions.set(root.getAttribute("name") || "", root);
  }
  for (const name of Object.keys(schema) as SheetName[]) {
    const table = tableDefinitions.get(tableName[name]);
    if (!table)
      throw new Error(
        `Required Excel table ${tableName[name]} is missing. Use the supplied template.`,
      );
    const columns = Array.from(table.getElementsByTagName("*")).filter(
      (c) => c.localName === "tableColumn",
    );
    if (
      columns.length !== schema[name].length ||
      columns.some((c, i) =>
        !columnMatches(name, schema[name][i], c.getAttribute("name") || ""),
      )
    )
      throw new Error(
        `Excel table ${tableName[name]} has incompatible columns. Restore the original template columns.`,
      );
    for (const [index, column] of columns.entries())
      if (
        !INPUT_COLUMNS[name].includes(col(index)) &&
        !first(column, "calculatedColumnFormula")?.textContent
      )
        throw new Error(
          `Excel table ${tableName[name]} is missing the calculated formula for ${schema[name][index]}. Restore that formula in Excel.`,
        );
  }
  const metadata = xmlParse(await zip.file("xl/workbook.xml")!.async("string"));
  const date1904 = Array.from(metadata.getElementsByTagName("*")).some(
    (n) =>
      n.localName === "workbookPr" &&
      ["1", "true"].includes(n.getAttribute("date1904") || ""),
  );
  const date = (v: string | number | null) => serialToDate(v, date1904);
  if ((sizes.get("xl/sharedStrings.xml") || 0) > 15 * 1024 * 1024)
    throw new Error("Shared strings exceed the 15 MB browser safety limit.");
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  if (sharedXml && sharedXml.length > 15 * 1024 * 1024)
    throw new Error("Shared strings are too large to parse safely.");
  const shared: string[] = [];
  if (sharedXml) {
    const doc = xmlParse(sharedXml);
    for (const si of Array.from(doc.getElementsByTagName("*")).filter(
      (n) => n.localName === "si",
    ))
      shared.push(textContent(si));
  }
  const sheetRows: Record<
    string,
    Map<number, Record<string, string | number | null>>
  > = {};
  // Intentionally skip Dashboard + Analysis: Dashboard's XML alone expands to ~52 MB.
  for (const name of [...Object.keys(schema), "Lists"]) {
    if ((sizes.get(paths[name]) || 0) > 15 * 1024 * 1024)
      throw new Error(
        `Worksheet ${name} exceeds the 15 MB browser safety limit.`,
      );
    const xml = await zip.file(paths[name])?.async("string");
    if (!xml) throw new Error("Missing worksheet part for " + name);
    sheetRows[name] = parseRows(
      xmlParse(xml),
      shared,
      name in INPUT_COLUMNS
        ? new Set(INPUT_COLUMNS[name as SheetName])
        : undefined,
    );
  }
  const gs = mappedRecords(sheetRows["Goals"], schema["Goals"], "Goals");
  const os = mappedRecords(
    sheetRows["Objective Entry"],
    schema["Objective Entry"],
    "Objective Entry",
  );
  const ks = mappedRecords(
    sheetRows["KPI Tracking"],
    schema["KPI Tracking"],
    "KPI Tracking",
  );
  const us = mappedRecords(
    sheetRows["Objective Updates"],
    schema["Objective Updates"],
    "Objective Updates",
  );
  const goals: Goal[] = gs.map((r) => ({
    id: str(r["Goal ID"]),
    title: str(r["BBC Strategic Goal"]),
    owner: str(r["Accountable Person"]),
    description: str(r["Goal Description"]),
    active: str(r["Active"]) || "Active",
  }));
  const objectives: Objective[] = os.map((r) => ({
    id: str(r["Objective ID"]),
    goalId: str(r["Goal ID"]),
    description: str(r["Objective Description"]),
    ministry: str(r["Ministry"]),
    role: str(r["Assigned Role"]),
    owner: str(r["Accountable Person"]),
    rating: number(r["Status Rating"], `${r["Objective ID"]}: Status Rating`),
    startDate: date(r["Start Date"]),
    endDate: date(r["End Date"]),
    actual: number(
      r["Actual Completion %"],
      `${r["Objective ID"]}: Actual Completion %`,
    ),
    status: str(r["Objective Status"]),
    priority: str(r["Priority"]),
    comments: str(r["Comments"]),
    lastUpdateDate: date(r["Last Update Date"]),
    updatedBy: str(r["Last Updated By"]),
  }));
  const kpis: KPI[] = ks.map((r) => ({
    id: str(r["KPI ID"]),
    objectiveId: str(r["Objective ID"]),
    name: str(r["KPI Name"]),
    description: str(r["KPI Description"]),
    unit: str(r["Unit"]),
    target: optionalNumber(r["Target"], `${r["KPI ID"]}: Target`),
    actual: optionalNumber(r["Actual"], `${r["KPI ID"]}: Actual`),
    measurementDate: date(r["Measurement Date"]),
    comment: str(r["Comment"]),
  }));
  const updates: Update[] = us.map((r) => ({
    id: str(r["Update ID"]),
    objectiveId: str(r["Objective ID"]),
    date: date(r["Update Date"]),
    actual: number(
      r["Actual Completion %"],
      `${r["Update ID"]}: Actual Completion %`,
    ),
    rating: number(r["Status Rating"], `${r["Update ID"]}: Status Rating`),
    achievement: optionalNumber(
      r["KPI Achievement %"],
      `${r["Update ID"]}: KPI Achievement %`,
    ),
    comment: str(r["Update Comment"]),
  }));
  const c: Record<string, string> = {
    A: "ministries",
    C: "roles",
    E: "ratings",
    G: "statuses",
    I: "priorities",
    K: "active",
    M: "units",
    O: "years",
  };
  const lists: Lists = {
    ...DEFAULT_LISTS,
    ministries: [],
    roles: [],
    ratings: [],
    statuses: [],
    priorities: [],
    active: [],
    units: [],
    years: [],
  };
  for (const [idx, r] of sheetRows["Lists"]) {
    if (idx < 4) continue;
    for (const [letter, key] of Object.entries(c)) {
      const value = r[letter];
      if (value === null || value === undefined || value === "") continue;
      if (key === "years") (lists.years as number[]).push(number(value));
      else if (key === "ratings")
        (lists.ratings as number[]).push(number(value));
      else
        (
          lists[
            key as
              | "ministries"
              | "roles"
              | "statuses"
              | "priorities"
              | "active"
              | "units"
          ] as string[]
        ).push(str(value));
    }
  }
  // Excel key comparisons are case insensitive. Preserve parent IDs and resolve FKs to them.
  const goalIds = new Map(goals.map((g) => [g.id.toUpperCase(), g.id])),
    objectiveIds = new Map(objectives.map((o) => [o.id.toUpperCase(), o.id]));
  for (const o of objectives)
    o.goalId = goalIds.get(o.goalId.toUpperCase()) || o.goalId;
  for (const r of [...kpis, ...updates])
    r.objectiveId =
      objectiveIds.get(r.objectiveId.toUpperCase()) || r.objectiveId;
  const custom = await zip.file("docProps/custom.xml")?.async("string");
  let idHighWater: Record<string, number> | undefined;
  if (custom) {
    const doc = xmlParse(custom);
    const prop = Array.from(doc.getElementsByTagName("*")).find(
      (e) =>
        e.localName === "property" &&
        e.getAttribute("name") === "BBC.IdHighWater",
    );
    if (prop) {
      try {
        idHighWater = JSON.parse(prop.textContent || "{}");
        if (
          !idHighWater ||
          typeof idHighWater !== "object" ||
          Array.isArray(idHighWater) ||
          Object.values(idHighWater).some(
            (n) => !Number.isSafeInteger(n) || n < 1,
          )
        )
          throw new Error();
      } catch {
        throw new Error(
          "BBC identifier metadata is damaged. Restore an earlier workbook copy.",
        );
      }
    }
  }
  const data = seedIdCounters({
    goals,
    objectives,
    kpis,
    updates,
    lists,
    idHighWater,
  });
  const structural = validateRelationships(data);
  if (structural.length)
    throw new Error(
      "Import stopped to protect record relationships: " +
        structural.slice(0, 8).join("; ") +
        (structural.length > 8 ? ` (+${structural.length - 8} more)` : ""),
    );
  // Keep imported ministries/statuses, but the approved church role list
  // replaces legacy dropdown options. Existing objective.role values remain
  // untouched until someone explicitly reassigns those objectives.
  const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
  lists.ministries = unique([
    ...lists.ministries,
    ...objectives.map((o) => o.ministry),
  ]);
  lists.roles = [...CHURCH_ROLES];
  for (const key of ["statuses", "priorities", "active", "units"] as const)
    if (!lists[key].length) lists[key] = [...DEFAULT_LISTS[key]];
  lists.statuses = unique([
    ...lists.statuses,
    ...objectives.map((o) => o.status),
  ]);
  lists.priorities = unique([
    ...lists.priorities,
    ...objectives.map((o) => o.priority),
  ]);
  lists.active = unique([...lists.active, ...goals.map((g) => g.active)]);
  lists.units = unique([...lists.units, ...kpis.map((k) => k.unit)]);
  const reportingName = Array.from(metadata.getElementsByTagName("*"))
    .find(
      (n) =>
        n.localName === "definedName" &&
        n.getAttribute("name") === "BBC_ReportingDate",
    )
    ?.textContent?.replace(/^=/, "")
    .trim();
  let reportingDate: string | undefined;
  if (reportingName && /^\d+(\.\d+)?$/.test(reportingName))
    reportingDate = serialToDate(Number(reportingName), date1904);
  else if (
    reportingName &&
    /^DATE\(\d{4},\d{1,2},\d{1,2}\)$/i.test(reportingName)
  ) {
    const [y, m, d] = reportingName.match(/\d+/g)!;
    reportingDate = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (reportingDate && !Number.isFinite(toDay(reportingDate)))
    throw new Error(
      "The workbook reporting date is invalid. Correct BBC_ReportingDate in Excel.",
    );
  return {
    data,
    buffer,
    filename,
    warnings: validateDataset(data),
    reportingDate,
    liveDate: !reportingDate,
  };
}

function setCell(
  doc: Document,
  row: Element,
  colRef: string,
  value: string | number | null,
  formula?: string,
  style?: string,
) {
  const ref = colRef + row.getAttribute("r");
  let cell = children(row, "c").find((c) => c.getAttribute("r") === ref);
  if (!cell) {
    cell = doc.createElementNS(NS, "c");
    cell.setAttribute("r", ref);
    if (style) cell.setAttribute("s", style);
    const position = colNumber(colRef);
    const following = children(row, "c").find(
      (c) =>
        colNumber((c.getAttribute("r") || "").match(/^[A-Z]+/)?.[0] || "A") >
        position,
    );
    if (following) row.insertBefore(cell, following);
    else row.appendChild(cell);
  }
  if (style && !cell.hasAttribute("s")) cell.setAttribute("s", style);
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  cell.removeAttribute("t");
  if (formula) {
    const f = doc.createElementNS(NS, "f");
    f.textContent = formula.startsWith("=") ? formula.slice(1) : formula;
    cell.appendChild(f);
    if (typeof value === "string" || value === null)
      cell.setAttribute("t", "str");
    const v = doc.createElementNS(NS, "v");
    v.textContent = value === null ? "" : String(value);
    cell.appendChild(v);
    return;
  }
  if (value === null || value === "") return;
  if (typeof value === "number") {
    const v = doc.createElementNS(NS, "v");
    v.textContent = String(value);
    cell.appendChild(v);
    return;
  }
  cell.setAttribute("t", "inlineStr");
  const is = doc.createElementNS(NS, "is"),
    t = doc.createElementNS(NS, "t");
  if (value.startsWith(" ") || value.endsWith(" "))
    t.setAttribute("xml:space", "preserve");
  t.textContent = value;
  is.appendChild(t);
  cell.appendChild(is);
}
function prepareSheet(doc: Document, numRows: number, numColumns: number) {
  const sd = Array.from(doc.getElementsByTagName("*")).find(
    (x) => x.localName === "sheetData",
  );
  if (!sd) throw new Error("Corrupted Excel worksheet.");
  const rows = new Map<number, Element>();
  for (const r of children(sd, "row")) rows.set(Number(r.getAttribute("r")), r);
  const templates = new Map<string, string>();
  const row2 = rows.get(2);
  if (row2)
    for (const cell of children(row2, "c")) {
      const letter = (cell.getAttribute("r") || "").match(/^[A-Z]+/)?.[0];
      if (letter) templates.set(letter, cell.getAttribute("s") || "");
    }
  for (const [index, row] of rows) {
    if (index < 2) continue;
    for (const cell of children(row, "c")) {
      const letter =
        (cell.getAttribute("r") || "").match(/^[A-Z]+/)?.[0] || "A";
      if (colNumber(letter) >= numColumns) continue;
      while (cell.firstChild) cell.removeChild(cell.firstChild);
      cell.removeAttribute("t");
    }
  }
  const originalOrder = Array.from(rows).sort((a, b) => a[0] - b[0]);
  let nextOriginal = 0;
  for (let r = 2; r <= numRows + 1; r++)
    if (!rows.has(r)) {
      const el = doc.createElementNS(NS, "row");
      el.setAttribute("r", String(r));
      while (
        nextOriginal < originalOrder.length &&
        originalOrder[nextOriginal][0] <= r
      )
        nextOriginal++;
      const after = originalOrder[nextOriginal]?.[1];
      if (after) sd.insertBefore(el, after);
      else sd.appendChild(el);
      rows.set(r, el);
    }
  return { rows, templates };
}
function extendRanges(doc: Document, lastRow: number) {
  for (const container of Array.from(doc.getElementsByTagName("*")).filter(
    (x) => ["dataValidation", "conditionalFormatting"].includes(x.localName),
  )) {
    const ref = container.getAttribute("sqref");
    if (!ref) continue;
    const newRef = ref
      .split(" ")
      .map((s) =>
        s.replace(
          /^(\$?[A-Z]+\$?2:\$?[A-Z]+\$?)(\d+)$/,
          (_, prefix, end) => prefix + Math.max(Number(end), lastRow),
        ),
      )
      .join(" ");
    container.setAttribute("sqref", newRef);
  }
  const validations = Array.from(doc.getElementsByTagName("*")).filter(
    (x) => x.localName === "dataValidation",
  );
  for (const el of validations) {
    const m = /^([A-Z]+)(\d+):\1(\d+)$/.exec(el.getAttribute("sqref") || "");
    if (!m || Number(m[2]) <= 2) continue;
    const matching = validations.find((v) => {
      const primary = /^([A-Z]+)2:\1(\d+)$/.exec(v.getAttribute("sqref") || "");
      return (
        v !== el &&
        primary?.[1] === m[1] &&
        Number(primary[2]) >= Number(m[2]) &&
        v.getAttribute("type") === el.getAttribute("type") &&
        first(v, "formula1")?.textContent === first(el, "formula1")?.textContent
      );
    });
    if (matching) {
      const end = Number(
        (matching.getAttribute("sqref") || "").match(/\d+$/)?.[0],
      );
      if (end >= Number(m[3])) el.remove();
      else el.setAttribute("sqref", `${m[1]}${end + 1}:${m[1]}${m[3]}`);
    }
  }
  for (const container of Array.from(doc.getElementsByTagName("*")).filter(
    (x) => x.localName === "dataValidations",
  ))
    container.setAttribute(
      "count",
      String(children(container, "dataValidation").length),
    );
  const dim = Array.from(doc.getElementsByTagName("*")).find(
    (x) => x.localName === "dimension",
  );
  if (dim) {
    const ref = dim.getAttribute("ref") || "";
    const oldEnd = Number(ref.match(/\d+$/)?.[0] || 0);
    if (lastRow > oldEnd)
      dim.setAttribute("ref", ref.replace(/\d+$/, String(lastRow)));
  }
}
function rowsForExport(
  data: DataSet,
  reportingDate: string,
  date1904: boolean,
) {
  const views = objectiveViews(data, reportingDate);
  const omap = new Map(views.map((o) => [o.id, o]));
  const serial = (s: string) => dateToSerial(s, date1904) ?? (s || null);
  const goals = data.goals.map((g) => [
    g.id,
    g.title,
    g.owner,
    g.description,
    g.active,
  ]);
  const objectives = views.map((o, i) => {
    const score = o.exceptionScore,
      filtered = score > 0 ? score + (i + 2) / 100000 : null;
    return [
      o.id,
      o.goalId,
      o.description,
      o.ministry,
      o.role,
      o.owner,
      o.rating,
      serial(o.startDate),
      serial(o.endDate),
      o.planned,
      o.actual,
      o.variance,
      o.status,
      o.priority,
      o.comments,
      serial(o.lastUpdateDate),
      o.updatedBy,
      o.daysRemaining,
      o.overdue ? "Yes" : "No",
      o.achievement,
      o.dataQuality.length ? o.dataQuality.join("; ") + "; " : "OK",
      o.attention || null,
      score,
      1,
      filtered,
      o.primaryKpiId,
      Number.isFinite(toDay(o.lastUpdateDate))
        ? Number(o.lastUpdateDate.slice(0, 4))
        : null,
      o.goalName,
      RATING_LABELS[o.rating] || "",
    ];
  });
  const kpis = data.kpis.map((k) => {
    const o = omap.get(k.objectiveId),
      a = kpiAchievement(k);
    return [
      k.id,
      k.objectiveId,
      k.name,
      k.description,
      k.unit,
      k.target,
      k.actual,
      a,
      a === null ? null : a >= 1 ? "Met / Exceeded" : "Below Target",
      serial(k.measurementDate),
      k.comment,
      o?.goalId || "",
      o?.ministry || "",
      o?.role || "",
      o?.priority || "",
      o?.status || "",
      o?.rating || null,
      o ? 1 : 0,
    ];
  });
  const updates = data.updates.map((u) => {
    const o = omap.get(u.objectiveId);
    return [
      u.id,
      u.objectiveId,
      serial(u.date),
      u.actual,
      u.rating,
      u.achievement,
      u.comment,
      o?.goalId || "",
      o?.ministry || "",
      o?.role || "",
      o?.priority || "",
      o?.status || "",
      o ? 1 : 0,
    ];
  });
  return {
    rows: {
      Goals: goals,
      "Objective Entry": objectives,
      "KPI Tracking": kpis,
      "Objective Updates": updates,
    } as Record<SheetName, unknown[][]>,
  };
}
function correctedFormula(table: string, header: string, original: string) {
  const ref = (h: string) => `tblObjectives[[#This Row],[${h}]]`;
  // Unlike the lookup list, the original Status Description is a CHOOSE
  // formula containing literal wording. Refresh that *label-only* formula
  // when exporting, without changing the 1–5 scoring or other calculations.
  if (table === "tblObjectives" && header === "Status Description")
    original = `IF(${ref("Status Rating")}="","",CHOOSE(${ref("Status Rating")},${[1, 2, 3, 4, 5].map((n) => JSON.stringify(RATING_LABELS[n])).join(",")}))`;
  if (table === "tblKPI" && header === "KPI Achievement %")
    original =
      'IF(tblKPI[[#This Row],[KPI ID]]="","",IF(OR(tblKPI[[#This Row],[Target]]="",tblKPI[[#This Row],[Actual]]="",tblKPI[[#This Row],[Target]]=0),"",IFERROR(tblKPI[[#This Row],[Actual]]/tblKPI[[#This Row],[Target]],"")))';
  if (
    table === "tblObjectives" &&
    header === "Planned Completion %" &&
    !original.startsWith("IF(OR(NOT(ISNUMBER(")
  )
    original = `IF(OR(NOT(ISNUMBER(${ref("Start Date")})),NOT(ISNUMBER(${ref("End Date")})),${ref("End Date")}<${ref("Start Date")}),"",${original})`;
  if (table === "tblObjectives" && header === "Data Quality Check") {
    const checks: [string, string][] = [
      [
        `COUNTIF(tblObjectives[Objective ID],${ref("Objective ID")})>1`,
        "Duplicate objective ID",
      ],
      [`${ref("Goal ID")}=""`, "Missing Goal ID"],
      [
        `AND(${ref("Goal ID")}<>"",COUNTIF(tblGoals[Goal ID],${ref("Goal ID")})=0)`,
        "Invalid Goal ID",
      ],
      ...[
        "Objective Description",
        "Ministry",
        "Assigned Role",
        "Accountable Person",
        "Objective Status",
        "Priority",
      ].map((h) => [`${ref(h)}=""`, `Missing ${h}`] as [string, string]),
      [
        `OR(NOT(ISNUMBER(${ref("Status Rating")})),${ref("Status Rating")}<1,${ref("Status Rating")}>5,IFERROR(MOD(${ref("Status Rating")},1)<>0,TRUE))`,
        "Invalid status rating",
      ],
      ...["Start Date", "End Date", "Last Update Date"].map(
        (h) =>
          [`NOT(ISNUMBER(${ref(h)}))`, `Missing / invalid ${h}`] as [
            string,
            string,
          ],
      ),
      [
        `AND(ISNUMBER(${ref("Start Date")}),ISNUMBER(${ref("End Date")}),${ref("End Date")}<${ref("Start Date")})`,
        "End before start",
      ],
      [
        `OR(NOT(ISNUMBER(${ref("Actual Completion %")})),${ref("Actual Completion %")}<0,${ref("Actual Completion %")}>1)`,
        "Invalid actual completion",
      ],
    ];
    original = `IF(${ref("Objective ID")}="","",IF(AND(${checks.map(([condition]) => `NOT(${condition})`).join(",")}),"OK",${checks.map(([condition, label]) => `IF(${condition},"${label}; ","")`).join("&")}))`;
  }
  return original.replace(/\bTODAY\(\)/g, "BBC_ReportingDate");
}

async function writeExportMetadata(
  zip: JSZip,
  data: DataSet,
  reportingDate: string,
) {
  const customNS =
      "http://schemas.openxmlformats.org/officeDocument/2006/custom-properties",
    vt = "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes";
  const original = await zip.file("docProps/custom.xml")?.async("string");
  const doc = xmlParse(
    original || `<Properties xmlns="${customNS}" xmlns:vt="${vt}"/>`,
  );
  let pid = Math.max(
    1,
    ...Array.from(doc.documentElement.children).map(
      (x) => Number(x.getAttribute("pid")) || 1,
    ),
  );
  for (const [name, value] of Object.entries({
    "BBC.IdHighWater": JSON.stringify(seedIdCounters(data).idHighWater),
    "BBC.ReportingDate": reportingDate,
    "BBC.ReportingTimezone": REPORTING_TIMEZONE,
  })) {
    let prop = Array.from(doc.documentElement.children).find(
      (x) => x.getAttribute("name") === name,
    );
    if (!prop) {
      prop = doc.createElementNS(customNS, "property");
      prop.setAttribute("fmtid", "{D5CDD505-2E9C-101B-9397-08002B2CF9AE}");
      prop.setAttribute("pid", String(++pid));
      prop.setAttribute("name", name);
      doc.documentElement.appendChild(prop);
    }
    prop.replaceChildren();
    const v = doc.createElementNS(vt, "vt:lpwstr");
    v.textContent = value;
    prop.appendChild(v);
  }
  zip.file("docProps/custom.xml", serializer.serializeToString(doc));
  const ct = xmlParse(await zip.file("[Content_Types].xml")!.async("string"));
  if (
    !Array.from(ct.documentElement.children).some(
      (x) => x.getAttribute("PartName") === "/docProps/custom.xml",
    )
  ) {
    const item = ct.createElementNS(
      ct.documentElement.namespaceURI,
      "Override",
    );
    item.setAttribute("PartName", "/docProps/custom.xml");
    item.setAttribute(
      "ContentType",
      "application/vnd.openxmlformats-officedocument.custom-properties+xml",
    );
    ct.documentElement.appendChild(item);
  }
  for (const el of Array.from(ct.documentElement.children))
    if (el.getAttribute("PartName") === "/xl/calcChain.xml") el.remove();
  zip.file("[Content_Types].xml", serializer.serializeToString(ct));
  const rootRels = xmlParse(await zip.file("_rels/.rels")!.async("string"));
  if (
    !Array.from(rootRels.documentElement.children).some((x) =>
      (x.getAttribute("Type") || "").endsWith("/custom-properties"),
    )
  ) {
    const rel = rootRels.createElementNS(
      rootRels.documentElement.namespaceURI,
      "Relationship",
    );
    let index = 1;
    while (
      Array.from(rootRels.documentElement.children).some(
        (x) => x.getAttribute("Id") === `rIdBBC${index}`,
      )
    )
      index++;
    rel.setAttribute("Id", `rIdBBC${index}`);
    rel.setAttribute(
      "Type",
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties",
    );
    rel.setAttribute("Target", "docProps/custom.xml");
    rootRels.documentElement.appendChild(rel);
  }
  zip.file("_rels/.rels", serializer.serializeToString(rootRels));
  zip.remove("xl/calcChain.xml");
  const workbookRels = xmlParse(
    await zip.file("xl/_rels/workbook.xml.rels")!.async("string"),
  );
  for (const rel of Array.from(workbookRels.documentElement.children))
    if ((rel.getAttribute("Type") || "").endsWith("/calcChain")) rel.remove();
  zip.file(
    "xl/_rels/workbook.xml.rels",
    serializer.serializeToString(workbookRels),
  );
  const core = await zip.file("docProps/core.xml")?.async("string");
  if (core) {
    const doc = xmlParse(core),
      dc = "http://purl.org/dc/elements/1.1/";
    let title = doc.getElementsByTagNameNS(dc, "title")[0];
    if (!title) {
      title = doc.createElementNS(dc, "dc:title");
      doc.documentElement.appendChild(title);
    }
    title.textContent = "BBC Perfomance Dashboard";
    zip.file("docProps/core.xml", serializer.serializeToString(doc));
  }
}

async function writeControlledLists(zip: JSZip, path: string, data: DataSet) {
  const doc = xmlParse(await zip.file(path)!.async("string")),
    sd = Array.from(doc.getElementsByTagName("*")).find(
      (x) => x.localName === "sheetData",
    )!;
  const rowMap = new Map(
    children(sd, "row").map((r) => [Number(r.getAttribute("r")), r]),
  );
  const columns: [string, keyof Lists, string][] = [
    ["A", "ministries", "Ministries"],
    ["C", "roles", "Roles"],
    ["E", "ratings", "StatusRatings"],
    ["G", "statuses", "ObjectiveStatuses"],
    ["I", "priorities", "Priorities"],
    ["K", "active", "ActiveInactive"],
    ["M", "units", "KPIUnits"],
    ["O", "years", ""],
  ];
  const lengths: Record<string, number> = {};
  for (const [letter, key, name] of columns) {
    // Workspaces saved before the role update can still contain legacy lists.
    // Always write the approved role choices into the exported Excel lookup.
    const values = key === "roles" ? CHURCH_ROLES : data.lists[key];
    lengths[name] = Math.max(4, values.length + 3);
    const style =
      children(rowMap.get(4) || sd, "c")
        .find((c) => c.getAttribute("r") === letter + "4")
        ?.getAttribute("s") || undefined;
    for (const [i, row] of rowMap)
      if (i >= 4)
        children(row, "c")
          .find((c) => c.getAttribute("r") === letter + i)
          ?.remove();
    for (const [i, value] of values.entries()) {
      const index = i + 4;
      let row = rowMap.get(index);
      if (!row) {
        row = doc.createElementNS(NS, "row");
        row.setAttribute("r", String(index));
        const after = children(sd, "row").find(
          (r) => Number(r.getAttribute("r")) > index,
        );
        sd.insertBefore(row, after || null);
        rowMap.set(index, row);
      }
      setCell(doc, row, letter, value, undefined, style);
    }
  }
  // F is the workbook's rating lookup column, not part of a structured table.
  // Keep Excel's existing Status Description LOOKUP formulas linked to the
  // current church-approved descriptions on every downloaded workbook.
  const header = rowMap.get(3);
  if (header) setCell(doc, header, "F", "Objective Status Description");
  for (let rating = 1; rating <= 5; rating++) {
    let row = rowMap.get(rating + 3);
    if (!row) {
      row = doc.createElementNS(NS, "row");
      row.setAttribute("r", String(rating + 3));
      sd.appendChild(row);
      rowMap.set(rating + 3, row);
    }
    setCell(doc, row, "F", RATING_LABELS[rating]);
  }
  extendRanges(doc, Math.max(...Object.values(lengths)));
  zip.file(path, serializer.serializeToString(doc));
  return lengths;
}

/** Add a Comments lookup to older Excel dashboard templates without moving any
 * of the original 1,048,576 dashboard rows or existing formulas/charts.
 * The workbook's original sheet1.xml is ~52 MB, so do NOT DOM-parse it.
 */
async function ensureDashboardComments(zip: JSZip, path: string) {
  const source = await zip.file(path)?.async("string");
  if (!source) throw new Error("Missing Excel Dashboard sheet.");
  const rowsNeeded = new Set(Array.from({ length: 11 }, (_, i) => String(i + 88)));
  const headerStyle = /<c\s+r="O88"\s+s="(\d+)"/.exec(source)?.[1];
  const bodyStyle = /<c\s+r="O89"\s+s="(\d+)"/.exec(source)?.[1];
  const changed = source.replace(
    /<row\b[^>]*\br="(8[89]|9[0-8])"[^>]*>[\s\S]*?<\/row>/g,
    (row, rowNumber: string) => {
      rowsNeeded.delete(rowNumber);
      if (new RegExp(`<c\\s[^>]*\\br="S${rowNumber}"`).test(row)) return row;
      const cell = rowNumber === "88"
        ? `<c r="S88"${headerStyle ? ` s="${headerStyle}"` : ""} t="inlineStr"><is><t>Comments</t></is></c>`
        : `<c r="S${rowNumber}"${bodyStyle ? ` s="${bodyStyle}"` : ""} t="str"><f>IF($B${rowNumber}="","",IFERROR(INDEX(tblObjectives[Comments],MATCH($B${rowNumber},tblObjectives[Objective ID],0)),""))</f><v/></c>`;
      return row.replace("</row>", cell + "</row>");
    },
  );
  // Minimal synthetic test workbooks have no Excel dashboard table.
  if (rowsNeeded.size === 11) return;
  if (rowsNeeded.size)
    throw new Error("Excel Dashboard exception rows 88–98 are incomplete. Check the uploaded template.");
  // The original dashboard hides column S and everything to its right.
  // Expose only S for readable comments, keeping T onward hidden.
  const visible = changed.replace(
    /<col min="19" max="16383" width="0" hidden="1" customWidth="1"\s*\/>/,
    '<col min="19" max="19" width="50" customWidth="1"/>' +
      '<col min="20" max="16383" width="0" hidden="1" customWidth="1"/>',
  );
  // A new column extends the dashboard to S; all original formula cells remain.
  zip.file(path, visible.replace(/(<dimension\s+ref="[A-Z]+\d+:)R(\d+")/, "$1S$2"));
}

export async function exportWorkbook(
  buffer: ArrayBuffer,
  data: DataSet,
  reportingDate = todayISO(),
): Promise<Blob> {
  if (!Number.isFinite(toDay(reportingDate)))
    throw new Error("Choose a valid reporting date before exporting.");
  const structural = validateRelationships(data);
  if (structural.length)
    throw new Error(
      "Resolve record relationships before export: " + structural.join("; "),
    );
  const zip = await JSZip.loadAsync(buffer),
    paths = await resolveSheetPaths(zip);
  const tableFormulas: Record<string, Record<string, string>> = {};
  const tableFiles: Record<string, string> = {};
  for (const path of Object.keys(zip.files).filter((p) =>
    /^xl\/tables\/[^/]+\.xml$/.test(p),
  )) {
    const xml = await zip.file(path)!.async("string");
    const doc = xmlParse(xml),
      root = doc.documentElement;
    const name = root.getAttribute("name") || "";
    const formulas: Record<string, string> = {};
    for (const c of Array.from(root.getElementsByTagName("*")).filter(
      (n) => n.localName === "tableColumn",
    )) {
      const f = children(c, "calculatedColumnFormula")[0];
      if (f?.textContent) {
        const header = c.getAttribute("name") || "";
        f.textContent = correctedFormula(name, header, f.textContent);
        formulas[header] = f.textContent;
      }
    }
    // Map the v2 alias back to our internal column key. The actual table
    // column name and its calculated formula remain unchanged in the XLSX.
    const sheet = (Object.keys(tableName) as SheetName[]).find(
      (key) => tableName[key] === name,
    );
    if (sheet) {
      for (const [header, formula] of Object.entries(formulas)) {
        const canonical = canonicalColumn(sheet, header);
        if (canonical && canonical !== header) formulas[canonical] = formula;
      }
    }
    tableFormulas[name] = formulas;
    tableFiles[name] = path;
    zip.file(path, serializer.serializeToString(doc));
  }
  const workbookDoc = xmlParse(
    await zip.file("xl/workbook.xml")!.async("string"),
  );
  const date1904 = Array.from(workbookDoc.getElementsByTagName("*")).some(
    (n) =>
      n.localName === "workbookPr" &&
      ["1", "true"].includes(n.getAttribute("date1904") || ""),
  );
  const { rows } = rowsForExport(data, reportingDate, date1904);
  for (const name of Object.keys(schema) as SheetName[]) {
    const xml = await zip.file(paths[name])?.async("string");
    if (!xml) throw new Error("Missing worksheet " + name);
    const tableFile = tableFiles[tableName[name]];
    if (!tableFile)
      throw new Error(`Missing required Excel table ${tableName[name]}.`);
    const tableDoc = xmlParse(await zip.file(tableFile)!.async("string"));
    const oldEnd = Number(
      (tableDoc.documentElement.getAttribute("ref") || "").match(/\d+$/)?.[0] ||
        2,
    );
    const end = Math.max(oldEnd, rows[name].length + 1, 2);
    const doc = xmlParse(xml),
      values = rows[name],
      headers = schema[name],
      { rows: rowMap, templates } = prepareSheet(doc, end - 1, headers.length),
      formulaByHeader = tableFormulas[tableName[name]] || {};
    for (let i = 0; i < end - 1; i++) {
      const row = rowMap.get(i + 2)!;
      row.removeAttribute("hidden");
      for (let j = 0; j < headers.length; j++) {
        const raw = values[i]?.[j];
        const value =
          raw === undefined || raw === null
            ? null
            : typeof raw === "number"
              ? raw
              : String(raw);
        setCell(
          doc,
          row,
          col(j),
          value,
          formulaByHeader[headers[j]],
          templates.get(col(j)),
        );
      }
    }
    extendRanges(doc, end);
    zip.file(paths[name], serializer.serializeToString(doc));
    if (tableFile) {
      const root = tableDoc.documentElement;
      const ref = `A1:${col(headers.length - 1)}${end}`;
      root.setAttribute("ref", ref);
      const auto = first(root, "autoFilter");
      if (auto) {
        auto.setAttribute("ref", ref);
        auto.replaceChildren();
      }
      zip.file(tableFile, serializer.serializeToString(tableDoc));
    }
  }
  const listLengths = await writeControlledLists(zip, paths.Lists, data);
  // The React dashboard already shows comments. Add matching Excel formulas to
  // older templates too, so users get them after the next export/reopen.
  await ensureDashboardComments(zip, paths.Dashboard);
  const meta = await zip.file("xl/workbook.xml")?.async("string");
  if (meta) {
    const doc = xmlParse(meta);
    let names = Array.from(doc.documentElement.children).find(
      (x) => x.localName === "definedNames",
    );
    if (!names) {
      names = doc.createElementNS(NS, "definedNames");
      const following = Array.from(doc.documentElement.children).find((x) =>
        ["calcPr", "extLst"].includes(x.localName),
      );
      doc.documentElement.insertBefore(names, following || null);
    }
    let name = Array.from(names.children).find(
      (x) => x.getAttribute("name") === "BBC_ReportingDate",
    );
    if (!name) {
      name = doc.createElementNS(NS, "definedName");
      name.setAttribute("name", "BBC_ReportingDate");
      names.appendChild(name);
    }
    name.textContent = String(dateToSerial(reportingDate, date1904));
    name.setAttribute(
      "comment",
      "Reporting snapshot date. Set this name to TODAY() in Excel for a live calendar.",
    );
    for (const item of Array.from(names.children)) {
      const end = listLengths[item.getAttribute("name") || ""];
      if (end && item.textContent)
        item.textContent = item.textContent.replace(
          /(\$[A-Z]+\$)(\d+)$/,
          (_, prefix, row) => prefix + Math.max(end, Number(row)),
        );
    }
    let calc = Array.from(doc.getElementsByTagName("*")).find(
      (x) => x.localName === "calcPr",
    );
    if (!calc) {
      calc = doc.createElementNS(NS, "calcPr");
      doc.documentElement.appendChild(calc);
    }
    calc.setAttribute("calcMode", "auto");
    calc.setAttribute("fullCalcOnLoad", "1");
    calc.setAttribute("forceFullCalc", "1");
    zip.file("xl/workbook.xml", serializer.serializeToString(doc));
  }
  // Small Analysis part only; keep its original layout and native chart ranges.
  if (paths.Analysis) {
    const doc = xmlParse(await zip.file(paths.Analysis)!.async("string"));
    for (const f of Array.from(doc.getElementsByTagNameNS(NS, "f")))
      if (f.textContent)
        f.textContent = f.textContent.replace(
          /\bTODAY\(\)/g,
          "BBC_ReportingDate",
        );
    zip.file(paths.Analysis, serializer.serializeToString(doc));
  }
  await writeExportMetadata(zip, data, reportingDate);
  // Preserve native dashboard/drawing/chart/slicer parts byte for byte. Native
  // summary/chart caches need Excel recalculation; their template ranges remain.
  const output = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
export async function readWorkbookFile(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(
        new Error(
          "Could not read this file. Choose your Excel workbook again.",
        ),
      );
    reader.onabort = () =>
      reject(new Error("Excel file reading was cancelled."));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const DB_NAME = "clarity-goal-performance";
const STORE = "workspace";
const dbOpen = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function saveWorkspace(item: LoadedWorkbook) {
  const db = await dbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item, "latest");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
export async function loadWorkspace(): Promise<LoadedWorkbook | null> {
  const db = await dbOpen();
  const item = await new Promise<LoadedWorkbook | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get("latest");
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return item;
}
export async function clearWorkspace() {
  const db = await dbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete("latest");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
