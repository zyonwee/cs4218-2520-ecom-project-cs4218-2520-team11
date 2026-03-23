/**
 * Integration tests for updateProfileController (bottom-up)
 *
 * Antony Swami Alfred Ben, A0253016R
 *
 * Real components under test:
 *   1. updateProfileController — from authController.js
 *   2. requireSignIn — from authMiddleware.js (real JWT.verify)
 *   3. hashPassword — from authHelper.js (real bcrypt hashing)
 *   4. userModel.js  — real mongoose schema
 *   5. jsonwebtoken   — real sign/verify; no mock
 *
 * Only stubbed:
 *   DB transport only — findById, findByIdAndUpdate via jest.spyOn.
 *   No model file is ever jest.mock()'d.
 *
 * Integration contracts verified:
 *   - JWT payload → requireSignIn decode → req.user._id → controller query
 *   - Real bcrypt hashing occurs for valid passwords (≥6 chars)
 *   - Password validation boundary at exactly 6 characters (BVA)
 *   - Profile fields fall back to existing values when not provided (EP)
 *   - Server-side validation for empty name/phone/address fields
 */

import { jest } from "@jest/globals";
import JWT from "jsonwebtoken";
import mongoose from "mongoose";

import { requireSignIn } from "../middlewares/authMiddleware.js";
import { updateProfileController } from "./authController.js";
import { hashPassword } from "../helpers/authHelper.js";
import userModel from "../models/userModel.js";

// Use a deterministic secret so real JWT.sign / JWT.verify agree in tests
process.env.JWT_SECRET = "test-profile-integration-secret";
const JWT_SECRET = process.env.JWT_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run an array of express middleware / controller functions as a sequential
 * pipeline, stopping as soon as one does not call next().
 */
const runPipeline = async (fns, req, res) => {
  for (const fn of fns) {
    let nextCalled = false;
    await fn(req, res, () => {
      nextCalled = true;
    });
    if (!nextCalled) break;
  }
};

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

/** Sign a JWT with the test secret */
const signToken = (payload) => JWT.sign(payload, JWT_SECRET);

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store — reset before every test
// ─────────────────────────────────────────────────────────────────────────────

let userStore;

const makeExistingUser = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: "Existing User",
  email: `user-${Math.random()}@example.com`,
  password: "$2b$10$existinghashedpasswordplaceholder1234567890",
  phone: "91234567",
  address: "123 NUS Street",
  role: 0,
  ...overrides,
});

beforeEach(() => {
  userStore = [];

  // findById — returns user from in-memory store
  jest
    .spyOn(userModel, "findById")
    .mockImplementation(async (id) =>
      userStore.find((u) => u._id?.toString() === id?.toString()) ?? null
    );

  // findByIdAndUpdate — applies update in-memory and returns updated user
  jest
    .spyOn(userModel, "findByIdAndUpdate")
    .mockImplementation(async (id, update, options) => {
      const idx = userStore.findIndex(
        (u) => u._id?.toString() === id?.toString()
      );
      if (idx === -1) return null;
      const existing = userStore[idx];
      const updated = { ...existing, ...update };
      userStore[idx] = updated;
      return updated;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Profile Update integration tests", () => {
  // ── requireSignIn → updateProfileController pipeline ────────────────────
  describe("PUT /api/v1/auth/profile [requireSignIn → updateProfileController]", () => {
    // Antony Swami Alfred Ben, A0253016R
    it("JWT payload _id flows through requireSignIn into profile lookup", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { name: "Updated Name" },
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      // requireSignIn decoded the token and the controller used req.user._id
      expect(userModel.findById).toHaveBeenCalledWith(user._id.toString());
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile Updated Successfully",
        })
      );
    });

    // Antony Swami Alfred Ben, A0253016R
    it("invalid JWT: requireSignIn returns 401, controller never runs", async () => {
      const req = {
        headers: { authorization: "invalid.token.here" },
        body: { name: "Hacker" },
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(userModel.findById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    // Antony Swami Alfred Ben, A0253016R
    it("updates name, phone, and address — real bcrypt NOT called when no password", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: {
          name: "New Name",
          phone: "98765432",
          address: "456 Clementi Ave",
        },
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        user._id.toString(),
        expect.objectContaining({
          name: "New Name",
          phone: "98765432",
          address: "456 Clementi Ave",
          password: user.password, // original password preserved
        }),
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // Antony Swami Alfred Ben, A0253016R
    it("valid password (≥6 chars): real bcrypt hashing produces a new hash", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { password: "newpass123" },
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      // The password stored should be a real bcrypt hash, not the plain text
      const updateCall = userModel.findByIdAndUpdate.mock.calls[0];
      const savedPassword = updateCall[1].password;
      expect(savedPassword).not.toBe("newpass123");
      expect(savedPassword).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern
      expect(res.status).toHaveBeenCalledWith(200);
    });

    // BVA: password boundary at exactly 6 characters
    // Antony Swami Alfred Ben, A0253016R
    it("BVA: password with exactly 5 chars (below boundary) is rejected", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { password: "12345" }, // 5 chars — below 6-char boundary
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Password is required and 6 character long",
      });
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("BVA: password with exactly 6 chars (at boundary) is accepted and hashed", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { password: "123456" }, // exactly 6 chars — at boundary
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const savedPassword = userModel.findByIdAndUpdate.mock.calls[0][1].password;
      expect(savedPassword).toMatch(/^\$2[ayb]\$.{56}$/); // real bcrypt hash
    });

    // EP: empty body — fields fall back to existing user values
    // Antony Swami Alfred Ben, A0253016R
    it("EP: empty body — all fields default to existing user values", async () => {
      const user = makeExistingUser({
        name: "Original",
        phone: "11111111",
        address: "Old Address",
      });
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: {},
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        user._id.toString(),
        {
          name: "Original",
          password: user.password,
          phone: "11111111",
          address: "Old Address",
        },
        { new: true }
      );
    });

    // Server-side validation: empty name
    // Antony Swami Alfred Ben, A0253016R
    it("rejects empty name with 400 error", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { name: "   " }, // whitespace-only name
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Name is required" });
    });

    // Server-side validation: empty phone
    // Antony Swami Alfred Ben, A0253016R
    it("rejects empty phone with 400 error", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { phone: "  " }, // whitespace-only phone
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Phone is required" });
    });

    // Server-side validation: empty address
    // Antony Swami Alfred Ben, A0253016R
    it("rejects empty address with 400 error", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = {
        headers: { authorization: token },
        body: { address: "  " }, // whitespace-only address
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Address is required" });
    });

    // DB error handling
    // Antony Swami Alfred Ben, A0253016R
    it("DB error on findById: controller catches and returns 400", async () => {
      const userId = new mongoose.Types.ObjectId();
      const token = signToken({ _id: userId.toString() });

      userModel.findById.mockRejectedValue(new Error("DB connection lost"));

      const req = {
        headers: { authorization: token },
        body: { name: "Test" },
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error While Updating Profile",
        })
      );
    });

    // DB error on findByIdAndUpdate
    // Antony Swami Alfred Ben, A0253016R
    it("DB error on findByIdAndUpdate: controller catches and returns 400", async () => {
      const user = makeExistingUser();
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      userModel.findByIdAndUpdate.mockRejectedValue(
        new Error("Update failed")
      );

      const req = {
        headers: { authorization: token },
        body: { name: "Will Fail" },
      };
      const res = buildRes();

      await runPipeline([requireSignIn, updateProfileController], req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error While Updating Profile",
        })
      );
    });
  });
});
