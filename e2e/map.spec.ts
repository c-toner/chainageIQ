import { test, expect, type Page } from "@playwright/test";
// Deterministic network fixtures keep CI independent of a public provider's availability.
// A separate live-browser check verifies actual imagery, colours and roads.
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAACwElEQVR4nO3TMQ0AMAzAsKLbPSTjfw5Gj1gygDyZ8y5kzXoBLDIAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANIMQJoBSDMAaQYgzQCkGYA0A5BmANI+9dUPPSU9QWAAAAAASUVORK5CYII=",
  "base64",
);
const tileRoute =
  /https:\/\/(portal\.spatial\.nsw\.gov\.au|maps\.six\.nsw\.gov\.au)\/.*\/tile\//;
async function ready(page: Page) {
  await expect(page.locator(".map-wrap")).toHaveAttribute(
    "data-map-state",
    "ready",
    { timeout: 15000 },
  );
  await expect(page.locator(".map-chainage").first()).toBeVisible();
}
// Compare map-relative positions: mobile button clicks may scroll the page.
async function endpointPosition(page: Page) {
  const marker = await page.locator(".map-chainage").first().boundingBox();
  const map = await page.locator(".map-wrap").boundingBox();
  return { x: marker!.x - map!.x, y: marker!.y - map!.y };
}
test("satellite loads by default and street switching retains camera and overlays", async ({
  page,
}) => {
  await page.route(tileRoute, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tile,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("/demo");
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Satellite", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const before = await endpointPosition(page);
  await page.getByRole("button", { name: "Street", exact: true }).click();
  await ready(page);
  const after = await endpointPosition(page);
  expect(Math.abs(before!.x - after!.x)).toBeLessThan(2);
  expect(Math.abs(before!.y - after!.y)).toBeLessThan(2);
  await expect(
    page.getByRole("button", { name: "Street", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Satellite", exact: true }).click();
  await ready(page);
  await expect(page.locator(".map-chainage")).toHaveCount(2);
  await expect(
    page.getByRole("link", { name: "NSW Spatial Services", exact: true }),
  ).toBeVisible();
});
test("tile failures are visible and retry recovers without losing overlays", async ({
  page,
}) => {
  await page.route(tileRoute, (route) => route.abort("failed"));
  await page.goto("/demo");
  await expect(page.locator(".map-error")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".map-wrap")).toHaveAttribute(
    "data-map-state",
    "error",
  );
  await page.unroute(tileRoute);
  await page.route(tileRoute, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: tile,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.getByRole("button", { name: "Retry map" }).click();
  await ready(page);
  await expect(page.locator(".map-error")).toHaveCount(0);
});
