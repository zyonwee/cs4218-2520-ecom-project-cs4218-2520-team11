import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { requireSignIn, isAdmin } from "./authMiddleware";
import userModel from "../models/userModel";

jest.mock("../models/userModel");

describe("Integration Tests: Security Middleware (requireSignIn & isAdmin)", () => {
  let app;
  const JWT_SECRET = "test-secret-key-123";

  const validUserToken = jwt.sign({ _id: "standardUser123" }, JWT_SECRET, { expiresIn: "1h" });
  const validAdminToken = jwt.sign({ _id: "adminUser999" }, JWT_SECRET, { expiresIn: "1h" });
  const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token";

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    app = express();
    app.use(express.json());

    const dummyController = (req, res) => {
      res.status(200).send({ success: true, message: "Endpoint Reached!" });
    };

    app.get("/api/protected", requireSignIn, dummyController);
    app.get("/api/admin-protected", requireSignIn, isAdmin, dummyController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication: requireSignIn Middleware", () => {
    it("No token → blocked with 401 auth error", async () => {
      // Huang Yi Chee, A0259617R

      const res = await request(app).get("/api/protected");

      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          message: "Unauthorized Access: Invalid or Missing Token",
        })
      );
    });

    it("Invalid token → blocked with 401 auth error", async () => {
      // Huang Yi Chee, A0259617R

      const res = await request(app)
        .get("/api/protected")
        .set("Authorization", invalidToken);

      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          success: false,
          message: "Unauthorized Access: Invalid or Missing Token",
        })
      );
    });

    it("Valid token → allowed to reach controller", async () => {
      // Huang Yi Chee, A0259617R

      const res = await request(app)
        .get("/api/protected")
        .set("Authorization", validUserToken);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Endpoint Reached!");
    });
  });

  describe("Authorization: isAdmin Middleware", () => {
    it("Non-admin blocked (401) → valid token but insufficient role", async () => {
      // Huang Yi Chee, A0259617R

      userModel.findById.mockResolvedValue({ _id: "standardUser123", role: 0 });

      const res = await request(app)
        .get("/api/admin-protected")
        .set("Authorization", validUserToken);

      expect(res.status).toBe(401);
      expect(res.body.message).not.toBe("Endpoint Reached!");
      expect(userModel.findById).toHaveBeenCalledWith("standardUser123");
    });

    it("Admin allowed (200) → valid token and sufficient role", async () => {
      // Huang Yi Chee, A0259617R

      userModel.findById.mockResolvedValue({ _id: "adminUser999", role: 1 });

      const res = await request(app)
        .get("/api/admin-protected")
        .set("Authorization", validAdminToken);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Endpoint Reached!");
      expect(userModel.findById).toHaveBeenCalledWith("adminUser999");
    });
  });
});