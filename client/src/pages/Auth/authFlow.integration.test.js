import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AuthProvider } from "../../context/auth";
import Login from "./Login";
import Register from "./Register";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    defaults: {
      headers: {
        common: {},
      },
    },
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../components/Layout", () => {
  return function MockLayout({ children }) {
    return <div data-testid="layout">{children}</div>;
  };
});

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
};

const renderWithProviders = (initialRoute = "/") => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/forgot-password"
            element={<div data-testid="forgot-page">Forgot Password</div>}
          />
          <Route path="/" element={<div data-testid="home-page">Home</div>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </AuthProvider>
  );
};

describe("Frontend Integration: Auth Flow (Context + Routing + Components)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    delete axios.defaults.headers.common["Authorization"];
  });

  describe("Login Flow Integration", () => {
    it("Login success persists auth session & redirects to home", async () => {
      // Huang Yi Chee, A0259617R

      const mockLoginResponse = {
        data: {
          success: true,
          message: "login successfully",
          user: { name: "Test User", email: "test@example.com" },
          token: "valid-jwt-token",
        },
      };

      axios.post.mockResolvedValueOnce(mockLoginResponse);

      renderWithProviders("/login");

      fireEvent.change(screen.getByPlaceholderText(/Enter Your Email/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Password/i), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/v1/auth/login", {
          email: "test@example.com",
          password: "password123",
        });

        expect(toast.success).toHaveBeenCalledWith(
          "login successfully",
          expect.any(Object)
        );

        const storedAuth = JSON.parse(window.localStorage.getItem("auth"));
        expect(storedAuth.token).toBe("valid-jwt-token");
        expect(storedAuth.user.name).toBe("Test User");

        expect(axios.defaults.headers.common["Authorization"]).toBe(
          "valid-jwt-token"
        );
        expect(screen.getByTestId("location-display").textContent).toBe("/");
      });
    });

    it("Login failure shows generic error feedback & blocks session persistence", async () => {
      // Huang Yi Chee, A0259617R

      axios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            success: false,
            message: "Invalid Password",
          },
        },
      });

      renderWithProviders("/login");

      fireEvent.change(screen.getByPlaceholderText(/Enter Your Email/i), {
        target: { value: "wrong@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Password/i), {
        target: { value: "wrongpass" },
      });
      fireEvent.click(screen.getByRole("button", { name: /login/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Something went wrong");
        expect(window.localStorage.getItem("auth")).toBeNull();
        expect(screen.getByTestId("location-display").textContent).toBe(
          "/login"
        );
      });
    });

    it("Forgot Password button navigates to forgot-password page", async () => {
      // Huang Yi Chee, A0259617R

      renderWithProviders("/login");

      fireEvent.click(
        screen.getByRole("button", { name: /forgot password/i })
      );

      await waitFor(() => {
        expect(screen.getByTestId("location-display").textContent).toBe(
          "/forgot-password"
        );
        expect(screen.getByTestId("forgot-page").textContent).toBe(
          "Forgot Password"
        );
      });
    });
  });

  describe("Registration Flow Integration", () => {
    it("Register success redirects to login with success feedback", async () => {
      // Huang Yi Chee, A0259617R

      const mockRegisterResponse = {
        data: { success: true, message: "User Register Successfully" },
      };

      axios.post.mockResolvedValueOnce(mockRegisterResponse);

      renderWithProviders("/register");

      fireEvent.change(screen.getByPlaceholderText(/Enter Your Name/i), {
        target: { value: "New User" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Email/i), {
        target: { value: "new@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Password/i), {
        target: { value: "pass123" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Phone/i), {
        target: { value: "98765432" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Address/i), {
        target: { value: "NUS Computing" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your DOB/i), {
        target: { value: "2000-01-01" },
      });
      fireEvent.change(
        screen.getByPlaceholderText(/What is Your Favorite sports/i),
        {
          target: { value: "Dog" },
        }
      );

      fireEvent.click(screen.getByRole("button", { name: /register/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith("/api/v1/auth/register", {
          name: "New User",
          email: "new@example.com",
          password: "pass123",
          phone: "98765432",
          address: "NUS Computing",
          DOB: "2000-01-01",
          answer: "Dog",
        });

        expect(toast.success).toHaveBeenCalledWith(
          "Register Successfully, please login"
        );
        expect(screen.getByTestId("location-display").textContent).toBe(
          "/login"
        );
      });
    });

    it("Register duplicate email shows generic error & no redirect occurs", async () => {
      // Huang Yi Chee, A0259617R

      axios.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            success: false,
            message: "Already Register please login",
          },
        },
      });

      renderWithProviders("/register");

      fireEvent.change(screen.getByPlaceholderText(/Enter Your Name/i), {
        target: { value: "Dup User" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Email/i), {
        target: { value: "duplicate@example.com" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Password/i), {
        target: { value: "pass123" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Phone/i), {
        target: { value: "98765432" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your Address/i), {
        target: { value: "NUS Computing" },
      });
      fireEvent.change(screen.getByPlaceholderText(/Enter Your DOB/i), {
        target: { value: "2000-01-01" },
      });
      fireEvent.change(
        screen.getByPlaceholderText(/What is Your Favorite sports/i),
        {
          target: { value: "Dog" },
        }
      );

      fireEvent.click(screen.getByRole("button", { name: /register/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Something went wrong");
        expect(screen.getByTestId("location-display").textContent).toBe(
          "/register"
        );
      });
    });
  });

  describe("Context Persistence Verification", () => {
    it("AuthProvider restores session from localStorage and applies auth header", async () => {
      // Huang Yi Chee, A0259617R

      const mockStoredAuth = {
        user: { name: "Returning User" },
        token: "restored-jwt-token",
      };

      window.localStorage.setItem("auth", JSON.stringify(mockStoredAuth));

      renderWithProviders("/");

      await waitFor(() => {
        expect(axios.defaults.headers.common["Authorization"]).toBe(
          "restored-jwt-token"
        );
      });
    });

    it("AuthProvider leaves auth header empty when no localStorage session exists", async () => {
      // Huang Yi Chee, A0259617R

      renderWithProviders("/");

      await waitFor(() => {
        expect(axios.defaults.headers.common["Authorization"]).toBe("");
      });
    });
  });
});