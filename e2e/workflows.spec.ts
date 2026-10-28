import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import path from "node:path";
const fixture = path.resolve(".cache/synthetic.xlsx");
const nav = async (page: Page, name: string) => {
  const menu = page.getByRole("button", { name: "Toggle navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", {
      name: ["Workbook", "Data Quality"].includes(name)
        ? "Workspace tools"
        : "Main navigation",
    })
    .getByRole("button", { name, exact: true })
    .click();
};
const upload = async (page: Page, file = fixture) => {
  await page.getByLabel("Upload Excel workbook").setInputFiles(file);
  await expect(
    page.getByText("Your workspace is ready", { exact: true }),
  ).toBeVisible();
};
async function addGoal(page: Page, title: string) {
  await nav(page, "Goals");
  await page.getByRole("button", { name: /Add goal/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Strategic goal", { exact: false }).fill(title);
  await dialog
    .getByLabel("Accountable person", { exact: false })
    .fill("Ministry leader");
  await dialog
    .getByLabel("Goal description", { exact: false })
    .fill("Community service and outreach.");
  await dialog.getByRole("button", { name: "Create record" }).click();
  await expect(dialog).toBeHidden();
}

test("empty workspace, branding, favicon and keyboard dialog navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("BBC Perfomance Dashboard");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Export Excel" }),
  ).toBeDisabled();
  await expect(
    page.locator('link[rel=icon][type="image/svg+xml"]'),
  ).toHaveAttribute("href", "/favicon.svg");
  await upload(page);
  await nav(page, "Goals");
  await page.getByRole("button", { name: /Add goal/i }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("successive IDs, blocked parent deletion, browser refresh and Excel round trip", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await upload(page);
  await addGoal(page, "New browser goal");
  await expect(page.getByText("G006", { exact: true })).toBeVisible();
  await addGoal(page, "Disposable browser goal");
  await expect(page.getByText("G007", { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete G007" }).click();
  await expect(page.getByText("G007", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Delete G001" }).click();
  await expect(page.getByRole("status")).toContainText("linked to objectives");
  await expect(page.locator(".workbook-name")).toHaveAttribute(
    "title",
    "Saved in this browser",
  );
  await page.reload();
  await expect(
    page.getByText("Your workspace is ready", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Excel" }).click();
  const download = await downloadPromise;
  const filename = test.info().outputPath("browser-round-trip.xlsx");
  await download.saveAs(filename);
  const freshContext = await browser.newContext({
    timezoneId: "America/New_York",
  });
  const fresh = await freshContext.newPage();
  await fresh.goto("http://127.0.0.1:4173");
  await upload(fresh, filename);
  await addGoal(fresh, "Next ID after round trip");
  await expect(fresh.getByText("G008", { exact: true })).toBeVisible();
  await freshContext.close();
  expect(errors).toEqual([]);
});

test("filtering, sorting, detail, readable charts and desktop screenshots", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await upload(page);
  await page.screenshot({
    path: test.info().outputPath("overview-desktop.png"),
    fullPage: true,
  });
  await nav(page, "Dashboard");
  await page.getByLabel("Reporting date").fill("2026-10-27");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Planned completion" })
      .locator(".metric-value"),
  ).toHaveText("67.3%");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("dashboard-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Goal: All" }).click();
  await page.getByRole("checkbox", { name: /G001/ }).check();
  await page.keyboard.press("Escape");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Total objectives" })
      .locator(".metric-value"),
  ).toHaveText("4");
  await page.getByRole("button", { name: /Clear all/ }).click();
  await nav(page, "Objectives");
  await page.getByLabel("Sort objectives").selectOption("id");
  await page.getByRole("button", { name: "OBJ001", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Linked KPIs");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: test.info().outputPath("objectives-desktop.png"),
    fullPage: true,
  });
});

test("responsive screens and upload availability across tabs", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await upload(page);
  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await nav(page, "Overview");
    await expect(
      page.getByRole("heading", { name: /Welcome to/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath(`overview-${width}.png`),
      fullPage: true,
    });
  }
  const other = await context.newPage();
  await other.goto("http://127.0.0.1:4173");
  await expect(
    other.getByRole("button", { name: "Upload Excel" }),
  ).toBeEnabled();
  await other.close();
});
