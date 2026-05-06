import { expect, test } from "@playwright/test";

test("home page loads with Vellum branding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
