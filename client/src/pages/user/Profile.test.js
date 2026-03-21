import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Profile from "./Profile";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuth } from "../../context/auth";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../components/Layout", () => ({ children, title }) => (
  <div data-testid="layout" title={title}>{children}</div>
));
jest.mock("../../components/UserMenu", () => () => <div data-testid="user-menu" />);

describe("Profile Component UI Test Suite", () => {
    let mockSetAuth;
    let mockAuthData;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSetAuth = jest.fn();
        mockAuthData = {
            user: {
                name: "Test User",
                email: "test@example.com",
                phone: "1234567890",
                address: "123 Test St",
            },
            token: "fake_jwt_token",
        };
        useAuth.mockReturnValue([mockAuthData, mockSetAuth]);

        const localStorageMock = (() => {
            let store = {
                auth: JSON.stringify(mockAuthData),
            };
            return {
                getItem: jest.fn((key) => store[key] || null),
                setItem: jest.fn((key, value) => {
                    store[key] = value.toString();
                }),
                clear: jest.fn(() => {
                    store = {};
                }),
            };
        })();
        Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true });
    });

    describe("UI Rendering and Hydration", () => {
        it("should mount and pre-fill form fields from Auth Context", () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);

            expect(screen.getByPlaceholderText(/Enter Your Name/i).value).toBe("Test User");
            expect(screen.getByPlaceholderText(/Enter Your Phone/i).value).toBe("1234567890");
            expect(screen.getByPlaceholderText(/Enter Your Address/i).value).toBe("123 Test St");
            expect(screen.getByPlaceholderText(/Enter Your Password/i).value).toBe("");
        });

        it("should enforce email immutability (input is disabled)", () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);
      
            const emailInput = screen.getByPlaceholderText(/Enter Your Email/i);
            expect(emailInput.value).toBe("test@example.com");
      
            expect(emailInput).toBeDisabled();
        });
    });

    describe("User Interaction and API Submission", () => {
        it("should allow users to type into the input fields", () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);
      
            const nameInput = screen.getByPlaceholderText(/Enter Your Name/i);
            fireEvent.change(nameInput, { target: { value: "Updated Name" } });
      
            expect(nameInput.value).toBe("Updated Name");
        });

        it("should allow programmatic updates to the disabled email field", () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);
      
            const emailInput = screen.getByPlaceholderText(/Enter Your Email/i);
            
            fireEvent.change(emailInput, { target: { value: "new_forced_email@example.com" } });
      
            expect(emailInput.value).toBe("new_forced_email@example.com");
        });

        it("should handle successful profile update, update global state, and set LocalStorage", async () => {
        // Huang Yi Chee, A0259617R
            const updatedUser = { ...mockAuthData.user, name: "Updated Name" };
            axios.put.mockResolvedValue({
                data: { success: true, updatedUser },
            });

            render(<Profile />);

            fireEvent.change(screen.getByPlaceholderText(/Enter Your Name/i), { target: { value: "Updated Name" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).toHaveBeenCalled();
            });

            expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
                name: "Updated Name",
                email: "test@example.com",
                password: "",
                phone: "1234567890",
                address: "123 Test St",
            });
            expect(mockSetAuth).toHaveBeenCalledWith({
                ...mockAuthData,
                user: updatedUser,
            });
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                "auth",
                JSON.stringify({ ...mockAuthData, user: updatedUser })
            );
            expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
        });

        it("should handle successful profile update when changing the password", async () => {
        // Huang Yi Chee, A0259617R
            const updatedUser = { ...mockAuthData.user };
            axios.put.mockResolvedValue({
                data: { success: true, updatedUser },
            });

            render(<Profile />);

            fireEvent.change(screen.getByPlaceholderText(/Enter Your Password/i), { target: { value: "newSecurePassword123" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).toHaveBeenCalled();
            });

            expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
                name: "Test User",
                email: "test@example.com",
                password: "newSecurePassword123", 
                phone: "1234567890",
                address: "123 Test St",
            });
            expect(mockSetAuth).toHaveBeenCalledWith({
                ...mockAuthData,
                user: updatedUser,
            });
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                "auth",
                JSON.stringify({ ...mockAuthData, user: updatedUser })
            );
            expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
        });

        it("should handle successful profile update when changing the phone number", async () => {
        // Huang Yi Chee, A0259617R
            const updatedUser = { ...mockAuthData.user, phone: "9876543210" };
            axios.put.mockResolvedValue({
                data: { success: true, updatedUser },
            });

            render(<Profile />);

            fireEvent.change(screen.getByPlaceholderText(/Enter Your Phone/i), { target: { value: "9876543210" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).toHaveBeenCalled();
            });

            expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
                name: "Test User",
                email: "test@example.com",
                password: "",
                phone: "9876543210",
                address: "123 Test St",
            });
            expect(mockSetAuth).toHaveBeenCalledWith({
                ...mockAuthData,
                user: updatedUser,
            });
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                "auth",
                JSON.stringify({ ...mockAuthData, user: updatedUser })
            );
            expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
        });

        it("should handle successful profile update when changing the address", async () => {
        // Huang Yi Chee, A0259617R
            const updatedUser = { ...mockAuthData.user, address: "456 New React Ave" };
            axios.put.mockResolvedValue({
                data: { success: true, updatedUser },
            });

            render(<Profile />);

            fireEvent.change(screen.getByPlaceholderText(/Enter Your Address/i), { target: { value: "456 New React Ave" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).toHaveBeenCalled();
            });

            expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
                name: "Test User",
                email: "test@example.com",
                password: "",
                phone: "1234567890",
                address: "456 New React Ave",
            });
            expect(mockSetAuth).toHaveBeenCalledWith({
                ...mockAuthData,
                user: updatedUser,
            });
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                "auth",
                JSON.stringify({ ...mockAuthData, user: updatedUser })
            );
            expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
        });

        describe("Error Handling and Defect Catching", () => {
            it("should display error toast if API returns a validation error", async () => {
            // Huang Yi Chee, A0259617R
                axios.put.mockResolvedValue({
                    data: { error: "Password is required and 6 character long" },
                });

                render(<Profile />);

                fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

                await waitFor(() => {
                    expect(toast.error).toHaveBeenCalledWith("Password is required and 6 character long");
                    expect(toast.success).not.toHaveBeenCalled();
                });
            });

            it("should display generic error toast if API call crashes (Catch Block)", async () => {
            // Huang Yi Chee, A0259617R
                axios.put.mockRejectedValue(new Error("Network Error"));

                render(<Profile />);

                fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

                await waitFor(() => {
                    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
                });
            });
        });
    });

    describe("Frontend Input Validation", () => {
        it("should prevent profile update and show error if Name is empty", async () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);
      
            fireEvent.change(screen.getByPlaceholderText(/Enter Your Name/i), { target: { value: "" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).not.toHaveBeenCalled();
            });

            expect(toast.error).toHaveBeenCalledWith("Name is required");
        });

        it("should prevent profile update and show error if Phone is empty", async () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);
      
            fireEvent.change(screen.getByPlaceholderText(/Enter Your Phone/i), { target: { value: "" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).not.toHaveBeenCalled();
            });

            expect(toast.error).toHaveBeenCalledWith("Phone is required");
        });

        it("should prevent profile update and show error if Address is empty", async () => {
        // Huang Yi Chee, A0259617R
            render(<Profile />);
      
            fireEvent.change(screen.getByPlaceholderText(/Enter Your Address/i), { target: { value: "" } });
            fireEvent.click(screen.getByRole("button", { name: /UPDATE/i }));

            await waitFor(() => {
                expect(axios.put).not.toHaveBeenCalled();
            });

            expect(toast.error).toHaveBeenCalledWith("Address is required");
        });
    });
});
