/**
 * Shared helper for E2E tests that REGISTER a new user inline during the test.
 *
 * Because the test itself handles registration + login, we only need to:
 *   - teardown: delete the user so re-runs don't fail with "email already exists"
 *
 * Usage in a spec file:
 *
 *   const { teardownCartUser } = require("./helpers/cart-user-setup.js");
 *
 *   test.afterAll(async () => { await teardownCartUser(); });
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ---------------------------------------------------------------------------
// Must match exactly what the test fills into the Register form
// ---------------------------------------------------------------------------
const CART_USER_EMAIL = process.env.CART_USER_EMAIL || "test1234@gmail.com";

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
 * Deletes the user created during the test so the suite can be re-run cleanly.
 * Safe to call even if the user doesn't exist (e.g. test failed before register).
 */
async function teardownCartUser() {
  await connect();
  await User.deleteOne({ email: CART_USER_EMAIL });
  await disconnect();
}

module.exports = { teardownCartUser };
