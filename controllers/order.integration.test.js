/**
 * Integration tests for order endpoints (bottom-up)
 *
 * Real components under test:
 *   1. getOrdersController, getAllOrdersController, orderStatusController
 *      — from authController.js
 *   2. requireSignIn, isAdmin — from authMiddleware.js
 *      (real JWT.verify, real role check against real userModel)
 *   3. orderModel.js  — real mongoose schema (status enum, timestamps, refs)
 *   4. userModel.js   — real mongoose schema (role field)
 *   5. jsonwebtoken   — real sign/verify; no mock
 *
 * Only stubbed:
 *   DB transport only — find, findByIdAndUpdate, findById via jest.spyOn.
 *   No model file is ever jest.mock()'d.
 *
 * Integration contracts verified:
 *   - JWT payload → requireSignIn decode → req.user._id → controller query
 *   - isAdmin reads role from real userModel Document via userModel.findById
 *   - orderStatusController uses req.params.orderId + req.body.status
 *   - orderModel enum validation is active on real Documents
 */

import { jest } from "@jest/globals";
import JWT from "jsonwebtoken";
import mongoose from "mongoose";

import { requireSignIn, isAdmin } from "../middlewares/authMiddleware.js";
import {
  getOrdersController,
  getAllOrdersController,
  orderStatusController,
} from "./authController.js";
import orderModel from "../models/orderModel.js";
import userModel from "../models/userModel.js";

// Use a deterministic secret so real JWT.sign / JWT.verify agree in tests
process.env.JWT_SECRET = "test-integration-secret";
const JWT_SECRET = process.env.JWT_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run an array of express middleware / controller functions as a sequential
 * pipeline, stopping as soon as one does not call next().
 * This exercises the real middleware chain without needing an HTTP server.
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

/**
 * Thenable query chain: awaiting it at any depth in a method chain resolves
 * to `result`.  Every chained method is a jest spy returning the same chain
 * so call assertions like expect(chain.sort).toHaveBeenCalledWith(…) work.
 */
const makeChain = (result) => {
  const chain = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
    finally: (fn) => Promise.resolve(result).finally(fn),
  };
  ["populate", "select", "sort", "limit", "skip"].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  return chain;
};

/** Sign a JWT with the test secret */
const signToken = (payload) => JWT.sign(payload, JWT_SECRET);

/**
 * Build a real userModel Document.
 * role: 0 = regular user, role: 1 = admin.
 */
const makeUser = (overrides = {}) =>
  new userModel({
    _id: new mongoose.Types.ObjectId(),
    name: "Test User",
    email: `user-${Math.random()}@example.com`,
    password: "hashed-password",
    phone: "99999999",
    address: "123 Test Street",
    answer: "test-answer",
    role: 0,
    ...overrides,
  });

/**
 * Build a real orderModel Document with sensible defaults.
 */
const makeOrder = (overrides = {}) =>
  new orderModel({
    _id: new mongoose.Types.ObjectId(),
    products: [],
    payment: { method: "card" },
    buyer: new mongoose.Types.ObjectId(),
    status: "Not Process",
    ...overrides,
  });

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores — reset before every test
// ─────────────────────────────────────────────────────────────────────────────

let orderStore;
let userStore;

