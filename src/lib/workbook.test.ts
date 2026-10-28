import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import {
  importWorkbook,
  exportWorkbook,
  dateToSerial,
  serialToDate,
  readWorkbookFile,
} from "./workbook";
import {
  buildDashboard,
  objectiveViews,
  seedIdCounters,
  validateRelationships,
} from "./domain";
import { saveRecordData, deleteRecordData } from "./records";
import { buildTestWorkbook, fixtureData, testPaths } from "./test-workbook";

const asOf = "2026-10-27";
let synthetic: ArrayBuffer;
beforeAll(async () => {
  synthetic = await buildTestWorkbook();
  mkdirSync(".cache", { recursive: true });
  writeFileSync(".cache/synthetic.xlsx", Buffer.from(synthetic));
});
async function rewrite(
  buffer: ArrayBuffer,
  path: string,
  fn: (xml: string) => string,
) {
  const zip = await JSZip.loadAsync(buffer);
  zip.file(path, fn(await zip.file(path)!.async("string")));
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
const gform = {
  title: "Community care",
  owner: "Church leader",
  description: "Long-term community support < & >",
  active: "Active",
};
const oform = {
  goalId: "G006",
  description: "New outreach objective",
  ministry: "New ministry",
  role: "Ministry lead",
  owner: "Church leader",
  rating: "4",
  startDate: "2026-01-01",
  endDate: "2027-01-01",
  actual: "25",
  status: "In Progress",
  priority: "High",
  lastUpdateDate: asOf,
  updatedBy: "Analyst",
  comments: "Progress & service",
};
const kform = {
  objectiveId: "OBJ021",
  name: "Participants",
  description: "",
  unit: "Count",
  target: "20",
  actual: "10",
  measurementDate: asOf,
  comment: "New KPI",
};
const uform = {
  objectiveId: "OBJ021",
  date: asOf,
  actual: "30",
  rating: "4",
  achievement: "125",
  comment: "Snapshot only",
  applyToCurrent: "false",
};

describe("Excel import validation", () => {
  it("reads Excel files through FileReader when File.arrayBuffer is unavailable", async () => {
    const file = new File([new Uint8Array(synthetic)], "legacy-browser.xlsx");
    Object.defineProperty(file, "arrayBuffer", { value: undefined });
    const bytes = await readWorkbookFile(file);
    expect((await importWorkbook(bytes)).data.objectives).toHaveLength(20);
  });
  it("rejects missing native tables and lost calculated-column definitions before opening a workspace", async () => {
    const zip = await JSZip.loadAsync(synthetic);
    zip.remove("xl/tables/table2.xml");
    await expect(
      importWorkbook(await zip.generateAsync({ type: "arraybuffer" })),
    ).rejects.toThrow("Required Excel table tblObjectives");
    const missing = await rewrite(synthetic, "xl/tables/table2.xml", (xml) =>
      xml.replace(
        /<calculatedColumnFormula>.*?<\/calculatedColumnFormula>/,
        "",
      ),
    );
    await expect(importWorkbook(missing)).rejects.toThrow(
      "missing the calculated formula",
    );
  });
  it("imports all records by relationships rather than physical sheet order", async () => {
    const { data } = await importWorkbook(synthetic);
    expect([
      data.goals.length,
      data.objectives.length,
      data.kpis.length,
      data.updates.length,
    ]).toEqual([5, 20, 38, 80]);
    expect(validateRelationships(data)).toEqual([]);
    expect(data.objectives[0].startDate).toBe(
      fixtureData().objectives[0].startDate,
    );
  });
  it("accepts empty business sheets and keeps zero counts", async () => {
    const d = fixtureData();
    d.goals = [];
    d.objectives = [];
    d.kpis = [];
    d.updates = [];
    const result = await importWorkbook(await buildTestWorkbook(d));
    expect(result.warnings).toEqual([]);
    expect(result.data.objectives).toHaveLength(0);
  });
  it("accepts reordered records and blank rows", async () => {
    const d = fixtureData();
    d.goals.reverse();
    d.objectives.reverse();
    d.kpis.reverse();
    d.updates.reverse();
    const buffer = await rewrite(
      await buildTestWorkbook(d),
      testPaths.Goals,
      (xml) =>
        xml.replace(
          "</sheetData>",
          '<row r="100"><c r="A100"/></row></sheetData>',
        ),
    );
    expect((await importWorkbook(buffer)).data.goals.map((g) => g.id)).toEqual(
      d.goals.map((g) => g.id),
    );
  });
  it("requires all eight sheets and the full column schema", async () => {
    const missingSheet = await rewrite(synthetic, "xl/workbook.xml", (xml) =>
      xml.replace(/<sheet name="Instructions"[^>]+\/>/, ""),
    );
    await expect(importWorkbook(missingSheet)).rejects.toThrow("Instructions");
    const missingHeader = await rewrite(
      synthetic,
      testPaths["Objective Entry"],
      (xml) => xml.replace("Actual Completion %", "Unexpected Column"),
    );
    await expect(importWorkbook(missingHeader)).rejects.toThrow(
      "Actual Completion %",
    );
  });
  it("rejects reordered/extra columns clearly, instead of corrupting exports", async () => {
    const buffer = await rewrite(synthetic, testPaths.Goals, (xml) =>
      xml
        .replace("Goal ID", "TEMP")
        .replace("BBC Strategic Goal", "Goal ID")
        .replace("TEMP", "BBC Strategic Goal"),
    );
    await expect(importWorkbook(buffer)).rejects.toThrow(
      "original template order",
    );
  });
  it("rejects duplicate IDs including case variants and orphan references", async () => {
    const d = fixtureData();
    d.goals.push({ ...d.goals[0], id: "g001" });
    await expect(importWorkbook(await buildTestWorkbook(d))).rejects.toThrow(
      "Duplicate goals ID",
    );
    d.goals.pop();
    d.kpis[0].objectiveId = "OBJ999";
    await expect(importWorkbook(await buildTestWorkbook(d))).rejects.toThrow(
      "unmatched objective",
    );
  });
  it("does not silently skip partially populated rows with a missing ID", async () => {
    const d = fixtureData();
    d.goals[0].id = "";
    await expect(importWorkbook(await buildTestWorkbook(d))).rejects.toThrow(
      "no Goal ID",
    );
  });
  it("does not coerce missing progress or malformed numbers to zero", async () => {
    const missing = await rewrite(
      synthetic,
      testPaths["Objective Entry"],
      (xml) => xml.replace(/<c r="K2">.*?<\/c>/, '<c r="K2"/>'),
    );
    await expect(importWorkbook(missing)).rejects.toThrow(
      "Actual Completion %",
    );
    const invalid = await rewrite(synthetic, testPaths["KPI Tracking"], (xml) =>
      xml.replace(
        /<c r="F2">.*?<\/c>/,
        '<c r="F2" t="inlineStr"><is><t>unknown</t></is></c>',
      ),
    );
    await expect(importWorkbook(invalid)).rejects.toThrow("Target");
  });
  it("reads cached input formulas and explains missing formula caches", async () => {
    const buffer = await rewrite(
      synthetic,
      testPaths["Objective Entry"],
      (xml) =>
        xml.replace(/<c r="K2">.*?<\/c>/, '<c r="K2"><f>1/2</f><v>0.5</v></c>'),
    );
    expect((await importWorkbook(buffer)).data.objectives[0].actual).toBe(0.5);
    const noCache = await rewrite(buffer, testPaths["Objective Entry"], (xml) =>
      xml.replace("<f>1/2</f><v>0.5</v>", "<f>1/2</f>"),
    );
    await expect(importWorkbook(noCache)).rejects.toThrow("no cached result");
  });
  it("retains custom dropdown values, optional blanks, zero and negative targets", async () => {
    const d = fixtureData();
    d.objectives[0].ministry = "A new ministry";
    d.objectives[0].status = "Awaiting review";
    d.kpis[0].actual = null;
    d.kpis[0].target = 0;
    d.kpis[1].target = -10;
    const result = await importWorkbook(await buildTestWorkbook(d));
    expect(result.data.lists.ministries).toContain("A new ministry");
    expect(result.data.lists.statuses).toContain("Awaiting review");
    expect(result.data.kpis[0].actual).toBeNull();
    expect(result.data.kpis[1].target).toBe(-10);
    expect(result.warnings?.some((w) => w.includes("zero target"))).toBe(true);
  });
  it("rejects corrupt archives and enforces the compressed size limit", async () => {
    await expect(
      importWorkbook(new Uint8Array([1, 2, 3]).buffer),
    ).rejects.toThrow("valid .xlsx");
    await expect(
      importWorkbook(new ArrayBuffer(30 * 1024 * 1024 + 1)),
    ).rejects.toThrow("30 MB");
  });
});

describe("Excel calendar interoperability", () => {
  it("floors time-of-day fractions and handles the Excel 1900 leap-year defect explicitly", () => {
    expect(serialToDate(46286.99)).toBe(serialToDate(46286));
    expect(serialToDate(59)).toBe("1900-02-28");
    expect(serialToDate(61)).toBe("1900-03-01");
    expect(() => serialToDate(60)).toThrow();
    expect(dateToSerial("2026-02-30")).toBeNull();
    expect(serialToDate(0, true)).toBe("1904-01-01");
    expect(dateToSerial("1904-01-01", true)).toBe(0);
  });
  it("imports and round-trips 1904 workbooks without shifting dates", async () => {
    let buffer = await rewrite(synthetic, "xl/workbook.xml", (xml) =>
      xml.replace("<workbookPr/>", '<workbookPr date1904="1"/>'),
    );
    for (const [name, letters] of [
      ["Objective Entry", ["H", "I", "P"]],
      ["KPI Tracking", ["J"]],
      ["Objective Updates", ["C"]],
    ] as const)
      buffer = await rewrite(buffer, testPaths[name], (xml) =>
        xml.replace(
          /<c r="([A-Z]+)(\d+)"><v>([^<]+)<\/v><\/c>/g,
          (whole, col, row, value) =>
            Number(row) > 1 && (letters as readonly string[]).includes(col)
              ? `<c r="${col}${row}"><v>${Number(value) - 1462}</v></c>`
              : whole,
        ),
      );
    const loaded = await importWorkbook(buffer);
    expect(loaded.data.objectives[0].startDate).toBe(
      fixtureData().objectives[0].startDate,
    );
    const blob = await exportWorkbook(buffer, loaded.data, asOf);
    expect(
      (await importWorkbook(await blob.arrayBuffer())).data.objectives,
    ).toEqual(loaded.data.objectives);
  });
});

describe("Mandatory import → mutations → export → fresh import workflow", () => {
  async function roundTrip(buffer: ArrayBuffer, saveEvidence = false) {
    const loaded = await importWorkbook(buffer);
    let d = loaded.data;
    d = saveRecordData(d, "goal", gform).data;
    d = saveRecordData(d, "objective", oform).data;
    d = saveRecordData(d, "objective", {
      ...oform,
      description: "Second new objective",
    }).data;
    d = saveRecordData(d, "kpi", kform).data;
    d = saveRecordData(d, "kpi", {
      ...kform,
      objectiveId: "OBJ022",
      unit: "%",
      target: "90",
      actual: "45",
    }).data;
    d = saveRecordData(d, "update", uform).data;
    d = saveRecordData(d, "update", {
      ...uform,
      objectiveId: "OBJ022",
      comment: "Second snapshot",
    }).data;
    d = saveRecordData(
      d,
      "goal",
      { ...gform, title: "Edited existing strategic goal" },
      d.goals[0],
    ).data;
    d = saveRecordData(
      d,
      "kpi",
      {
        ...kform,
        objectiveId: d.kpis[0].objectiveId,
        name: "Edited existing measure",
        actual: "12.345678901234",
      },
      d.kpis[0],
    ).data;
    const temporary = saveRecordData(d, "goal", {
      ...gform,
      title: "Disposable goal",
    });
    d = deleteRecordData(temporary.data, "goal", temporary.record.id);
    const before = buildDashboard(objectiveViews(d, asOf), d.kpis),
      blob = await exportWorkbook(buffer, d, asOf),
      bytes = await blob.arrayBuffer();
    const fresh = await importWorkbook(bytes, "fresh.xlsx");
    expect(fresh.data).toEqual(seedIdCounters(d));
    expect(
      buildDashboard(objectiveViews(fresh.data, asOf), fresh.data.kpis),
    ).toEqual(before);
    expect(validateRelationships(fresh.data)).toEqual([]);
    expect(saveRecordData(fresh.data, "goal", gform).record.id).toBe("G008");
    expect([
      fresh.data.goals.length,
      fresh.data.objectives.length,
      fresh.data.kpis.length,
      fresh.data.updates.length,
    ]).toEqual([6, 22, 40, 82]);
    if (saveEvidence) {
      mkdirSync(".cache/evidence", { recursive: true });
      writeFileSync(".cache/evidence/round-trip.xlsx", Buffer.from(bytes));
      writeFileSync(
        ".cache/evidence/round-trip-expected.json",
        JSON.stringify(
          {
            counts: { goals: 6, objectives: 22, kpis: 40, updates: 82 },
            data: d,
            dashboard: before,
          },
          null,
          2,
        ),
      );
    }
    return { bytes, data: fresh.data };
  }
  it("round-trips every record, counter and derived calculation with the synthetic fixture", async () => {
    await roundTrip(synthetic);
  });
  it.runIf(Boolean(process.env.BBC_WORKBOOK_PATH))(
    "round-trips the ORIGINAL supplied workbook with independent inspection evidence",
    async () => {
      const buffer = Uint8Array.from(
        readFileSync(process.env.BBC_WORKBOOK_PATH!),
      ).buffer;
      const imported = await importWorkbook(buffer);
      expect([
        imported.data.goals.length,
        imported.data.objectives.length,
        imported.data.kpis.length,
        imported.data.updates.length,
      ]).toEqual([5, 20, 38, 80]);
      const result = await roundTrip(buffer, true),
        original = await JSZip.loadAsync(buffer),
        exported = await JSZip.loadAsync(result.bytes);
      const workbookXML = new DOMParser().parseFromString(
        await original.file("xl/workbook.xml")!.async("string"),
        "application/xml",
      );
      const dashboard = Array.from(workbookXML.getElementsByTagName("*")).find(
        (e) =>
          e.localName === "sheet" && e.getAttribute("name") === "Dashboard",
      )!;
      const relationships = new DOMParser().parseFromString(
        await original.file("xl/_rels/workbook.xml.rels")!.async("string"),
        "application/xml",
      );
      const target = Array.from(relationships.getElementsByTagName("*"))
        .find((e) => e.getAttribute("Id") === dashboard.getAttribute("r:id"))!
        .getAttribute("Target")!;
      const dashboardPath = target.startsWith("/")
        ? target.slice(1)
        : "xl/" + target;
      const preserved = Object.keys(original.files).filter(
        (p) =>
          (/xl\/(charts|drawings|slicers|slicerCaches|theme)\/|xl\/styles.xml/.test(
            p,
          ) ||
            p === dashboardPath) &&
          !original.files[p].dir,
      );
      for (const path of preserved) {
        const hash = async (z: JSZip) =>
          createHash("sha256")
            .update(await z.file(path)!.async("uint8array"))
            .digest("hex");
        expect(await hash(exported), path).toBe(await hash(original));
      }
      expect(exported.file("xl/calcChain.xml")).toBeNull();
      const wb = await exported.file("xl/workbook.xml")!.async("string");
      expect(wb).toContain("BBC_ReportingDate");
      expect(wb).toContain('fullCalcOnLoad="1"');
      writeFileSync(
        ".cache/evidence/preservation.json",
        JSON.stringify({ preservedParts: preserved, passed: true }, null, 2),
      );
    },
  );
  it("retains the reporting date, valid formulas, metadata and expanded ranges", async () => {
    const d = (await importWorkbook(synthetic)).data;
    d.objectives.push({ ...d.objectives[0], id: "OBJ999" });
    const blob = await exportWorkbook(synthetic, d, asOf),
      zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(await zip.file("docProps/custom.xml")!.async("string")).toContain(
      "BBC.IdHighWater",
    );
    const objective = await zip
      .file(testPaths["Objective Entry"])!
      .async("string");
    expect(objective).toContain("B2:B22");
    expect(objective).toContain("BBC_ReportingDate");
    const table = await zip.file("xl/tables/table2.xml")!.async("string");
    expect(table).toContain("A1:AC22");
    const kpis = await zip.file("xl/tables/table3.xml")!.async("string");
    expect(kpis).toContain("Target]]=0");
    expect(kpis).toContain('Actual]]=""');
  });
  it("supports repeated round trips without stacking formula guards", async () => {
    const d = (await importWorkbook(synthetic)).data;
    const first = await exportWorkbook(synthetic, d, asOf),
      firstBytes = await first.arrayBuffer(),
      fresh = (await importWorkbook(firstBytes)).data;
    const second = await exportWorkbook(firstBytes, fresh, asOf);
    const a = await JSZip.loadAsync(firstBytes),
      b = await JSZip.loadAsync(await second.arrayBuffer());
    expect(await b.file("xl/tables/table2.xml")!.async("string")).toBe(
      await a.file("xl/tables/table2.xml")!.async("string"),
    );
  });
  it("keeps literal formula-like text as text and preserves invalid date evidence", async () => {
    const d = (await importWorkbook(synthetic)).data;
    d.goals[0].description = "=SUM(1,2) < & >";
    d.objectives[0].startDate = "bad date";
    const blob = await exportWorkbook(synthetic, d, asOf),
      fresh = await importWorkbook(await blob.arrayBuffer());
    expect(fresh.data.goals[0].description).toBe("=SUM(1,2) < & >");
    expect(fresh.data.objectives[0].startDate).toBe("bad date");
    expect(fresh.warnings?.some((w) => w.includes("invalid start date"))).toBe(
      true,
    );
  });
  it("has no fixed record-count limit: imports, calculates and round-trips 1,200 objectives", async () => {
    const d = fixtureData(),
      o = d.objectives[0],
      k = d.kpis[0],
      u = d.updates[0];
    d.objectives = Array.from({ length: 1200 }, (_, i) => ({
      ...o,
      id: `OBJ${String(i + 1).padStart(3, "0")}`,
    }));
    d.kpis = d.objectives.map((o, i) => ({
      ...k,
      id: `KPI${String(i + 1).padStart(3, "0")}`,
      objectiveId: o.id,
    }));
    d.updates = d.objectives.map((o, i) => ({
      ...u,
      id: `UPD${String(i + 1).padStart(4, "0")}`,
      objectiveId: o.id,
    }));
    const start = performance.now(),
      buffer = await buildTestWorkbook(d),
      loaded = await importWorkbook(buffer),
      blob = await exportWorkbook(buffer, loaded.data, asOf),
      fresh = await importWorkbook(await blob.arrayBuffer());
    expect(fresh.data.objectives).toHaveLength(1200);
    expect(fresh.data.kpis).toHaveLength(1200);
    expect(fresh.data.updates).toHaveLength(1200);
    expect(fresh.data).toEqual(loaded.data);
    mkdirSync(".cache/evidence", { recursive: true });
    writeFileSync(
      ".cache/evidence/performance.json",
      JSON.stringify({
        objectives: 1200,
        kpis: 1200,
        updates: 1200,
        elapsedMs: performance.now() - start,
        environment:
          "Node/jsdom; includes fixture generation, import, export, reimport",
      }),
    );
  });
});
