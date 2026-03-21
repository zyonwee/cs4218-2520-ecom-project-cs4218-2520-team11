import {
  registerController,
  loginController,
  forgotPasswordController,
} from "./authController";
import { hashPassword } from "../helpers/authHelper";
import userModel from "../models/userModel";
import jwt from "jsonwebtoken";

jest.mock("../models/userModel");

describe("Bottom-Up Integration: authController + authHelper + JWT", () => {
  let req, res;
  let inMemoryDB = [];

  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-key-123";
  });

  beforeEach(() => {
    inMemoryDB = [];
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    userModel.mockImplementation(function (data) {
      Object.assign(this, data);
      this.save = jest.fn().mockImplementation(async () => {
        inMemoryDB.push(this);
        return this;
      });
    });

    userModel.findOne = jest.fn().mockImplementation(async (query) => {
      return (
        inMemoryDB.find((user) => {
          let match = true;
          if (query.email && user.email !== query.email) match = false;
          if (query.answer && user.answer !== query.answer) match = false;
          return match;
        }) || null
      );
    });

    userModel.findByIdAndUpdate = jest
      .fn()
      .mockImplementation(async (id, updateData) => {
        const user = inMemoryDB.find((u) => u._id === id);
        if (user) {
          Object.assign(user, updateData);
          return user;
        }
        return null;
      });

    jest.clearAllMocks();
  });

  it("Register success (201) - validates real password hashing", async () => {
    // Huang Yi Chee, A0259617R

    req.body = {
      name: "Test User",
      email: "test@example.com",
      password: "PlainTextPassword123",
      phone: "12345678",
      address: "123 Kent Ridge",
      answer: "Dog",
      DOB: "2000-01-01",
    };

    await registerController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    expect(inMemoryDB.length).toBe(1);
    const savedUser = inMemoryDB[0];

    expect(savedUser.password).not.toBe("PlainTextPassword123");
    expect(savedUser.password).toMatch(/^\$2[ayb]\$.{56}$/);
  });

  it("Duplicate email (409) - blocks second registration", async () => {
    // Huang Yi Chee, A0259617R

    inMemoryDB.push({
      name: "Existing User",
      email: "duplicate@example.com",
      password: "hashedpassword123",
    });

    req.body = {
      name: "New User",
      email: "duplicate@example.com",
      password: "newpassword456",
      phone: "87654321",
      address: "456 Computing Dr",
      answer: "Cat",
      DOB: "2001-01-01",
    };

    await registerController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Already Register please login",
      })
    );
    expect(inMemoryDB.length).toBe(1);
  });

  it("Login success (200) - returns valid JWT and user object", async () => {
    // Huang Yi Chee, A0259617R

    const plainPassword = "ValidPassword123";
    const hashed = await hashPassword(plainPassword);

    inMemoryDB.push({
      _id: "mockUserId999",
      name: "Login User",
      email: "login@example.com",
      password: hashed,
      role: 0,
    });

    req.body = {
      email: "login@example.com",
      password: plainPassword,
    };

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.send.mock.calls[0][0];

    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe("login successfully");
    expect(responseData.user).toEqual(
      expect.objectContaining({
        _id: "mockUserId999",
        name: "Login User",
        email: "login@example.com",
        role: 0,
      })
    );
    expect(responseData.token).toBeDefined();

    const decodedToken = jwt.verify(responseData.token, process.env.JWT_SECRET);
    expect(decodedToken._id).toBe("mockUserId999");
  });

  it("Invalid password (401) - blocks login attempt", async () => {
    // Huang Yi Chee, A0259617R

    const hashed = await hashPassword("CorrectPassword123");

    inMemoryDB.push({
      email: "secure@example.com",
      password: hashed,
    });

    req.body = {
      email: "secure@example.com",
      password: "WrongPassword!@#",
    };

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid Password",
      })
    );
  });

  it("User not found (404) - non-existent email", async () => {
    // Huang Yi Chee, A0259617R

    req.body = {
      email: "ghost@example.com",
      password: "AnyPassword",
    };

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Email is not registered",
      })
    );
  });

  it("Reset success (200) - verifies password hash mutation", async () => {
    // Huang Yi Chee, A0259617R

    const initialHashedPassword = await hashPassword("OldPassword123");

    const testUser = {
      _id: "resetUser123",
      email: "reset@example.com",
      answer: "Dog",
      password: initialHashedPassword,
    };

    inMemoryDB.push(testUser);

    req.body = {
      email: "reset@example.com",
      answer: "Dog",
      newPassword: "BrandNewPassword456",
    };

    await forgotPasswordController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(testUser.password).not.toBe(initialHashedPassword);
    expect(testUser.password).not.toBe("BrandNewPassword456");
    expect(testUser.password).toMatch(/^\$2[ayb]\$.{56}$/);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith("resetUser123", {
      password: testUser.password,
    });
  });

  it("Wrong answer (404) - prevents password update", async () => {
    // Huang Yi Chee, A0259617R

    const initialHashedPassword = await hashPassword("SafePassword123");

    const testUser = {
      _id: "targetUser999",
      email: "target@example.com",
      answer: "Cat",
      password: initialHashedPassword,
    };

    inMemoryDB.push(testUser);

    req.body = {
      email: "target@example.com",
      answer: "Bird",
      newPassword: "HackerPassword999",
    };

    await forgotPasswordController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(testUser.password).toBe(initialHashedPassword);
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});