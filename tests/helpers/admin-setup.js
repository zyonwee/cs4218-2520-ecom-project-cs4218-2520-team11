/**
 * Shared helper for E2E tests that require an admin user.
 *
 * Usage in a spec file:
 *
 *   import { setupAdminUser, teardownAdminUser } from "./helpers/admin-setup.js";
 *
 *   test.beforeAll(async () => {
 *     await setupAdminUser();
 *     await setupTestUser(); // for loginAsUser specs (optional)
 *   });
 *   test.afterAll(async () => {
 *     await teardownTestUser();
 *     await teardownAdminUser();
 *   });
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "adminpass";
const USER_EMAIL = process.env.USER_EMAIL || "user@example.com";
const USER_PASSWORD = process.env.USER_PASSWORD || "userpass";

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
  { timestamps: true }
);

const User =
  mongoose.models.users || mongoose.model("users", userSchema);

let connection = null;
/** True only if this process created the E2E test user (safe teardown). */
let testUserCreatedBySetup = false;

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

async function setupAdminUser() {
  await connect();

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== 1) {
      await User.updateOne({ email: ADMIN_EMAIL }, { role: 1 });
    }
    await disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await User.create({
    name: "Test Admin",
    email: ADMIN_EMAIL,
    password: hashedPassword,
    phone: "00000000",
    address: "Test Address",
    answer: "test",
    role: 1,
  });

  await disconnect();
}

/** Ensures a non-admin user exists for specs that call loginAsUser (e.g. orders user tests). */
async function setupTestUser() {
  await connect();

  const existing = await User.findOne({ email: USER_EMAIL });
  if (existing) {
    await disconnect();
    return;
  }

  testUserCreatedBySetup = true;
  const hashedPassword = await bcrypt.hash(USER_PASSWORD, 10);
  await User.create({
    name: "Test User",
    email: USER_EMAIL,
    password: hashedPassword,
    phone: "00000001",
    address: "Test User Address",
    answer: "test",
    role: 0,
  });

  await disconnect();
}

async function teardownAdminUser() {
  await connect();
  await User.deleteOne({ email: ADMIN_EMAIL });
  await disconnect();
}

async function teardownTestUser() {
  if (!testUserCreatedBySetup) return;
  await connect();
  await User.deleteOne({ email: USER_EMAIL });
  await disconnect();
}

module.exports = {
  setupAdminUser,
  teardownAdminUser,
  setupTestUser,
  teardownTestUser,
};
