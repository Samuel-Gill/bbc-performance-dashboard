// Synthetic OOXML fixture for application tests. No church names or personal data.
import JSZip from "jszip";
import type { DataSet } from "./domain";
import fixture from "./fixtures/workbook-calculations.json";
import tableFormulas from "./fixtures/table-formulas.json";
import { schema, dateToSerial } from "./workbook";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const names = [
  "Dashboard",
  "Goals",
  "Objective Entry",
  "KPI Tracking",
  "Objective Updates",
  "Analysis",
  "Lists",
  "Instructions",
];
const physical = [8, 4, 7, 2, 6, 1, 5, 3];
export const testPaths = Object.fromEntries(
  names.map((name, i) => [name, `xl/worksheets/sheet${physical[i]}.xml`]),
);
const tables = {
  Goals: "tblGoals",
  "Objective Entry": "tblObjectives",
  "KPI Tracking": "tblKPI",
  "Objective Updates": "tblObjectiveUpdates",
} as const;
const esc = (value: unknown) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const column = (n: number) => {
  let s = "";
  for (let i = n + 1; i; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};
const cell = (ref: string, value: unknown, formula?: string) =>
  formula
    ? `<c r="${ref}" t="str"><f>${esc(formula)}</f><v/></c>`
    : value === null || value === undefined || value === ""
      ? `<c r="${ref}"/>`
      : typeof value === "number"
        ? `<c r="${ref}"><v>${value}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
export const fixtureData = () => structuredClone(fixture.data) as DataSet;
export async function buildTestWorkbook(data: DataSet = fixtureData()) {
  const rows: Record<keyof typeof schema, unknown[][]> = {
    Goals: data.goals.map((g) => [
      g.id,
      g.title,
      g.owner,
      g.description,
      g.active,
    ]),
    "Objective Entry": data.objectives.map((o) => [
      o.id,
      o.goalId,
      o.description,
      o.ministry,
      o.role,
      o.owner,
      o.rating,
      dateToSerial(o.startDate),
      dateToSerial(o.endDate),
      null,
      o.actual,
      null,
      o.status,
      o.priority,
      o.comments,
      dateToSerial(o.lastUpdateDate),
      o.updatedBy,
    ]),
    "KPI Tracking": data.kpis.map((k) => [
      k.id,
      k.objectiveId,
      k.name,
      k.description,
      k.unit,
      k.target,
      k.actual,
      null,
      null,
      dateToSerial(k.measurementDate),
      k.comment,
    ]),
    "Objective Updates": data.updates.map((u) => [
      u.id,
      u.objectiveId,
      dateToSerial(u.date),
      u.actual,
      u.rating,
      u.achievement,
      u.comment,
    ]),
  };
  const zip = new JSZip();
  let content = "";
  let workbookRels = "";
  let workbookSheets = "";
  for (const [i, name] of names.entries()) {
    const id = i + 1,
      path = testPaths[name];
    workbookSheets += `<sheet name="${name}" sheetId="${id}" r:id="rId${id}"/>`;
    workbookRels += `<Relationship Id="rId${id}" Type="${REL}/worksheet" Target="${path.slice(3)}"/>`;
    content += `<Override PartName="/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    if (name in schema) {
      const key = name as keyof typeof schema,
        headers = schema[key],
        table = tables[key],
        formulas = tableFormulas[table] as Record<string, string>,
        end = Math.max(2, rows[key].length + 1),
        tableId = Object.keys(schema).indexOf(key) + 1;
      const ref = `A1:${column(headers.length - 1)}${end}`;
      const body = [headers, ...rows[key]]
        .map(
          (values, index) =>
            `<row r="${index + 1}">${headers.map((h, j) => cell(column(j) + (index + 1), values[j], index ? formulas[h] : undefined)).join("")}</row>`,
        )
        .join("");
      zip.file(
        path,
        `<worksheet xmlns="${NS}" xmlns:r="${REL}"><dimension ref="${ref}"/><sheetData>${body}</sheetData><dataValidations count="1"><dataValidation type="list" sqref="B2:B${end}"><formula1>GoalIDs</formula1></dataValidation></dataValidations><tableParts count="1"><tablePart r:id="table1"/></tableParts></worksheet>`,
      );
      zip.file(
        path.replace("worksheets/", "worksheets/_rels/") + ".rels",
        `<Relationships xmlns="${PKG}"><Relationship Id="table1" Type="${REL}/table" Target="../tables/table${tableId}.xml"/></Relationships>`,
      );
      zip.file(
        `xl/tables/table${tableId}.xml`,
        `<table xmlns="${NS}" id="${tableId}" name="${table}" displayName="${table}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${headers.map((h, j) => `<tableColumn id="${j + 1}" name="${esc(h)}">${formulas[h] ? `<calculatedColumnFormula>${esc(formulas[h])}</calculatedColumnFormula>` : ""}</tableColumn>`).join("")}</tableColumns><tableStyleInfo name="TableStyleMedium2" showRowStripes="1"/></table>`,
      );
      content += `<Override PartName="/xl/tables/table${tableId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`;
    } else if (name === "Lists") {
      const values: [string, unknown[]][] = [
        ["A", data.lists.ministries],
        ["C", data.lists.roles],
        ["E", data.lists.ratings],
        ["G", data.lists.statuses],
        ["I", data.lists.priorities],
        ["K", data.lists.active],
        ["M", data.lists.units],
        ["O", data.lists.years],
      ];
      const end = Math.max(1, ...values.map((v) => v[1].length));
      let body = "";
      for (let r = 0; r < end; r++)
        body += `<row r="${r + 4}">${values.map(([c, vs]) => cell(c + (r + 4), vs[r])).join("")}</row>`;
      zip.file(
        path,
        `<worksheet xmlns="${NS}"><sheetData>${body}</sheetData></worksheet>`,
      );
    } else
      zip.file(
        path,
        `<worksheet xmlns="${NS}"><sheetData><row r="1">${cell("A1", name)}</row></sheetData></worksheet>`,
      );
  }
  zip.file(
    "xl/workbook.xml",
    `<workbook xmlns="${NS}" xmlns:r="${REL}"><workbookPr/><sheets>${workbookSheets}</sheets><definedNames><definedName name="GoalIDs">tblGoals[Goal ID]</definedName></definedNames><calcPr calcMode="auto"/></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships xmlns="${PKG}">${workbookRels}</Relationships>`,
  );
  zip.file(
    "_rels/.rels",
    `<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "[Content_Types].xml",
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${content}</Types>`,
  );
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
