import { expect, test } from "@playwright/test";

// Guard against the iPhone/Safari horizontal page overflow that previously
// pushed the Export button beyond the viewport. Large tables may still scroll
// inside .table-scroll, which is intentional.
for (const width of [320, 375, 390, 430, 768]) {
  test(`dashboard fits ${width}px mobile/tablet viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".topbar")).toBeVisible();

    const toggle = page.getByRole("button", { name: "Toggle navigation" });
    await toggle.click();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Dashboard", exact: true })
      .click();

    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const exportButton = document.querySelector(".download-button")!;
      const rect = exportButton.getBoundingClientRect();
      return {
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        exportLeft: rect.left,
        exportRight: rect.right,
      };
    });
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
    expect(overflow.exportLeft).toBeGreaterThanOrEqual(0);
    expect(overflow.exportRight).toBeLessThanOrEqual(overflow.viewport + 1);

    // Last-column filter menus must remain inside the phone viewport.
    await page.locator(".filter-button").last().click();
    await expect(page.locator(".filter-popover")).toBeVisible();
    const popover = await page.locator(".filter-popover").boundingBox();
    expect(popover).not.toBeNull();
    expect(popover!.x).toBeGreaterThanOrEqual(0);
    expect(popover!.x + popover!.width).toBeLessThanOrEqual(width + 1);
  });
}
