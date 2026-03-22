/**
 * E2E UI tests – Admin Product Creation (with Category)
 *
 * Full user journey verified:
 *   1. Admin logs in
 *   2. Creates a brand-new category via the Manage Category page
 *      → verifies it appears in the category table
 *   3. Navigates to Create Product
 *      → selects the new category, uploads a photo, fills in all fields
 *      → submits the form
 *   4. Verifies the product appears on the admin "All Products List" page
 *   5. Navigates to the public Product Details page via the admin card link
 *      → verifies the product name, description, price (USD), and category
 *        are all displayed correctly
 *
 * Run:
 *   ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> npx playwright test tests/create-product.spec.js
 */

import { test, expect } from "@playwright/test";

// ─── Admin credentials ────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminpass";

// ─── Minimal 1×1 white PNG used as the test photo ────────────────────────────
// Generated with: python3 -c "import base64; ..."
// A real PNG header so the server's MIME check passes.
const TEST_IMAGE_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAdmin(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter Your Email ").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Enter Your Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "LOGIN" }).click();
  await page.waitForURL("/");
}

/**
 * Open an Ant Design <Select> (identified by its placeholder text) and pick
 * the option whose label matches `optionText`.
 *
 * Ant Design renders the dropdown in a portal at the document body level, so
 * we wait for the dropdown to become visible before clicking the option.
 */
async function selectAntOption(page, placeholderText, optionText) {
  // Locate the specific Select widget by its placeholder text
  const selectEl = page.locator(".ant-select", {
    has: page.locator(".ant-select-selection-placeholder", {
      hasText: placeholderText,
    }),
  });

  // Click to open the dropdown
  await selectEl.click();

  // With showSearch enabled the search input is now active.
  // Typing the option text filters the list, guaranteeing the target option
  // is rendered in the DOM regardless of virtual-scroll or load timing.
  await selectEl.locator("input").fill(optionText);

  // Click the (now-filtered) option
  await page
    .locator(".ant-select-item-option-content", { hasText: optionText })
    .click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Admin – Create Product with Category", () => {
  // ── Full happy-path e2e journey ─────────────────────────────────────────
  test("admin creates a category, creates a product assigned to that category, and verifies the product details are displayed correctly", async ({
    page,
  }) => {
    const ts = Date.now();
    const categoryName = `Electronics ${ts}`;
    const productName = `Galaxy Test Phone ${ts}`;
    const description = "A powerful test smartphone for e2e testing";
    const price = "999";
    const quantity = "15";

    // ── Step 1: Login ──────────────────────────────────────────────────────
    await loginAsAdmin(page);

    // ── Step 2: Create a new category ─────────────────────────────────────
    await page.goto("/dashboard/admin/create-category");
    await expect(
      page.getByRole("heading", { name: "Manage Category" })
    ).toBeVisible();

    // Input new category name and submit
    await page.getByPlaceholder("Enter new category").fill(categoryName);
    await page.getByRole("button", { name: "Submit" }).click();

    // Verify success toast
    await expect(
      page.getByText(`${categoryName} is created`)
    ).toBeVisible();

    // Verify the category is displayed in the category table
    await expect(
      page.getByRole("cell", { name: categoryName })
    ).toBeVisible();

    // ── Step 3: Navigate to Create Product page ────────────────────────────
    await page.goto("/dashboard/admin/create-product");
    await expect(
      page.getByRole("heading", { name: "Create Product" })
    ).toBeVisible();
    // waitForLoadState("networkidle") waits until there are no in-flight
    // requests for 500 ms — this reliably covers the getAllCategory() fetch
    // that fires on mount and populates the category Select's option list.
    // waitForResponse() was unreliable here because the previous page's own
    // getAllCategory re-fetch (after category creation) resolved the promise
    // before the create-product page's fetch even started.
    await page.waitForLoadState("networkidle");

    // ── Step 4: Select the newly created category ──────────────────────────
    await selectAntOption(page, "Select a category", categoryName);

    // Confirm the category is now selected (placeholder is replaced by name)
    await expect(
      page.locator(".ant-select-selection-item", { hasText: categoryName })
    ).toBeVisible();

    // ── Step 5: Upload a photo ─────────────────────────────────────────────
    await page.locator('input[name="photo"]').setInputFiles({
      name: "test-product.png",
      mimeType: "image/png",
      buffer: TEST_IMAGE_BUFFER,
    });

    // The label text changes from "Upload Photo" to the filename
    await expect(
      page.locator("label.btn-outline-secondary")
    ).toContainText("test-product.png");

    // ── Step 6: Fill in product details ────────────────────────────────────
    await page.getByPlaceholder("write a name").fill(productName);
    await page.getByPlaceholder("write a description").fill(description);
    await page.getByPlaceholder("write a Price").fill(price);
    await page.getByPlaceholder("write a quantity").fill(quantity);

    // ── Step 7: Select shipping option ─────────────────────────────────────
    await selectAntOption(page, "Select Shipping", "Yes");

    // ── Step 8: Submit the product form ────────────────────────────────────
    await page.getByRole("button", { name: "CREATE PRODUCT" }).click();

    // ── Step 9: Verify redirect to admin products list ─────────────────────
    await page.waitForURL("/dashboard/admin/products");
    await expect(
      page.getByRole("heading", { name: "All Products List" })
    ).toBeVisible();

    // The new product card must be visible in the list
    await expect(page.locator(".card-title", { hasText: productName })).toBeVisible();

    // ── Step 10: Navigate to the public Product Details page ───────────────
    // Click the product card — the admin app links to /dashboard/admin/product/:slug
    await page.locator("a.product-link", { hasText: productName }).click();

    // Extract the slug from the admin update URL (/dashboard/admin/product/:slug)
    await page.waitForURL(/\/dashboard\/admin\/product\//);
    const adminUrl = page.url();
    const slug = adminUrl.split("/").pop();

    // Navigate to the public-facing product detail page
    await page.goto(`/product/${slug}`);
    await expect(
      page.getByRole("heading", { name: "Product Details" })
    ).toBeVisible();

    // ── Step 11: Verify all product information ────────────────────────────
    await expect(page.getByText(`Name : ${productName}`)).toBeVisible();
    await expect(
      page.getByText(`Description : ${description}`)
    ).toBeVisible();
    // Price is displayed as US currency (e.g. $999.00)
    await expect(page.getByText("$999.00")).toBeVisible();
    // Category name must match the one created in step 2
    await expect(
      page.getByText(`Category : ${categoryName}`)
    ).toBeVisible();
  });

  // ── Missing required fields prevent creation ────────────────────────────
  test("submitting the product form without filling required fields does not create a product", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/admin/create-product");
    await expect(
      page.getByRole("heading", { name: "Create Product" })
    ).toBeVisible();

    // Click CREATE PRODUCT without filling any field
    await page.getByRole("button", { name: "CREATE PRODUCT" }).click();

    // The catch block in handleCreate emits toast.error("something went wrong")
    await expect(page.getByText("something went wrong")).toBeVisible();

    // No redirect to the products list
    await expect(page).not.toHaveURL(/\/dashboard\/admin\/products$/);
  });
});