beforeEach(() => {
  orderStore = [];
  userStore = [];

  // Default find: return all orders (individual tests may override)
  jest
    .spyOn(orderModel, "find")
    .mockImplementation(() => makeChain([...orderStore]));

  // findByIdAndUpdate: apply update on a real mongoose Document
  jest
    .spyOn(orderModel, "findByIdAndUpdate")
    .mockImplementation(async (id, update) => {
      const idx = orderStore.findIndex(
        (o) => o._id?.toString() === id?.toString()
      );
      if (idx === -1) return null;
      const existing = orderStore[idx];
      const updated = new orderModel({
        products: existing.products,
        payment: existing.payment,
        buyer: existing.buyer,
        status: existing.status,
        ...update,
      });
      updated._id = existing._id;
      orderStore[idx] = updated;
      return updated;
    });

  // isAdmin calls userModel.findById to check the role
  jest
    .spyOn(userModel, "findById")
    .mockImplementation(async (id) =>
      userStore.find((u) => u._id?.toString() === id?.toString()) ?? null
    );
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Order endpoints integration tests", () => {
  // ── getOrdersController ──────────────────────────────────────────────────
  describe("GET /api/v1/auth/orders  [requireSignIn → getOrdersController]", () => {
    it("JWT payload _id flows through requireSignIn into orderModel.find query", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const userId = new mongoose.Types.ObjectId();
      const token = signToken({ _id: userId.toString() });

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline([requireSignIn, getOrdersController], req, res);

      // requireSignIn decoded the token and the controller used req.user._id
      expect(orderModel.find).toHaveBeenCalledWith({ buyer: userId.toString() });
    });

    it("returns only the authenticated user's orders, not other buyers'", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const userId = new mongoose.Types.ObjectId();
      const token = signToken({ _id: userId.toString() });

      const myOrder = makeOrder({ buyer: userId });
      const otherOrder = makeOrder({ buyer: new mongoose.Types.ObjectId() });
      orderStore.push(myOrder, otherOrder);

      // Scope the find mock to mimic real DB buyer filter
      orderModel.find.mockImplementation((query) => {
        const filtered = orderStore.filter(
          (o) => o.buyer?.toString() === query.buyer?.toString()
        );
        return makeChain(filtered);
      });

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline([requireSignIn, getOrdersController], req, res);

      const returned = res.json.mock.calls[0][0];
      expect(returned).toHaveLength(1);
      expect(returned[0].buyer.toString()).toBe(userId.toString());
    });

    it("returns an empty array when the authenticated user has no orders", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const userId = new mongoose.Types.ObjectId();
      const token = signToken({ _id: userId.toString() });

      orderModel.find.mockImplementation(() => makeChain([]));

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline([requireSignIn, getOrdersController], req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("invalid JWT: requireSignIn halts pipeline silently — controller never runs", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      // requireSignIn catches the JWT error but neither calls next() nor sends
      // a response — demonstrating that the middleware swallows the error.
      const req = { headers: { authorization: "invalid.token.here" } };
      const res = buildRes();

      await runPipeline([requireSignIn, getOrdersController], req, res);

      expect(orderModel.find).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("DB error after valid JWT: controller catches and returns 500", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const userId = new mongoose.Types.ObjectId();
      const token = signToken({ _id: userId.toString() });

      orderModel.find.mockImplementation(() => {
        throw new Error("DB connection lost");
      });

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline([requireSignIn, getOrdersController], req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error WHile Geting Orders",
        })
      );
    });
  });

  // ── getAllOrdersController ────────────────────────────────────────────────
  describe("GET /api/v1/auth/all-orders  [requireSignIn → isAdmin → getAllOrdersController]", () => {
    it("admin token: all orders returned; populate and sort chain verified", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const admin = makeUser({ role: 1 });
      userStore.push(admin);
      const token = signToken({ _id: admin._id.toString() });

      orderStore.push(makeOrder(), makeOrder(), makeOrder());

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, getAllOrdersController],
        req,
        res
      );

      expect(res.json).toHaveBeenCalled();
      const returned = res.json.mock.calls[0][0];
      expect(returned).toHaveLength(3);

      // Verify the controller used the correct query chain options
      const chain = orderModel.find.mock.results[0].value;
      expect(chain.populate).toHaveBeenCalledWith("products", "-photo");
      expect(chain.populate).toHaveBeenCalledWith("buyer", "name");
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it("admin sees all orders regardless of buyer", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const admin = makeUser({ role: 1 });
      userStore.push(admin);
      const token = signToken({ _id: admin._id.toString() });

      // Three orders with different buyers
      const buyers = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];
      buyers.forEach((b) => orderStore.push(makeOrder({ buyer: b })));

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, getAllOrdersController],
        req,
        res
      );

      // find called with empty query — no buyer filter for admin
      expect(orderModel.find).toHaveBeenCalledWith({});
      expect(res.json.mock.calls[0][0]).toHaveLength(3);
    });

    it("non-admin user: isAdmin blocks with 401, controller never runs", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const user = makeUser({ role: 0 });
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, getAllOrdersController],
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: "UnAuthorized Access" })
      );
      // isAdmin returned 401 — controller must never have been reached
      expect(orderModel.find).not.toHaveBeenCalled();
    });

    it("admin + DB error: controller returns 500", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const admin = makeUser({ role: 1 });
      userStore.push(admin);
      const token = signToken({ _id: admin._id.toString() });

      orderModel.find.mockImplementation(() => {
        throw new Error("DB unavailable");
      });

      const req = { headers: { authorization: token } };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, getAllOrdersController],
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Error WHile Geting Orders" })
      );
    });
  });

  // ── orderStatusController ─────────────────────────────────────────────────
  describe("PUT /api/v1/auth/order-status/:orderId  [requireSignIn → isAdmin → orderStatusController]", () => {
    it("admin: status updated on real mongoose Document, updated order returned", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const admin = makeUser({ role: 1 });
      userStore.push(admin);
      const token = signToken({ _id: admin._id.toString() });

      const order = makeOrder({ status: "Not Process" });
      orderStore.push(order);

      const req = {
        headers: { authorization: token },
        params: { orderId: order._id.toString() },
        body: { status: "Processing" },
      };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, orderStatusController],
        req,
        res
      );

      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        order._id.toString(),
        { status: "Processing" },
        { new: true }
      );
      const updated = res.json.mock.calls[0][0];
      expect(updated).toBeInstanceOf(orderModel);
      expect(updated.status).toBe("Processing");
    });

    it("status transition: Not Process → Shipped stored on real Document", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const admin = makeUser({ role: 1 });
      userStore.push(admin);
      const token = signToken({ _id: admin._id.toString() });

      const order = makeOrder({ status: "Not Process" });
      orderStore.push(order);

      const req = {
        headers: { authorization: token },
        params: { orderId: order._id.toString() },
        body: { status: "Shipped" },
      };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, orderStatusController],
        req,
        res
      );

      const updated = res.json.mock.calls[0][0];
      expect(updated.status).toBe("Shipped");
      // In-memory store also reflects the change
      expect(orderStore[0].status).toBe("Shipped");
    });

    it("real orderModel schema: all valid enum statuses pass validation", () => {
      // Julius Bryan Reynon Gambe A02522251R
      const valid = ["Not Process", "Processing", "Shipped", "deliverd", "cancel"];
      valid.forEach((status) => {
        const doc = new orderModel({ status });
        expect(doc.validateSync()?.errors?.status).toBeUndefined();
      });
    });

    it("real orderModel schema: invalid status value fails enum validation", () => {
      // Julius Bryan Reynon Gambe A02522251R
      const doc = new orderModel({ status: "InvalidStatus" });
      const err = doc.validateSync();
      expect(err?.errors?.status).toBeDefined();
    });

    it("non-admin: isAdmin blocks with 401, findByIdAndUpdate never called", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const user = makeUser({ role: 0 });
      userStore.push(user);
      const token = signToken({ _id: user._id.toString() });

      const order = makeOrder();
      orderStore.push(order);

      const req = {
        headers: { authorization: token },
        params: { orderId: order._id.toString() },
        body: { status: "Shipped" },
      };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, orderStatusController],
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("admin + DB error: controller returns 500", async () => {
      // Julius Bryan Reynon Gambe A02522251R
      const admin = makeUser({ role: 1 });
      userStore.push(admin);
      const token = signToken({ _id: admin._id.toString() });

      orderModel.findByIdAndUpdate.mockRejectedValue(new Error("DB error"));

      const req = {
        headers: { authorization: token },
        params: { orderId: "some-order-id" },
        body: { status: "cancel" },
      };
      const res = buildRes();

      await runPipeline(
        [requireSignIn, isAdmin, orderStatusController],
        req,
        res
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Error While Updating Order" })
      );
    });
  });
});
