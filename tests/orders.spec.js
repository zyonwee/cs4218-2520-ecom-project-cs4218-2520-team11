/**
 * E2E UI tests – Order Management (User & Admin)
 *
 * Strategy:
 *   - Login against the real server so authentication flows work correctly.
 *   - Intercept the orders API endpoints with page.route() and return mock
 *     data, so tests are independent of the real database state.
 *
 * Flows verified:
 *   User Orders:
 *     1. User logs in → navigates to /dashboard/user/orders → mock API
 *        returns one order → verifies all order fields are displayed correctly
 *        (status, buyer, payment, quantity, product name, price, description)
 *     2. Mock returns an empty array → verifies no order rows are rendered
 *
 *   Admin Orders:
 *     3. Admin logs in → navigates to /dashboard/admin/orders → mock API
 *        returns two orders → verifies both orders are displayed with the
 *        correct buyer names, payment status, and product details
 *     4. Admin changes an order's status via the dropdown → verifies the
 *        correct PUT request is sent to /api/v1/auth/order-status/:id
 *
 * Run:
 *   ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password>
 *   USER_EMAIL=<email>  USER_PASSWORD=<password>
 *   npx playwright test tests/orders.spec.js
 */

import { test, expect } from "@playwright/test";
import {
  setupAdminUser,
  setupTestUser,
  teardownAdminUser,
  teardownTestUser,
} from "./helpers/admin-setup.js";

// ─── Credentials ──────────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminpass";
const USER_EMAIL = process.env.USER_EMAIL || "user@example.com";
const USER_PASSWORD = process.env.USER_PASSWORD || "userpass";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PRODUCT_1 = {
  _id: "mock-product-id-1",
  name: "Wireless Headphones",
  description: "Premium noise-cancelling headphones with 30h battery life",
  price: 299,
};

const MOCK_PRODUCT_2 = {
  _id: "mock-product-id-2",
  name: "Mechanical Keyboard",
  description: "Compact TKL keyboard with Cherry MX switches",
  price: 149,
};

const MOCK_ORDER_USER = {
  _id: "mock-order-id-1",
  products: [MOCK_PRODUCT_1],
  payment: { success: true },
  buyer: { name: "Alice" },
  status: "Processing",
  createdAt: new Date().toISOString(),
};

const MOCK_ORDER_ADMIN_1 = {
  _id: "mock-order-id-2",
  products: [MOCK_PRODUCT_1, MOCK_PRODUCT_2],
  payment: { success: true },
  buyer: { name: "Bob" },
  status: "Not Process",
  createdAt: new Date().toISOString(),
};

const MOCK_ORDER_ADMIN_2 = {
  _id: "mock-order-id-3",
  products: [MOCK_PRODUCT_2],
  payment: { success: false },
  buyer: { name: "Carol" },
  status: "Shipped",
  createdAt: new Date().toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAdmin(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter Your Email ").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Enter Your Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "LOGIN" }).click();
  await page.waitForURL("/");
}

async function loginAsUser(page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter Your Email ").fill(USER_EMAIL);
  await page.getByPlaceholder("Enter Your Password").fill(USER_PASSWORD);
  await page.getByRole("button", { name: "LOGIN" }).click();
  await page.waitForURL("/");
}

/**
 * Intercept a GET endpoint and return mock JSON.
 * Must be called before the page navigation that triggers the request.
 */
async function mockGetOrders(page, url, payload) {
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    })
  );
}

/**
 * Stub out product-photo requests so <img> elements resolve immediately
 * without hitting the real server (avoids network errors in the console).
 */
async function stubProductPhotos(page) {
  await page.route(/\/api\/v1\/product\/product-photo\//, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: "" })
  );
}

// ─── Admin user lifecycle ─────────────────────────────────────────────────────
test.beforeAll(async () => {
  await setupAdminUser();
  await setupTestUser();
});

test.afterAll(async () => {
  await teardownTestUser();
  await teardownAdminUser();
});

// ─────────────────────────────────────────────────────────────────────────────
// User Orders
// ─────────────────────────────────────────────────────────────────────────────

