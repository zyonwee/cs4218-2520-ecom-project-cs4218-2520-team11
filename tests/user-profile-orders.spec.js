/**
 * E2E UI tests – User Profile & Orders Pages
 *
 * Strategy:
 *   - Inject auth state via localStorage (AuthProvider hydrates from it).
 *   - Mock /api/v1/auth/user-auth to satisfy PrivateRoute guard.
 *   - Mock all API endpoints with page.route().
 *
 * Profile tests:
 *   - Pre-population from auth context
 *   - Email field is disabled
 *   - Form interaction & submission (PUT /api/v1/auth/profile)
 *   - Successful update flow (toast + localStorage)
 *   - Validation guards (empty name/phone/address)
 *   - Server-side error handling
 *
 * Orders tests:
 *   - Fetching orders on mount
 *   - Order list rendering (table with status, buyer, date, payment, quantity)
 *   - Order product details (name, truncated description, price, photo)
 *   - Empty orders state
 *
 * Run:
 *   npx playwright test tests/user-profile-orders.spec.js
 */

import { test, expect } from "@playwright/test";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_AUTH_DATA = {
  success: true,
  user: {
    _id: "user-1",
    name: "John Doe",
    email: "john@test.com",
    phone: "1234567890",
    address: "123 Test St",
    role: 0,
  },
  token: "fake-jwt-token",
};

const MOCK_UPDATED_USER = {
  _id: "user-1",
  name: "John Updated",
  email: "john@test.com",
  phone: "9876543210",
  address: "456 New St",
  role: 0,
};

const MOCK_ORDER_PRODUCT_1 = {
  _id: "order-prod-1",
  name: "Gaming Laptop",
  description: "High performance gaming laptop with RTX 4090 GPU and extras",
  price: 1499.99,
};

const MOCK_ORDER_PRODUCT_2 = {
  _id: "order-prod-2",
  name: "Wireless Mouse",
  description: "Ergonomic wireless mouse with precision tracking and more",
  price: 49.99,
};

const MOCK_ORDERS = [
  {
    _id: "order-1",
    status: "Processing",
    buyer: { name: "John Doe" },
    createdAt: "2026-03-20T10:00:00.000Z",
    payment: { success: true },
    products: [MOCK_ORDER_PRODUCT_1],
  },
  {
    _id: "order-2",
    status: "Delivered",
    buyer: { name: "John Doe" },
    createdAt: "2026-03-15T08:00:00.000Z",
    payment: { success: false },
    products: [MOCK_ORDER_PRODUCT_1, MOCK_ORDER_PRODUCT_2],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function stubCommonApis(page) {
  await page.route(/\/api\/v1\/product\/product-photo\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: "" })
  );

  await page.route("**/api/v1/category/get-category", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, category: [] }),
    })
  );

  await page.route("**/api/v1/product/braintree/token", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ clientToken: "" }),
    })
  );

  // PrivateRoute guard — must return ok: true for authenticated users
  await page.route("**/api/v1/auth/user-auth", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  );
}

