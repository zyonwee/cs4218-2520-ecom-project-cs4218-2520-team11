/**
 * Shared helper for E2E tests that update an existing user's address.
 *
 * This test reuses the same user as the checkout flow (jianyang@gmail.com).
 * We only need to reset the address back to its original value after the
 * suite finishes, so subsequent runs start from a clean state.
 *
 * Usage in a spec file:
 *
 *   const { setupAddressUser, teardownAddressUser } = require("./helpers/address-setup.js");
 *
 *   test.beforeAll(async () => { await setupAddressUser(); });
 *   test.afterAll(async () => { await teardownAddressUser(); });
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ---------------------------------------------------------------------------
// Must match what the test types into the login form
// ---------------------------------------------------------------------------
const USER_EMAIL = process.env.CHECKOUT_USER_EMAIL || "jianyang@gmail.com";
const USER_PASSWORD = process.env.CHECKOUT_USER_PASSWORD || "abcd1234";

// The address the beforeEach resets to before each test run
const ORIGINAL_ADDRESS = "123 Main St, Singapore";

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
 * Ensures the user exists with a known address before the suite starts.
 * If the user already exists (created by user-setup.js), just makes sure
 * the address is set to the original value so beforeEach has a clean baseline.
 */
async function setupAddressUser() {
  await connect();

  const existing = await User.findOne({ email: USER_EMAIL });

  if (existing) {
    // Reset address to original in case a previous test run left it dirty
    await User.updateOne({ email: USER_EMAIL }, { address: ORIGINAL_ADDRESS });
    await disconnect();
    return;
  }

  // User doesn't exist yet — create them (mirrors user-setup.js)
  const hashedPassword = await bcrypt.hash(USER_PASSWORD, 10);
  await User.create({
    name: "Jian Yang",
    email: USER_EMAIL,
    password: hashedPassword,
    phone: "91234567",
    address: ORIGINAL_ADDRESS,
    answer: "test",
    role: 0,
  });

  await disconnect();
}

/**
 * Resets the address back to the original value after the suite finishes.
 * Does NOT delete the user — it is shared with the checkout test suite.
 */
async function teardownAddressUser() {
  await connect();
  await User.updateOne({ email: USER_EMAIL }, { address: ORIGINAL_ADDRESS });
  await disconnect();
}

module.exports = { setupAddressUser, teardownAddressUser };
