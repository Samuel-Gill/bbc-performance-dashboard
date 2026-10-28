import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { exportWorkbook } from "./workbook";
import { buildTestWorkbook, fixtureData, testPaths } from "./test-workbook";

const ORIGINAL_FORMULA =
  'IF($B89="","",INDEX(tblObjectives[Comments],MATCH($B89,tblObjectives[Objective ID],0)))';
const GENERATED_FORMULA = (n: number) =>
  `IF($B${n}="","",IFERROR(INDEX(tblObjectives[Comments],MATCH($B${n},tblObjectives[Objective ID],0)),""))`;

type Layout = "native" | "duplicate" | "user-owned" | "legacy";

function dashboardXml(layout: Layout) {
  const withOriginal = layout !== "legacy";
  const withGenerated = layout === "duplicate";
  const withUserCell = layout === "user-owned";
  const rows = Array.from({ length: 11 }, (_, i) => {
    const n = i + 88;
    const original = !withOriginal
      ? ""
      : n === 88
        ? '<c r="P88" t="inlineStr"><is><t>Comments</t></is></c>'
        : `<c r="P${n}"><f>${ORIGINAL_FORMULA.replaceAll("89", String(n))}</f><v/></c>`;
    const duplicate = withGenerated
      ? n === 88
        ? '<c r="S88" t="inlineStr"><is><t>Comments</t></is></c>'
        : `<c r="S${n}"><f>${GENERATED_FORMULA(n)}</f><v/></c>`
      : withUserCell && n === 89
        ? '<c r="S89" t="inlineStr"><is><t>My separate notes</t></is></c>'
        : "";
    return `<row r="${n}"><c r="B${n}" t="inlineStr"><is><t>OBJ003</t></is></c>${original}${duplicate}</row>`;
  }).join("");
  const hasColumnS = withGenerated || withUserCell;
  const columns = hasColumnS
    ? '<col min="19" max="19" width="50" customWidth="1"/><col min="20" max="16383" width="0" hidden="1" customWidth="1"/>'
    : '<col min="19" max="16383" width="0" hidden="1" customWidth="1"/>';
  const onTrackFormula =
    '<row r="87"><c r="I87"><f>COUNTIFS(tblObjectives[Objective Status],"&lt;&gt;Completed")</f></c></row>';
  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${hasColumnS ? "S" : "R"}1048576"/><cols>${columns}</cols><sheetData>${onTrackFormula}${rows}</sheetData></worksheet>`;
}

async function exportedDashboard(layout: Layout) {
  const zip = await JSZip.loadAsync(await buildTestWorkbook());
  zip.file(testPaths.Dashboard, dashboardXml(layout));
  const blob = await exportWorkbook(
    await zip.generateAsync({ type: "arraybuffer" }),
    fixtureData(),
    "2026-10-28",
  );
  const exported = await JSZip.loadAsync(await blob.arrayBuffer());
  return exported.file(testPaths.Dashboard)!.async("string");
}

describe("Excel Comments compatibility after Objective Progress migration", () => {
  it("reuses native P:R Comments without adding S", async () => {
    const xml = await exportedDashboard("native");
    expect(xml).toContain(`<f>${ORIGINAL_FORMULA}</f>`);
    expect(xml).not.toContain('r="S88"');
    expect(xml).not.toContain('r="S89"');
    expect(xml).toContain('ref="A1:R1048576"');
    expect(xml).toContain('tblObjectives[Actual Completion %],"&lt;1"');
  });

  it("cleans up previously generated S without touching the P lookup", async () => {
    const xml = await exportedDashboard("duplicate");
    expect(xml).toContain(`<f>${ORIGINAL_FORMULA}</f>`);
    expect(xml).not.toContain('r="S88"');
    expect(xml).not.toContain('r="S89"');
    expect(xml).not.toContain('r="S98"');
    expect(xml).toContain('<col min="19" max="16383" width="0" hidden="1" customWidth="1"/>');
    expect(xml).toContain('ref="A1:R1048576"');
  });

  it("does not delete a separate user-maintained S cell", async () => {
    const xml = await exportedDashboard("user-owned");
    expect(xml).toContain("My separate notes");
    expect(xml).toContain('r="S89"');
    expect(xml).toContain(`<f>${ORIGINAL_FORMULA}</f>`);
  });

  it("continues adding S to legacy templates lacking native Comments", async () => {
    const xml = await exportedDashboard("legacy");
    expect(xml).toContain('r="S88"');
    expect(xml).toContain(`<f>${GENERATED_FORMULA(89)}</f>`);
    expect(xml).toContain('ref="A1:S1048576"');
  });
});
