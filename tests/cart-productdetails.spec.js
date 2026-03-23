import { test, expect } from "@playwright/test";
const {
  setupAddressUser,
  teardownAddressUser,
} = require("./helpers/address-setup.js");
const { teardownCartUser } = require("./helpers/cart-setup.js");
const {
  setupCheckoutUser,
  teardownCheckoutUser,
} = require("./helpers/user-setup.js");

test.describe("UI | Product Page — Add to Cart Visual Feedback", () => {
  test.beforeAll(async () => {
    await setupCheckoutUser(); // ensures jianyang@gmail.com exists with address
  });
  test.afterAll(async () => {
    await teardownCheckoutUser(); // cleans up jianyang@gmail.com after suite
  });

  test("Product Page: E2E Scenario : User clicks add to cart twice on accident and goes to cart to remove one and proceeds to checkout.. ", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");
    await page.getByRole("button", { name: "More Details" }).nth(1).click();

    await page.getByRole("button", { name: "ADD TO CART" }).click();
    await expect(page.getByText("Loading...")).toBeVisible();

    await expect(page.getByText("Loading...")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Item Added to cart")).toBeVisible();
    await expect(
      page.locator(".ant-badge-count").getByText("1").first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "ADD TO CART" }).click();
    await expect(page.getByText("Loading...")).toBeVisible();

    await expect(page.getByText("Loading...")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.locator(".ant-badge-count").getByText("2").first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Cart" }).click();
    await page.getByRole("button", { name: "Remove" }).first().click();
    await expect(
      page.locator(".ant-badge-count").getByText("1").first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Cart" }).click();
    await page
      .getByRole("button", { name: "Please Login to checkout" })
      .click();
    await page.getByRole("textbox", { name: "Enter Your Email" }).click();
    await page.getByRole("textbox", { name: "Enter Your Email" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Email" })
      .fill("jianyang@gmail.com");
    await page.getByRole("textbox", { name: "Enter Your Password" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Password" })
      .fill("abcd1234");
    await page.getByRole("button", { name: "LOGIN" }).click();
    await page.getByRole("button", { name: "Paying with Card" }).click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .fill("4111 1111 1111 1111");
    await page
      .locator('iframe[name="braintree-hosted-field-expirationDate"]')
      .contentFrame()
      .getByRole("textbox", { name: "Expiration Date" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-expirationDate"]')
      .contentFrame()
      .getByRole("textbox", { name: "Expiration Date" })
      .fill("1227");
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .click();
    await page.locator("label").filter({ hasText: "CVV (3 digits)" }).click();
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .fill("123");
    await page.getByRole("button", { name: "Make Payment" }).click();

    await expect(
      page.getByRole("cell", { name: "Success" }).first(),
    ).toBeVisible();
  });
});

test.describe("UI | Cart Page ", () => {
  test.afterAll(async () => {
    await teardownCartUser(); // deletes test1234@gmail.com so re-runs can re-register
  });

  test("E2E: New User Adding multiple items to the cart and each increment shows right value. ", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");
    await page.getByRole("link", { name: "Register" }).click();
    await page.getByRole("textbox", { name: "Enter Your Name" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Name" })
      .fill("Gabriel");
    await page.getByRole("textbox", { name: "Enter Your Email" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Email" })
      .fill("test1234@gmail.com");
    await page.getByRole("textbox", { name: "Enter Your Password" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Password" })
      .fill("abcd1234");
    await page.getByRole("textbox", { name: "Enter Your Phone" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Phone" })
      .fill("93298995");
    await page.getByRole("textbox", { name: "Enter Your Address" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Address" })
      .fill("50 FairView Drive");
    await page.getByPlaceholder("Enter Your DOB").fill("2001-12-06");
    await page
      .getByRole("textbox", { name: "What is Your Favorite sports" })
      .click();
    await page
      .getByRole("textbox", { name: "What is Your Favorite sports" })
      .fill("rugby");
    await page.getByRole("button", { name: "REGISTER" }).click();
    await page.getByRole("link", { name: "Login" }).click();
    await page.getByRole("textbox", { name: "Enter Your Email" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Email" })
      .fill("test1234@gmail.com");
    await page.getByRole("textbox", { name: "Enter Your Password" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Password" })
      .fill("abcd1234");
    await page.getByRole("button", { name: "LOGIN" }).click();
    await page.getByRole("button", { name: "ADD TO CART" }).nth(1).click();
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page.getByRole("heading", { name: /total/i })).toContainText(
      "$14.99",
    );
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByRole("button", { name: "ADD TO CART" }).nth(2).click();
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page.getByRole("heading", { name: /total/i })).toContainText(
      "$19.98",
    );
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByRole("button", { name: "ADD TO CART" }).nth(3).click();
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page.getByRole("heading", { name: /total/i })).toContainText(
      "$1,019.97",
    );
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByRole("button", { name: "ADD TO CART" }).nth(4).click();
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page.getByRole("heading", { name: /total/i })).toContainText(
      "$1,099.96",
    );
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByRole("button", { name: "ADD TO CART" }).nth(5).click();
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page.getByRole("heading", { name: /total/i })).toContainText(
      "$1,154.95",
    );
    await page.getByRole("button", { name: "Paying with Card" }).click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .fill("4111111111111111");
    await page
      .locator('iframe[name="braintree-hosted-field-expirationDate"]')
      .contentFrame()
      .getByRole("textbox", { name: "Expiration Date" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-expirationDate"]')
      .contentFrame()
      .getByRole("textbox", { name: "Expiration Date" })
      .fill("1228");
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .fill("123");
    await page.getByRole("button", { name: "Make Payment" }).click();
    await expect(
      page.getByRole("cell", { name: "Success" }).first(),
    ).toBeVisible();
  });
});

test.describe("UI | Changing Address ", () => {
  test.setTimeout(60000);
  test.beforeAll(async () => {
    await setupAddressUser(); // ensures jianyang@gmail.com exists with clean address
  });
  test.afterAll(async () => {
    await teardownAddressUser(); // resets address back to original (does NOT delete user)
  });
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await page.getByRole("link", { name: "Login" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Email" })
      .fill("jianyang@gmail.com");
    await page
      .getByRole("textbox", { name: "Enter Your Password" })
      .fill("abcd1234");
    await page.getByRole("button", { name: "LOGIN" }).click();

    // ✅ Wait for login to fully complete before doing anything else
    await page.waitForURL("http://localhost:3000/");

    await page.getByRole("link", { name: "Cart" }).click();

    // ✅ Wait for Cart page to load before looking for the button
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Update Address" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Address" })
      .fill("Old Address");
    await page.getByRole("button", { name: "UPDATE" }).click();
    await expect(page.getByText(/updated successfully/i)).toBeVisible({
      timeout: 10000,
    });
    await page.goto("http://localhost:3000/");
  });
  test("E2E: Existing User updating his address and processing an order. (also shows out of stock if quantity left is insufficient)  ", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Home" }).click();
    await page.getByRole("button", { name: "ADD TO CART" }).first().click();
    await expect(page.getByText("More DetailsOUT OF STOCK")).toBeVisible();
    await page.getByRole("link", { name: "Cart" }).click();

    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "debug-chromium-cart.png" });
    await expect(page.getByText("Old Address")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Update Address" }).click();
    await page.getByRole("textbox", { name: "Enter Your Address" }).click();
    await page
      .getByRole("textbox", { name: "Enter Your Address" })
      .fill("New Address");
    await page.getByRole("button", { name: "UPDATE" }).click();
    await page.getByRole("link", { name: "Cart" }).click();
    await expect(page.getByText("New Address")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Paying with Card" }).click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-number"]')
      .contentFrame()
      .getByRole("textbox", { name: "Credit Card Number" })
      .fill("4111111111111111");
    await page
      .locator('iframe[name="braintree-hosted-field-expirationDate"]')
      .contentFrame()
      .getByRole("textbox", { name: "Expiration Date" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-expirationDate"]')
      .contentFrame()
      .getByRole("textbox", { name: "Expiration Date" })
      .fill("1228");
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .click();
    await page
      .locator('iframe[name="braintree-hosted-field-cvv"]')
      .contentFrame()
      .getByRole("textbox", { name: "CVV" })
      .fill("123");
    await page.getByRole("button", { name: "Make Payment" }).click();
    await expect(
      page.getByRole("cell", { name: "Success" }).first(),
    ).toBeVisible();
  });
});