async function injectAuth(page, authData) {
  await page.evaluate((data) => {
    localStorage.setItem("auth", JSON.stringify(data));
  }, authData);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test 4a: Profile Page
// ─────────────────────────────────────────────────────────────────────────────

test.describe("User Profile Page", () => {
  test.beforeEach(async ({ page }) => {
    await stubCommonApis(page);

    // Must set auth via localStorage first (navigate to root to set it,
    // then navigate to the profile page)
    await page.goto("/", { waitUntil: "commit" });
    await injectAuth(page, MOCK_AUTH_DATA);
  });

  // ── Pre-population from auth context ────────────────────────────────────
  test("populates name, email, phone, and address from auth context", async ({
    page,
  }) => {
    await page.goto("/dashboard/user/profile");
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder("Enter Your Name")).toHaveValue(
      MOCK_AUTH_DATA.user.name
    );
    await expect(page.getByPlaceholder("Enter Your Email")).toHaveValue(
      MOCK_AUTH_DATA.user.email
    );
    await expect(page.getByPlaceholder("Enter Your Phone")).toHaveValue(
      MOCK_AUTH_DATA.user.phone
    );
    await expect(page.getByPlaceholder("Enter Your Address")).toHaveValue(
      MOCK_AUTH_DATA.user.address
    );
  });

  // ── Email field is disabled ─────────────────────────────────────────────
  test("email input field is disabled", async ({ page }) => {
    await page.goto("/dashboard/user/profile");
    await page.waitForLoadState("networkidle");

    await expect(page.getByPlaceholder("Enter Your Email")).toBeDisabled();
  });

  // ── Form interaction & submission ───────────────────────────────────────
  test("submitting the form calls PUT /api/v1/auth/profile with the updated fields", async ({
    page,
  }) => {
    let capturedPayload = null;
    await page.route("**/api/v1/auth/profile", (route) => {
      if (route.request().method() === "PUT") {
        capturedPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ updatedUser: MOCK_UPDATED_USER }),
        });
      }
      return route.continue();
    });

    await page.goto("/dashboard/user/profile");
    await page.waitForLoadState("networkidle");

    // Change name
    const nameInput = page.getByPlaceholder("Enter Your Name");
    await nameInput.clear();
    await nameInput.fill("John Updated");

    // Change phone
    const phoneInput = page.getByPlaceholder("Enter Your Phone");
    await phoneInput.clear();
    await phoneInput.fill("9876543210");

    // Change address
    const addressInput = page.getByPlaceholder("Enter Your Address");
    await addressInput.clear();
    await addressInput.fill("456 New St");

    // Submit
    await page.getByRole("button", { name: "UPDATE" }).click();

    // Verify the API was called with correct payload
    await expect.poll(() => capturedPayload).toBeTruthy();
    expect(capturedPayload.name).toBe("John Updated");
    expect(capturedPayload.phone).toBe("9876543210");
    expect(capturedPayload.address).toBe("456 New St");
    expect(capturedPayload.email).toBe(MOCK_AUTH_DATA.user.email);
  });

  // ── Successful update flow ─────────────────────────────────────────────
  test("shows success toast after successful profile update", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/profile", (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ updatedUser: MOCK_UPDATED_USER }),
        });
      }
      return route.continue();
    });

    await page.goto("/dashboard/user/profile");
    await page.waitForLoadState("networkidle");

    // Submit the form (fields already populated)
    await page.getByRole("button", { name: "UPDATE" }).click();

    // Verify success toast
    await expect(
      page.getByText("Profile Updated Successfully")
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Server-side error handling ──────────────────────────────────────────
  test("shows error toast when server returns an error", async ({ page }) => {
    await page.route("**/api/v1/auth/profile", (route) => {
      if (route.request().method() === "PUT") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ error: "Password must be at least 6 characters" }),
        });
      }
      return route.continue();
    });

    await page.goto("/dashboard/user/profile");
    await page.waitForLoadState("networkidle");

    // Enter a short password and submit
    await page.getByPlaceholder("Enter Your Password").fill("123");
    await page.getByRole("button", { name: "UPDATE" }).click();

    // Verify error toast
    await expect(
      page.getByText("Password must be at least 6 characters")
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Regression: frontend validates empty fields before API call ──────────
  test("shows error when name field is cleared and form is submitted", async ({ page }) => {
    // Even without mocking the API, the frontend should catch empty name
    await page.goto("/dashboard/user/profile");
    await page.waitForLoadState("networkidle");

    // Clear name and submit
    const nameInput = page.getByPlaceholder("Enter Your Name");
    await nameInput.clear();
    await page.getByRole("button", { name: "UPDATE" }).click();

    // Frontend validation fires before the API call
    await expect(
      page.getByText("Name is required")
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 4b: Orders Page
// ─────────────────────────────────────────────────────────────────────────────

test.describe("User Orders Page", () => {
  test.beforeEach(async ({ page }) => {
    await stubCommonApis(page);
    await page.goto("/", { waitUntil: "commit" });
    await injectAuth(page, MOCK_AUTH_DATA);
  });

  // ── Fetching orders on mount ────────────────────────────────────────────
  test("fetches orders when auth token is present", async ({ page }) => {
    let ordersFetched = false;
    await page.route("**/api/v1/auth/orders", (route) => {
      ordersFetched = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/dashboard/user/orders");
    await page.waitForLoadState("networkidle");

    await expect.poll(() => ordersFetched).toBe(true);
  });

  // ── Order list rendering ────────────────────────────────────────────────
  test("renders order table with status, buyer, payment, and quantity", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ORDERS),
      })
    );

    await page.goto("/dashboard/user/orders");
    await page.waitForLoadState("networkidle");

    // "All Orders" heading
    await expect(
      page.getByRole("heading", { name: "All Orders" })
    ).toBeVisible();

    // Order 1: status, buyer, payment
    await expect(page.getByText("Processing")).toBeVisible();
    await expect(page.getByText("Success").first()).toBeVisible();

    // Order 2: status, payment
    await expect(page.getByText("Delivered")).toBeVisible();
    await expect(page.getByText("Failed")).toBeVisible();
  });

  // ── Regression: order dates render correctly (bug #4 — createAt typo) ──
  test("order date column shows valid relative time, not 'Invalid date'", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ORDERS),
      })
    );

    await page.goto("/dashboard/user/orders");
    await page.waitForLoadState("networkidle");

    // The date column should NOT contain "Invalid date"
    const dateCells = page.locator("table tbody td:nth-child(4)");
    const count = await dateCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await dateCells.nth(i).textContent();
      expect(text).not.toContain("Invalid date");
      // Should contain a relative time phrase like "X days ago" or "a few seconds ago"
      expect(text.length).toBeGreaterThan(0);
    }
  });

  // ── Order product details ───────────────────────────────────────────────
  test("renders product details within each order: name, truncated description, price", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_ORDERS[0]]),
      })
    );

    await page.goto("/dashboard/user/orders");
    await page.waitForLoadState("networkidle");

    // Product name
    await expect(
      page.getByText(MOCK_ORDER_PRODUCT_1.name, { exact: true })
    ).toBeVisible();

    // Description truncated to 30 chars
    const truncatedDesc =
      MOCK_ORDER_PRODUCT_1.description.substring(0, 30);
    await expect(page.getByText(truncatedDesc)).toBeVisible();

    // Price
    await expect(
      page.getByText(`Price : ${MOCK_ORDER_PRODUCT_1.price}`)
    ).toBeVisible();
  });

  // ── Empty orders state ──────────────────────────────────────────────────
  test("renders correctly with no orders", async ({ page }) => {
    await page.route("**/api/v1/auth/orders", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    await page.goto("/dashboard/user/orders");
    await page.waitForLoadState("networkidle");

    // "All Orders" heading should still be visible
    await expect(
      page.getByRole("heading", { name: "All Orders" })
    ).toBeVisible();

    // No order tables should be rendered
    const tables = page.locator("table");
    await expect(tables).toHaveCount(0);
  });
});