test.describe("User – Orders page", () => {
  // Julius Bryan Reynon Gambe A0252251R
  test("displays order fields correctly when the API returns one order", async ({
    page,
  }) => {
    await loginAsUser(page);

    // Set up mocks before navigating to the orders page
    await mockGetOrders(page, "/api/v1/auth/orders", [MOCK_ORDER_USER]);
    await stubProductPhotos(page);

    await page.goto("/dashboard/user/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // ── Order summary row ──────────────────────────────────────────────────
    // Row number: first <td> in the first body row
    await expect(
      page.locator("table tbody tr td:first-child")
    ).toHaveText("1");

    // Status displayed as plain text (user view has no dropdown)
    await expect(
      page.getByRole("cell", { name: MOCK_ORDER_USER.status })
    ).toBeVisible();

    // Buyer name
    await expect(
      page.getByRole("cell", { name: MOCK_ORDER_USER.buyer.name })
    ).toBeVisible();

    // Payment: successful order shows "Success"
    await expect(page.getByRole("cell", { name: "Success" })).toBeVisible();

    // Quantity: last <td> in the row (Quantity column)
    await expect(
      page.locator("table tbody tr td:last-child")
    ).toHaveText(String(MOCK_ORDER_USER.products.length));

    // ── Product card below the table ──────────────────────────────────────
    await expect(page.getByText(MOCK_PRODUCT_1.name)).toBeVisible();
    // Description is truncated to 30 chars
    await expect(
      page.getByText(MOCK_PRODUCT_1.description.substring(0, 30))
    ).toBeVisible();
    await expect(
      page.getByText(`Price : ${MOCK_PRODUCT_1.price}`)
    ).toBeVisible();
  });

  // Julius Bryan Reynon Gambe A0252251R
  test("shows no order rows when the API returns an empty array", async ({
    page,
  }) => {
    await loginAsUser(page);

    await mockGetOrders(page, "/api/v1/auth/orders", []);

    await page.goto("/dashboard/user/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // No table rows should exist when there are no orders
    await expect(page.locator("table tbody tr")).toHaveCount(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin Orders
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Admin – Orders page", () => {
  // Julius Bryan Reynon Gambe A0252251R
  test("displays all orders with buyer names, payment status, and product details", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await mockGetOrders(page, "/api/v1/auth/all-orders", [
      MOCK_ORDER_ADMIN_1,
      MOCK_ORDER_ADMIN_2,
    ]);
    await stubProductPhotos(page);

    await page.goto("/dashboard/admin/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // ── First order (Bob, 2 products, payment success) ────────────────────
    // Each order renders its own <table>; grab the first one
    const firstOrderTable = page.locator("table").first();
    await expect(
      firstOrderTable.getByRole("cell", { name: MOCK_ORDER_ADMIN_1.buyer.name })
    ).toBeVisible();
    // Payment: success → "Success"
    await expect(
      firstOrderTable.getByRole("cell", { name: "Success" })
    ).toBeVisible();
    // Quantity: last <td> in the first order's body row
    await expect(
      firstOrderTable.locator("tbody tr td:last-child")
    ).toHaveText(String(MOCK_ORDER_ADMIN_1.products.length));
    // Product cards for order 1
    await expect(page.getByText(MOCK_PRODUCT_1.name).first()).toBeVisible();
    await expect(page.getByText(MOCK_PRODUCT_2.name).first()).toBeVisible();

    // ── Second order (Carol, 1 product, payment failed) ───────────────────
    await expect(
      page.getByRole("cell", { name: MOCK_ORDER_ADMIN_2.buyer.name })
    ).toBeVisible();
    await expect(page.getByRole("cell", { name: "Failed" })).toBeVisible();

    // ── Both orders display a status dropdown ─────────────────────────────
    // Ant Design renders the selected value in .ant-select-selection-item
    const statusSelects = page.locator(".ant-select-selection-item");
    await expect(statusSelects).toHaveCount(2);
  });

  // Julius Bryan Reynon Gambe A0252251R
  test("admin can change an order status and the correct PUT request is sent", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    // Start with one order in "Not Process" status
    await mockGetOrders(page, "/api/v1/auth/all-orders", [MOCK_ORDER_ADMIN_1]);
    await stubProductPhotos(page);

    // Track the PUT call for status update
    let capturedStatusRequest = null;
    await page.route(
      `/api/v1/auth/order-status/${MOCK_ORDER_ADMIN_1._id}`,
      async (route) => {
        capturedStatusRequest = JSON.parse(route.request().postData());
        // After the update, the UI re-fetches all orders — return the updated order
        await page.unroute("/api/v1/auth/all-orders");
        await mockGetOrders(page, "/api/v1/auth/all-orders", [
          { ...MOCK_ORDER_ADMIN_1, status: "Shipped" },
        ]);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...MOCK_ORDER_ADMIN_1, status: "Shipped" }),
        });
      }
    );

    await page.goto("/dashboard/admin/orders");
    await expect(page.getByRole("heading", { name: "All Orders" })).toBeVisible();

    // The current status is "Not Process" — open the Ant Design select dropdown
    const statusSelect = page.locator(".ant-select").first();
    await statusSelect.click();

    // Click the "Shipped" option in the dropdown portal
    await page
      .locator(".ant-select-item-option-content", { hasText: "Shipped" })
      .click();

    // Verify the PUT body sent to the server contained the new status
    await expect
      .poll(() => capturedStatusRequest)
      .toMatchObject({ status: "Shipped" });

    // After re-fetch, the displayed status should reflect "Shipped"
    await expect(
      page.locator(".ant-select-selection-item", { hasText: "Shipped" })
    ).toBeVisible();
  });
});
