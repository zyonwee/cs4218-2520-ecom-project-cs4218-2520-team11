/**
 * E2E UI tests – Admin Category Creation
 *
 * Flow verified:
 *   Admin logs in → navigates to Manage Category → inputs a new category name
 *   → submits the form → verifies the category appears in the category table.
 *
 * Run:
 *   ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> npx playwright test tests/create-category.spec.js
 */

import { test, expect } from "@playwright/test";

// ─── Admin credentials ────────────────────────────────────────────────────────
// Override via environment variables when running against a real DB.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminpass";

// ─── Shared login helper ──────────────────────────────────────────────────────
async function loginAsAdmin(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter Your Email ").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Enter Your Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "LOGIN" }).click();
  // Wait until the home page has loaded — confirms authentication succeeded
  await page.waitForURL("/");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Admin – Create Category", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── 1. Happy path ────────────────────────────────────────────────────────
  test("creates a new category and verifies it is displayed in the category table", async ({
    page,
  }) => {
    // Use a timestamp-suffixed name so the test is idempotent across runs
    const categoryName = `Test Category ${Date.now()}`;

    // Navigate to the Manage Category admin page
    await page.goto("/dashboard/admin/create-category");
    await expect(
      page.getByRole("heading", { name: "Manage Category" })
    ).toBeVisible();

    // Input the new category name
    await page.getByPlaceholder("Enter new category").fill(categoryName);

    // Press Submit
    await page.getByRole("button", { name: "Submit" }).click();

    // Check the success toast — the controller emits "${name} is created"
    await expect(page.getByText(`${categoryName} is created`)).toBeVisible();

    // Check that the category is displayed in the table below the form
    await expect(
      page.getByRole("cell", { name: categoryName })
    ).toBeVisible();
  });

  // ── 2. Duplicate category is rejected ───────────────────────────────────
  test("submitting a duplicate category name shows 'Category Already Exists' and does not add a second row", async ({
    page,
  }) => {
    // Seed a category first, then try to create it again
    const categoryName = `Duplicate Category ${Date.now()}`;

    await page.goto("/dashboard/admin/create-category");

    // First creation — should succeed
    await page.getByPlaceholder("Enter new category").fill(categoryName);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText(`${categoryName} is created`)).toBeVisible();

    // Second creation with the same name
    await page.getByPlaceholder("Enter new category").fill(categoryName);
    await page.getByRole("button", { name: "Submit" }).click();

    // The server returns 200 with "Category Already Exists" — toast should appear
    await expect(page.getByText("Category Already Exists")).toBeVisible();

    // The table must contain exactly one row for this category name
    const rows = page.getByRole("cell", { name: categoryName });
    await expect(rows).toHaveCount(1);
  });

  // ── 3. Empty name is rejected by the server ─────────────────────────────
  test("submitting an empty category name does not create a category", async ({
    page,
  }) => {
    await page.goto("/dashboard/admin/create-category");

    // Wait for the initial GET /api/v1/category/get-category to finish so the
    // table is fully populated before we snapshot the row count.
    // Without this, countBefore is 0 (rows not yet rendered) while countAfter
    // reflects the loaded data — causing a spurious mismatch.
    await page.waitForLoadState("networkidle");
    const countBefore = await page.locator("table tbody tr").count();

    // Click Submit without filling the input
    await page.getByRole("button", { name: "Submit" }).click();

    // The server returns 401 "Name is required" — verify the error toast
    await expect(page.getByText(/name is required/i)).toBeVisible();

    // Row count must not have increased
    const countAfter = await page.locator("table tbody tr").count();
    expect(countAfter).toBe(countBefore);
  });
});
