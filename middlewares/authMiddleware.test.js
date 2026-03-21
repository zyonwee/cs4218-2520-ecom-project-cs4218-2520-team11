import { requireSignIn, isAdmin } from "./authMiddleware.js";
import JWT from "jsonwebtoken";
import userModel from "../models/userModel.js";

jest.mock("jsonwebtoken");
jest.mock("../models/userModel.js");

describe("Security Middleware Test Suite", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { headers: {}, user: { _id: "user123" } };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe("requireSignIn Middleware", () => {
    
    describe("Token Verification Logic", () => {
      it("should call next() if token is valid", async () => {
      // Huang Yi Chee, A0259617R
        req.headers.authorization = "valid_token";
        JWT.verify.mockReturnValue({ _id: "user123" });

        await requireSignIn(req, res, next);

        expect(JWT.verify).toHaveBeenCalledWith("valid_token", process.env.JWT_SECRET);
        expect(req.user).toEqual({ _id: "user123" });
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe("Error Handling", () => {
      it("should handle invalid/missing tokens gracefully", async () => {
      // Huang Yi Chee, A0259617R
        req.headers.authorization = "bad_token";
        JWT.verify.mockImplementation(() => { throw new Error("Invalid Token"); });

        await requireSignIn(req, res, next);

        expect(next).not.toHaveBeenCalled();
      });
    });
  });
    
  describe("isAdmin Middleware", () => {
    
    describe("Role-Based Access Control (RBAC)", () => {
      it("should return 401 if user is not an admin (Role 0)", async () => {
      // Huang Yi Chee, A0259617R
        userModel.findById.mockResolvedValue({ _id: "user123", role: 0 });

        await isAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith(
          expect.objectContaining({ message: "UnAuthorized Access" })
        );
        expect(next).not.toHaveBeenCalled();
      });

      it("should call next() if user is an admin (Role 1)", async () => {
      // Huang Yi Chee, A0259617R
        userModel.findById.mockResolvedValue({ _id: "user123", role: 1 });

        await isAdmin(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe("Error Handling", () => {
      it("should return 401 and error message if an exception is caught", async () => {
      // Huang Yi Chee, A0259617R
        
        const mockError = new Error("Database connection lost");
        userModel.findById.mockRejectedValue(mockError);

        await isAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: mockError,
            message: "Error in admin middleware",
          })
        );
        expect(next).not.toHaveBeenCalled();
      });
    });
  });
});
