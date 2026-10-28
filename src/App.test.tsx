import "fake-indexeddb/auto";
import { File as NodeFile } from "node:buffer";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import App from "./App";
import { StrictMode } from "react";
import * as workbook from "./lib/workbook";
import { buildTestWorkbook, fixtureData } from "./lib/test-workbook";

let buffer: ArrayBuffer;
beforeEach(async () => {
  await workbook.clearWorkspace();
  buffer = await buildTestWorkbook();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start() {
  const result = render(<App />);
  await screen.findByRole("heading", { name: "Overview" });
  return result;
}
async function upload(bytes = buffer) {
  fireEvent.change(screen.getByLabelText("Upload Excel workbook"), {
    target: {
      files: [new NodeFile([new Uint8Array(bytes)], "Verification.xlsx")],
    },
  });
  await screen.findByText("Your workspace is ready", { exact: true });
}
function nav(name: string) {
  const label = ["Data Quality", "Workbook"].includes(name)
    ? "Workspace tools"
    : "Main navigation";
  fireEvent.click(
    within(screen.getByRole("navigation", { name: label })).getByRole(
      "button",
      { name },
    ),
  );
}
function fill(label: string, value: string) {
  fireEvent.change(
    within(screen.getByRole("dialog")).getByLabelText(new RegExp("^" + label)),
    { target: { value } },
  );
}
async function submit() {
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: /Create record|Save changes/,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}
async function addGoal(title = "New community goal") {
  nav("Goals");
  fireEvent.click(screen.getByRole("button", { name: /Add goal/i }));
  fill("Strategic goal", title);
  fill("Accountable person", "Ministry leader");
  fill("Goal description", "Serve the community & support families.");
  await submit();
}
async function addObjective(description: string) {
  nav("Objectives");
  fireEvent.click(screen.getByRole("button", { name: /Add objective/i }));
  for (const [label, value] of Object.entries({
    "Linked goal": "G006",
    "Objective description": description,
    Ministry: "New ministry",
    "Assigned role": "Ministry lead",
    "Accountable person": "Ministry leader",
    "Start date": "2026-01-01",
    "End date": "2026-12-31",
    "Actual completion": "25",
    "Objective status": "In Progress",
    Priority: "High",
    "Last update date": "2026-10-27",
  }))
    fill(label, value);
  await submit();
}
async function addKpi(objectiveId: string) {
  nav("KPI Tracking");
  fireEvent.click(screen.getByRole("button", { name: /Add KPI/i }));
  for (const [label, value] of Object.entries({
    "Linked objective": objectiveId,
    "KPI name": "People served " + objectiveId,
    Unit: "Count",
    Target: "100",
    Actual: "60",
    "Measurement date": "2026-10-27",
  }))
    fill(label, value);
  await submit();
}
async function addUpdate(objectiveId: string, apply = false) {
  nav("Updates");
  fireEvent.click(screen.getByRole("button", { name: /Add update/i }));
  for (const [label, value] of Object.entries({
    "Linked objective": objectiveId,
    "Update date": "2026-10-27",
    Completion: "50",
    "Status rating": "4",
    "KPI achievement": "125",
    "Update comment": "A progress snapshot " + objectiveId,
  }))
    fill(label, value);
  if (apply)
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: /Also apply/,
      }),
    );
  await submit();
}
function metric(label: string) {
  return screen
    .getByText(label, { exact: true })
    .closest(".metric")!
    .querySelector(".metric-value")!.textContent;
}

