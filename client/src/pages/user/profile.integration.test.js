import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { AuthProvider } from "../../context/auth";
import Profile from "./Profile";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("../../components/Layout", () => ({ children }) => <div data-testid="layout">{children}</div>);
jest.mock("../../components/UserMenu", () => () => <div data-testid="user-menu">UserMenu</div>);

const renderWithProviders = (ui) => {
  return render(
    <AuthProvider>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </AuthProvider>
  );
};

describe("Frontend Integration: Profile Update Flow (Context + UI + Storage)", () => {
  const mockInitialUser = {
    name: "Original Name",
    email: "user@example.com",
    phone: "11111111",
    address: "123 Old Street",
  };

  const mockToken = "existing-jwt-token";

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      "auth",
      JSON.stringify({ user: mockInitialUser, token: mockToken })
    );
  });

  it("Profile loads - initial form fields are prefilled from auth context", async () => {
    // Huang Yi Chee, A0259617R

    renderWithProviders(<Profile />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter Your Name/i).value).toBe(mockInitialUser.name);
      expect(screen.getByPlaceholderText(/Enter Your Phone/i).value).toBe(mockInitialUser.phone);
      expect(screen.getByPlaceholderText(/Enter Your Address/i).value).toBe(mockInitialUser.address);

      const emailInput = screen.getByPlaceholderText(/Enter Your Email/i);
      expect(emailInput.value).toBe(mockInitialUser.email);
      expect(emailInput).toBeDisabled();
    });
  });

  it("Profile update success - calls axios.put and updates context + localStorage", async () => {
    // Huang Yi Chee, A0259617R

    const mockUpdatedUser = {
      name: "Updated Name",
      email: "user@example.com",
      phone: "99999999",
      address: "456 New Ave",
    };
    axios.put.mockResolvedValueOnce({
      data: { success: true, updatedUser: mockUpdatedUser },
    });

    renderWithProviders(<Profile />);

    await waitFor(() => expect(screen.getByPlaceholderText(/Enter Your Name/i).value).toBe(mockInitialUser.name));

    fireEvent.change(screen.getByPlaceholderText(/Enter Your Name/i), { target: { value: "Updated Name" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Your Password/i), { target: { value: "newpassword123" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Your Phone/i), { target: { value: "99999999" } });
    fireEvent.change(screen.getByPlaceholderText(/Enter Your Address/i), { target: { value: "456 New Ave" } });

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/auth/profile",
        {
          name: "Updated Name",
          email: "user@example.com",
          password: "newpassword123",
          phone: "99999999",
          address: "456 New Ave",
        }
      );

      expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");

      const updatedStorage = JSON.parse(window.localStorage.getItem("auth"));
      expect(updatedStorage.user.name).toBe("Updated Name");
      expect(updatedStorage.user.phone).toBe("99999999");
      expect(updatedStorage.user.address).toBe("456 New Ave");

      expect(updatedStorage.token).toBe(mockToken);
    });
  });

  it("Profile validation - prevents update when fields are empty (Falsy Fallback Fix)", async () => {
    // Huang Yi Chee, A0259617R

    renderWithProviders(<Profile />);

    await waitFor(() => expect(screen.getByPlaceholderText(/Enter Your Name/i).value).toBe(mockInitialUser.name));

    fireEvent.change(screen.getByPlaceholderText(/Enter Your Name/i), { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(axios.put).not.toHaveBeenCalled();

      expect(toast.error).toHaveBeenCalledWith("Name is required");

      const storage = JSON.parse(window.localStorage.getItem("auth"));
      expect(storage.user.name).toBe(mockInitialUser.name);
    });
  });
});