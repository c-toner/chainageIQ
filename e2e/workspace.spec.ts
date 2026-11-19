import { test, expect } from "@playwright/test";
async function nav(page: import("@playwright/test").Page, name: string) {
  await expect(page.locator(".map-chainage").first()).toBeVisible();
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test("setup is honest about persistence", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Connect your Supabase project" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore the demonstration" }).click();
  await expect(
    page.getByRole("heading", { name: "Project overview" }),
  ).toBeVisible();
});
test("demo register filters and opens detail without fake writes", async ({
  page,
}) => {
  await page.goto("/demo");
  await nav(page, "Issues & Defects 8");
  await page.getByLabel("Filter severity").selectOption("Critical");
  await expect(page.getByText("2 records")).toBeVisible();
  await page
    .getByRole("button", { name: "CIQ-1043", exact: false })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "New issue" }).click();
  await expect(page.getByRole("status")).toContainText(
    "read-only demonstration",
  );
});
test("timeline markers open the same records", async ({ page }) => {
  await page.goto("/demo");
  await nav(page, "Chainage Timeline");
  await page.getByRole("button", { name: "CIQ-1042 at CH 3+450" }).click();
  await expect(
    page.getByRole("heading", { name: "Pavement cracking at tie-in" }),
  ).toBeVisible();
});
test("unauthenticated API cannot read data", async ({ request }) => {
  const response = await request.get("/api/issues");
  expect(response.ok()).toBe(false);
  expect(await response.text()).not.toContain("Pavement cracking");
});

test("geographic map worker loads and displays alignment endpoints", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await expect(page.locator(".map-chainage").first()).toBeVisible();
  await expect(page.locator(".map-error")).toHaveCount(0);
  expect(errors).toEqual([]);
});
