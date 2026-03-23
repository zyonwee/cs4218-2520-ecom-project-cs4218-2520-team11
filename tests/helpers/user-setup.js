/**
 * Shared helper for E2E tests that require a regular (non-admin) user
 * with an address pre-filled — used for cart / checkout flows.
 *
 * Usage in a spec file:
 *
 *   import { setupCheckoutUser, teardownCheckoutUser } from "./helpers/user-setup.js";
 *
 *   test.beforeAll(async () => { await setupCheckoutUser(); });
 *   test.afterAll(async () => { await teardownCheckoutUser(); });
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ---------------------------------------------------------------------------
// Credentials — must match what the test types into the login form
// ---------------------------------------------------------------------------
const USER_EMAIL = process.env.CHECKOUT_USER_EMAIL || "jianyang@gmail.com";
const USER_PASSWORD = process.env.CHECKOUT_USER_PASSWORD || "abcd1234";

// ---------------------------------------------------------------------------
// Minimal schema (mirrors the app's userModel)
// ---------------------------------------------------------------------------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: {}, required: true },
    answer: { type: String, required: true },
    role: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const User = mongoose.models.users || mongoose.model("users", userSchema);

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------
let connection = null;

async function connect() {
  if (mongoose.connection.readyState === 0) {
    connection = await mongoose.connect(process.env.MONGO_URL);
  }
}

async function disconnect() {
  if (connection) {
    await mongoose.disconnect();
    connection = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates the checkout test user if they don't already exist.
 * The user gets a pre-filled address so the cart page shows the
 * "Current Address" block and the payment button is reachable.
 */
async function setupCheckoutUser() {
  await connect();

  const existing = await User.findOne({ email: USER_EMAIL });

  if (existing) {
    // Make sure the address is present — older seeds may have omitted it
    if (!existing.address || Object.keys(existing.address).length === 0) {
      await User.updateOne(
        { email: USER_EMAIL },
        { address: "123 Main St, Singapore" },
      );
    }
    await disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(USER_PASSWORD, 10);

  await User.create({
    name: "Jian Yang",
    email: USER_EMAIL,
    password: hashedPassword,
    phone: "91234567",
    // Address must be a non-empty value so CartPage renders the payment section
    address: "123 Main St, Singapore",
    answer: "test",
    role: 0, // regular user
  });

  await disconnect();
}

/**
 * Removes the checkout test user after the suite finishes.
 */
async function teardownCheckoutUser() {
  await connect();
  await User.deleteOne({ email: USER_EMAIL });
  await disconnect();
}

module.exports = { setupCheckoutUser, teardownCheckoutUser };