describe("React UI integration (DOM, not a rendered browser)", () => {
  it("shows objective comments in Attention required and uses updated status descriptions", async () => {
    const data = fixtureData();
    data.objectives[2].comments = "Contact leadership for the overdue recovery plan.";
    await start();
    await upload(await buildTestWorkbook(data));
    nav("Dashboard");
    expect(screen.getByRole("columnheader", { name: "COMMENTS" })).toBeTruthy();
    expect(screen.getByText("Contact leadership for the overdue recovery plan.")).toBeTruthy();
    expect(screen.getAllByText(/Red — Significantly Behind/).length).toBeGreaterThan(0);
  });

  it("keeps upload available under Strict Mode without consulting Web Locks", async () => {
    const request = vi.fn(() => {
      throw new Error("Locks unavailable");
    });
    vi.stubGlobal("navigator", { locks: { request } });
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await screen.findByRole("heading", { name: "Overview" });
    expect(
      (
        screen.getByRole("button", {
          name: "Upload Excel",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it("loads the included workbook automatically when no saved workspace exists", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => buffer,
    } as Response);
    await start();
    await screen.findByText("Your workspace is ready", { exact: true });
    expect(metric("Strategic goals")).toBe("5");
    expect(metric("Ministry objectives")).toBe("20");
    expect(metric("KPIs tracked")).toBe("38");
  });
  it("unlocks the protected starter without blocking ordinary Excel upload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Enter workbook password.",
    } as Response);
    await start();
    expect(
      (
        screen.getByRole("button", {
          name: "Upload Excel",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => buffer,
    } as Response);
    fireEvent.change(screen.getByLabelText("Workbook password"), {
      target: { value: "test-only" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load included workbook" }),
    );
    await screen.findByText("Your workspace is ready", { exact: true });
    expect(metric("Strategic goals")).toBe("5");
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]).toMatchObject({
      headers: { Authorization: "Bearer test-only" },
    });
  });
  it("retains a manual reporting date after reload and Excel export/reimport", async () => {
    const first = await start();
    await upload();
    fireEvent.change(screen.getByLabelText("Reporting date"), {
      target: { value: "2026-09-29" },
    });
    await waitFor(async () =>
      expect((await workbook.loadWorkspace())?.reportingDate).toBe(
        "2026-09-29",
      ),
    );
    first.unmount();
    await start();
    await screen.findByText("Your workspace is ready", { exact: true });
    expect(
      (screen.getByLabelText("Reporting date") as HTMLInputElement).value,
    ).toBe("2026-09-29");
    const stored = (await workbook.loadWorkspace())!;
    const exported = await workbook.exportWorkbook(
      stored.buffer,
      stored.data,
      stored.reportingDate,
    );
    const reimported = await workbook.importWorkbook(
      await exported.arrayBuffer(),
    );
    expect(reimported.reportingDate).toBe("2026-09-29");
    expect(reimported.liveDate).toBe(false);
  });
  it("opens Overview without sample data and exposes import as the starting action", async () => {
    await start();
    expect(
      screen.getByRole("heading", {
        name: /Welcome to.*BBC Perfomance Dashboard/,
      }),
    ).toBeTruthy();
    expect(metric("Strategic goals")).toBe("0");
    expect(metric("KPIs tracked")).toBe("0");
    expect(
      (
        screen.getByRole("button", {
          name: "Export Excel",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    nav("Goals");
    expect(
      (screen.getByRole("button", { name: /Add goal/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("loads live Overview/Dashboard metrics, including controlled reporting dates", async () => {
    await start();
    await upload();
    expect(metric("Strategic goals")).toBe("5");
    expect(metric("Completed objectives")).toBe("2");
    nav("Dashboard");
    fireEvent.change(screen.getByLabelText("Reporting date"), {
      target: { value: "2026-10-27" },
    });
    expect(metric("Total objectives")).toBe("20");
    expect(metric("Total KPIs")).toBe("38");
    expect(metric("Actual completion")).toBe("52.8%");
    expect(metric("Planned completion")).toBe("67.3%");
    fireEvent.change(screen.getByLabelText("Reporting date"), {
      target: { value: "2026-09-29" },
    });
    expect(metric("Planned completion")).toBe("59.0%");
  });
  it("applies simultaneous filters, clears them and scopes search to all dashboard metrics", async () => {
    await start();
    await upload();
    nav("Dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Goal: All" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /G001/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Priority: All" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "High" }));
    fireEvent.keyDown(window, { key: "Escape" });
    const expected = fixtureData().objectives.filter(
      (o) => o.goalId === "G001" && o.priority === "High",
    ).length;
    expect(metric("Total objectives")).toBe(String(expected));
    fireEvent.click(screen.getByRole("button", { name: /Clear all/ }));
    expect(metric("Total objectives")).toBe("20");
    fireEvent.change(screen.getByLabelText("Search current records"), {
      target: { value: "OBJ001" },
    });
    expect(metric("Total objectives")).toBe("1");
    expect(metric("Total KPIs")).toBe("2");
  });
  it("cancels edits, traps focus and closes dialogs with Escape", async () => {
    await start();
    await upload();
    nav("Goals");
    const add = screen.getByRole("button", { name: /Add goal/i });
    add.focus();
    fireEvent.click(add);
    fill("Strategic goal", "Unsaved goal");
    const buttons = within(screen.getByRole("dialog")).getAllByRole("button");
    buttons.at(-1)!.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement === buttons[0]).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Unsaved goal")).toBeNull();
    expect(document.activeElement === add).toBe(true);
  });
  it("blocks deletion of linked parents and honors cancel on ordinary deletion", async () => {
    await start();
    await upload();
    nav("Goals");
    fireEvent.click(screen.getByRole("button", { name: "Delete G001" }));
    expect(
      await screen.findByText(/This goal is linked to objectives/),
    ).toBeTruthy();
    nav("KPI Tracking");
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete KPI001" }));
    expect(screen.getByRole("button", { name: "Delete KPI001" })).toBeTruthy();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete KPI001" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Delete KPI001" }),
      ).toBeNull(),
    );
  });
  it("keeps the workspace when an import is rejected or replacement is cancelled", async () => {
    await start();
    await upload();
    fireEvent.change(screen.getByLabelText("Upload Excel workbook"), {
      target: { files: [new NodeFile(["broken"], "Bad.xlsx")] },
    });
    expect(await screen.findByText(/not a valid .xlsx/)).toBeTruthy();
    expect(metric("Strategic goals")).toBe("5");
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.change(screen.getByLabelText("Upload Excel workbook"), {
      target: {
        files: [new NodeFile([new Uint8Array(buffer)], "Another.xlsx")],
      },
    });
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(metric("Strategic goals")).toBe("5");
  });
  it("restores the saved workspace after an application remount", async () => {
    const first = await start();
    await upload();
    await addGoal();
    await waitFor(async () =>
      expect((await workbook.loadWorkspace())?.data.goals.length).toBe(6),
    );
    first.unmount();
    await start();
    await screen.findByText("Your workspace is ready", { exact: true });
    expect(metric("Strategic goals")).toBe("6");
    nav("Goals");
    expect(screen.getByText("G006", { exact: true })).toBeTruthy();
  });
  it("performs the complete round trip through actual forms, export and a fresh workspace", async () => {
    const download = vi
        .spyOn(workbook, "downloadBlob")
        .mockImplementation(() => {}),
      first = await start();
    await upload();
    await addGoal();
    await addObjective("New objective one");
    await addObjective("New objective two");
    await addKpi("OBJ021");
    await addKpi("OBJ022");
    await addUpdate("OBJ021");
    await addUpdate("OBJ022", true);
    nav("Goals");
    fireEvent.click(screen.getByRole("button", { name: "Edit G001" }));
    fill("Strategic goal", "Edited existing goal");
    await submit();
    await addGoal("Disposable goal");
    fireEvent.click(screen.getByRole("button", { name: "Delete G007" }));
    await waitFor(() =>
      expect(screen.queryByText("G007", { exact: true })).toBeNull(),
    );
    nav("Overview");
    expect(metric("Strategic goals")).toBe("6");
    expect(metric("Ministry objectives")).toBe("22");
    expect(metric("KPIs tracked")).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce(), {
      timeout: 15000,
    });
    const [blob, filename] = download.mock.calls[0];
    expect(filename).toContain("BBC_Perfomance_Dashboard_");
    const bytes = await blob.arrayBuffer(),
      fresh = await workbook.importWorkbook(bytes);
    expect(fresh.data.objectives.find((o) => o.id === "OBJ021")?.actual).toBe(
      0.25,
    );
    expect(fresh.data.objectives.find((o) => o.id === "OBJ022")?.actual).toBe(
      0.5,
    );
    expect([
      fresh.data.goals.length,
      fresh.data.objectives.length,
      fresh.data.kpis.length,
      fresh.data.updates.length,
    ]).toEqual([6, 22, 40, 82]);
    await waitFor(async () =>
      expect((await workbook.loadWorkspace())?.data.goals.length).toBe(6),
    );
    first.unmount();
    await workbook.clearWorkspace();
    await start();
    await upload(bytes);
    await addGoal("Next after deletion");
    expect(screen.getByText("G008", { exact: true })).toBeTruthy();
  });
});
