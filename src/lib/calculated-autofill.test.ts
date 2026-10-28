import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildTestWorkbook, fixtureData, testPaths } from "./test-workbook";
import { exportWorkbook, importWorkbook, schema } from "./workbook";

const letter = (i: number) => {
  let result = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
};

// Ensures that exporting a newly created record writes a real formula into
// every Excel calculated field, not just a cached JavaScript value.
describe("Excel calculated-column autofill after record changes", () => {
  it("fills 14 Objective, 9 KPI, and 6 Update formula fields and retains their table metadata", async () => {
    const source = await buildTestWorkbook();
    const data = fixtureData();
    const originalObjective = data.objectives[0];
    data.objectives.push({
      ...originalObjective,
      id: "OBJ900", goalId: data.goals[0].id,
      rating: 4, actual: 0.45, status: "Slightly Ahead of Schedule",
    });
    data.kpis.push({
      ...data.kpis[0], id: "KPI900", objectiveId: "OBJ900",
      target: 50, actual: 60,
    });
    data.updates.push({
      ...data.updates[0], id: "UPD900", objectiveId: "OBJ900",
      rating: 4, actual: 0.45,
    });
    const output = await exportWorkbook(source, data, "2026-10-28");
    const zip = await JSZip.loadAsync(await output.arrayBuffer());
    const checks = [
      ["Objective Entry", "xl/tables/table2.xml", data.objectives.length + 1, 14],
      ["KPI Tracking", "xl/tables/table3.xml", data.kpis.length + 1, 9],
      ["Objective Updates", "xl/tables/table4.xml", data.updates.length + 1, 6],
    ] as const;
    for (const [sheetName, tablePath, rowNumber, requiredCount] of checks) {
      const table = new DOMParser().parseFromString(
        await zip.file(tablePath)!.async("string"), "application/xml",
      );
      const columns = Array.from(table.getElementsByTagName("*"))
        .filter((node) => node.localName === "tableColumn");
      const formulaIndexes = columns.flatMap((c, i) =>
        Array.from(c.children).some((child) => child.localName === "calculatedColumnFormula") ? [i] : [],
      );
      expect(formulaIndexes).toHaveLength(requiredCount);
      const sheet = new DOMParser().parseFromString(
        await zip.file(testPaths[sheetName])!.async("string"), "application/xml",
      );
      const cells = Array.from(sheet.getElementsByTagName("*"))
        .filter((node) => node.localName === "c");
      for (const index of formulaIndexes) {
        const ref = `${letter(index)}${rowNumber}`;
        const c = cells.find((cell) => cell.getAttribute("r") === ref);
        expect(c, `${sheetName}: ${ref} must exist`).toBeDefined();
        expect(Array.from(c!.children).some((child) => child.localName === "f"),
          `${sheetName}: ${ref} must have an Excel formula`).toBe(true);
      }
      expect(table.documentElement.getAttribute("ref")).toBe(
        `A1:${letter(schema[sheetName].length - 1)}${rowNumber}`,
      );
    }
    const reloaded = await importWorkbook(await output.arrayBuffer());
    expect(reloaded.data.objectives).toHaveLength(data.objectives.length);
    expect(reloaded.data.kpis).toHaveLength(data.kpis.length);
    expect(reloaded.data.updates).toHaveLength(data.updates.length);
  });
});
