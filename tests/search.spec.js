/**
 * E2E UI tests – Search Flow (SearchInput → Search Results Page)
 *
 * Strategy:
 *   - Intercept API endpoints with page.route() and return mock data,
 *     so tests are deterministic and independent of database state.
 *   - No login required — search is a public flow.
 *
 * Flows verified:
 *   1. Typing a keyword and submitting calls the search API with the
 *      correct keyword.
 *   2. After a successful search, the app navigates to /search and
 *      renders the results page with the correct count.
 *   3. Each product card renders name, truncated description, price,
 *      image (correct src), "More Details" button, and "ADD TO CART" button.
 *   4. When the search returns no results, "No Products Found" is shown.
 *   5. The "Found X" count matches the actual number of products returned.
 *   6. Full integration: type → submit → API → context → render all work
 *      together in sequence.
 *
 * Run:
 *   npx playwright test tests/search.spec.js
 */

import { test, expect } from "@playwright/test";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCT_1 = {
  _id: "mock-search-id-1",
  name: "Gaming Laptop",
  description: "High performance gaming laptop with RTX 4090 and 32GB RAM",
  price: 1499,
};

const MOCK_PRODUCT_2 = {
  _id: "mock-search-id-2",
  name: "Wireless Mouse",
  description: "Ergonomic wireless mouse with long battery life and precision",
  price: 49,
};

const MOCK_PRODUCT_3 = {
  _id: "mock-search-id-3",
  name: "Mechanical Keyboard",
  description: "RGB mechanical keyboard with Cherry MX Blue switches for typi",
  price: 129,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Stub out product-photo requests so <img> elements resolve immediately
 * without hitting the real server (avoids network errors in the console).
 */
async function stubProductPhotos(page) {
  await page.route(/\/api\/v1\/product\/product-photo\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: "" })
  );
}

/**
 * Stub the homepage API calls so navigating to "/" loads cleanly
 * without requiring a real database connection.
 */
async function stubHomepageApis(page) {
  await page.route("**/api/v1/product/product-list/*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, products: [] }),
    })
  );

  await page.route("**/api/v1/product/product-count", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, total: 0 }),
    })
  );

  await page.route("**/api/v1/category/get-category", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, category: [] }),
    })
  );
}

/**
 * Mock the search API to return a given list of products.
 * Must be called before navigating or triggering the search.
 */
async function mockSearchApi(page, products) {
  await page.route(/\/api\/v1\/product\/search\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(products),
    })
  );
}

/**
 * Fill the search input and click the Search button.
 */
