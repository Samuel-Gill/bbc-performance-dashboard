import { expect, test } from "@playwright/test";

test("Vision/Mission journey sits below Overview heading and above welcome banner", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "Overview", exact: true });
  const journey = page.getByRole("navigation", { name: "Church planning and reporting journey" });
  const banner = page.locator(".welcome-banner");
  await expect(heading).toBeVisible();
  await expect(journey).toContainText("Vision / Mission");
  await expect(journey).toContainText("Report");
  const h = await heading.boundingBox();
  const j = await journey.boundingBox();
  const b = await banner.boundingBox();
  expect(h && j && b).toBeTruthy();
  expect(j!.y).toBeGreaterThan(h!.y);
  expect(j!.y + j!.height).toBeLessThan(b!.y);
  await expect(page.locator(".overview-path")).toHaveCount(1);
});

for (const [width, columns] of [[390, 2], [1280, 4], [1700, 6]] as const) {
  test(`dashboard shows ${columns} compact columns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const mobileToggle = page.getByRole("button", { name: "Toggle navigation" });
    if (await mobileToggle.isVisible()) await mobileToggle.click();
    await page.getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Dashboard", exact: true }).click();

    const cards = page.locator(".dashboard-metrics .metric");
    await expect(cards).toHaveCount(12);
    const first = await cards.nth(0).boundingBox();
    const lastInRow = await cards.nth(columns - 1).boundingBox();
    const nextRow = await cards.nth(columns).boundingBox();
    expect(first && lastInRow && nextRow).toBeTruthy();
    expect(lastInRow!.y).toBeCloseTo(first!.y, 0);
    expect(nextRow!.y).toBeGreaterThan(first!.y + 30);
    expect(first!.height).toBeLessThanOrEqual(130);
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(docWidth).toBeLessThanOrEqual(width + 1);
  });
}