async function searchFor(page, keyword) {
  const searchInput = page.getByPlaceholder("Search");
  await searchInput.fill(keyword);
  await page.getByRole("button", { name: "Search" }).click();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Search Flow – SearchInput → Search Results Page", () => {
  test.beforeEach(async ({ page }) => {
    await stubProductPhotos(page);
    await stubHomepageApis(page);
    await page.goto("/");
    // Wait for the homepage to fully load before interacting
    await page.waitForLoadState("networkidle");
  });

  // ── 1. SearchInput interaction: API called with correct keyword ──────────
  test("typing a keyword and submitting calls the search API with the correct keyword", async ({
    page,
  }) => {
    // Set up a route handler that captures the request URL
    let capturedSearchUrl = null;
    await page.route(/\/api\/v1\/product\/search\//, (route) => {
      capturedSearchUrl = route.request().url();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await searchFor(page, "laptop");

    // Verify the API was called with the correct keyword in the URL
    await expect
      .poll(() => capturedSearchUrl)
      .toBeTruthy();
    expect(capturedSearchUrl).toContain("/api/v1/product/search/laptop");
  });

  // ── 2. Search results rendering (populated) ─────────────────────────────
  test("after a successful search, navigates to /search and renders results with correct count", async ({
    page,
  }) => {
    await mockSearchApi(page, [MOCK_PRODUCT_1, MOCK_PRODUCT_2]);

    await searchFor(page, "laptop");

    // Should navigate to the /search page
    await page.waitForURL("**/search");

    // "Search Results" heading should be visible
    await expect(
      page.getByRole("heading", { name: "Search Results" })
    ).toBeVisible();

    // Should display the correct count
    await expect(page.getByText("Found 2")).toBeVisible();
  });

  // ── 3. Product card details ──────────────────────────────────────────────
  test("each product card renders name, truncated description, price, image, and buttons", async ({
    page,
  }) => {
    await mockSearchApi(page, [MOCK_PRODUCT_1]);

    await searchFor(page, "gaming");
    await page.waitForURL("**/search");

    // Product name (use heading role to avoid matching the truncated description)
    await expect(
      page.getByRole("heading", { name: MOCK_PRODUCT_1.name })
    ).toBeVisible();

    // Description truncated to 30 chars + "..."
    const truncatedDesc =
      MOCK_PRODUCT_1.description.substring(0, 30) + "...";
    await expect(page.getByText(truncatedDesc)).toBeVisible();

    // Price with $ prefix
    await expect(
      page.getByText(`$ ${MOCK_PRODUCT_1.price}`)
    ).toBeVisible();

    // Image with correct src
    const img = page.getByRole("img", { name: MOCK_PRODUCT_1.name });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute(
      "src",
      `/api/v1/product/product-photo/${MOCK_PRODUCT_1._id}`
    );

    // "More Details" button
    await expect(
      page.getByRole("button", { name: "More Details" })
    ).toBeVisible();

    // "ADD TO CART" button
    await expect(
      page.getByRole("button", { name: "ADD TO CART" })
    ).toBeVisible();
  });

  // ── 4. Search results rendering (empty) ─────────────────────────────────
  test('displays "No Products Found" when search returns empty results', async ({
    page,
  }) => {
    await mockSearchApi(page, []);

    await searchFor(page, "nonexistent");
    await page.waitForURL("**/search");

    // "No Products Found" text should be visible
    await expect(page.getByText("No Products Found")).toBeVisible();

    // No product cards should be rendered
    const cards = page.locator(".card");
    await expect(cards).toHaveCount(0);
  });

  // ── 5. Result count matches actual products ─────────────────────────────
  test("result count text matches the actual number of product cards rendered", async ({
    page,
  }) => {
    await mockSearchApi(page, [
      MOCK_PRODUCT_1,
      MOCK_PRODUCT_2,
      MOCK_PRODUCT_3,
    ]);

    await searchFor(page, "electronics");
    await page.waitForURL("**/search");

    // Count text should say "Found 3"
    await expect(page.getByText("Found 3")).toBeVisible();

    // Exactly 3 product cards should be rendered
    const cards = page.locator(".card");
    await expect(cards).toHaveCount(3);
  });

  // ── 6. Full integration: type → submit → API → context → render ─────────
  test("full integration flow: type, submit, API response populates search results page", async ({
    page,
  }) => {
    await mockSearchApi(page, [MOCK_PRODUCT_1, MOCK_PRODUCT_2]);

    // Type character by character to verify the controlled input works
    const searchInput = page.getByPlaceholder("Search");
    await searchInput.click();
    await searchInput.pressSequentially("laptop", { delay: 50 });

    // Submit the form
    await page.getByRole("button", { name: "Search" }).click();

    // Should navigate to /search
    await page.waitForURL("**/search");

    // Both products should be rendered (use heading role to avoid strict mode violation)
    await expect(
      page.getByRole("heading", { name: MOCK_PRODUCT_1.name })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: MOCK_PRODUCT_2.name })
    ).toBeVisible();

    // Correct count displayed
    await expect(page.getByText("Found 2")).toBeVisible();

    // Both product cards present
    const cards = page.locator(".card");
    await expect(cards).toHaveCount(2);
  });
});
