// Gabriel Seethor, A0257008H
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import CartPage from "../pages/CartPage";
import { CartProvider } from "../context/cart";

jest.mock("axios");
jest.mock("react-hot-toast", () => ({ success: jest.fn(), error: jest.fn() }));

jest.mock("../components/Layout", () => {
  const { useCart } = require("../context/cart");
  function MockHeader() {
    const [cart] = useCart();
    return (
      <nav>
        <span data-testid="cart-count-badge">{cart?.length ?? 0}</span>
      </nav>
    );
  }
  return ({ children }) => (
    <div>
      <MockHeader />
      {children}
    </div>
  );
});

const mockAuthState = {
  token: "mock-jwt-token",
  user: {
    name: "Jane Doe",
    email: "jane@example.com",
    address: "123 Main St, Singapore",
  },
};

jest.mock("../context/auth", () => ({
  useAuth: () => [mockAuthState, jest.fn()],
  AuthProvider: ({ children }) => <>{children}</>,
}));

const mockRequestPaymentMethod = jest.fn();
jest.mock("braintree-web-drop-in-react", () => ({ onInstance }) => {
  const { useEffect } = require("react");
  useEffect(() => {
    onInstance({ requestPaymentMethod: mockRequestPaymentMethod });
  }, []);
  return <div data-testid="braintree-dropin" />;
});

const MockOrdersPage = () => <div data-testid="orders-page">Orders</div>;

const productA = {
  _id: "prod_001",
  name: "Wireless Headphones",
  description: "Premium noise-cancelling headphones.",
  price: 149.99,
  quantity: 5,
  slug: "wireless-headphones",
  category: { _id: "cat_001", name: "Electronics" },
};

const productB = {
  _id: "prod_002",
  name: "Mechanical Keyboard",
  description: "Tactile switches, RGB backlit.",
  price: 89.99,
  quantity: 3,
  slug: "mechanical-keyboard",
  category: { _id: "cat_001", name: "Electronics" },
};

const renderCartPage = (cartItems = [productA]) => {
  localStorage.setItem("cart", JSON.stringify(cartItems));
  return render(
    <MemoryRouter initialEntries={["/cart"]}>
      <CartProvider>
        <Routes>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/dashboard/user/orders" element={<MockOrdersPage />} />
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  axios.get.mockResolvedValue({ data: { clientToken: "sandbox_token_abc" } });
});

afterEach(() => {
  localStorage.clear();
  mockAuthState.user.address = "123 Main St, Singapore";
});

describe("Integration | Cart → Checkout / Payment", () => {
  it("cart displays correct product name and price before checkout", async () => {
    renderCartPage([productA]);

    await waitFor(() =>
      expect(screen.getByText("Wireless Headphones")).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/149\.99/)[0]).toBeInTheDocument();
  });

  it("cart displays all items when multiple products are added", async () => {
    renderCartPage([productA, productB]);

    await waitFor(() => {
      expect(screen.getByText("Wireless Headphones")).toBeInTheDocument();
      expect(screen.getByText("Mechanical Keyboard")).toBeInTheDocument();
    });
  });

  it("order summary subtotal matches sum of all cart item prices", async () => {
    renderCartPage([productA, productB]);

    await waitFor(() =>
      expect(screen.getByText(/\$239\.98/i)).toBeInTheDocument(),
    );
  });

  it("order summary subtotal updates correctly after removing an item", async () => {
    renderCartPage([productA, productB]);

    await waitFor(() =>
      expect(screen.getByText(/\$239\.98/i)).toBeInTheDocument(),
    );

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    await waitFor(() =>
      expect(screen.getByText(/\$89\.99/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/\$239\.98/i)).not.toBeInTheDocument();
  });

  it("correct item count is shown in the cart header greeting", async () => {
    renderCartPage([productA, productB]);

    await waitFor(() =>
      expect(
        screen.getByText(/you have 2 items in your cart/i),
      ).toBeInTheDocument(),
    );
  });

  it("Make Payment button is visible when user has token, address and items", async () => {
    renderCartPage([productA]);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /make payment/i }),
      ).toBeInTheDocument(),
    );
  });

  it("checkout (Make Payment button) is NOT shown when cart is empty", async () => {
    renderCartPage([]);

    await waitFor(() =>
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /make payment/i }),
    ).not.toBeInTheDocument();
  });

  it(" Braintree DropIn is not rendered when cart is empty", async () => {
    renderCartPage([]);

    await waitFor(() =>
      expect(screen.queryByTestId("braintree-dropin")).not.toBeInTheDocument(),
    );
  });

  it("successful payment clears the cart and navigates to orders page", async () => {
    mockRequestPaymentMethod.mockResolvedValue({ nonce: "fake-nonce-abc" });
    axios.post.mockResolvedValue({ data: { success: true } });

    renderCartPage([productA]);

    const payBtn = await screen.findByRole("button", { name: /make payment/i });
    fireEvent.click(payBtn);

    await waitFor(() =>
      expect(screen.getByTestId("orders-page")).toBeInTheDocument(),
    );

    expect(JSON.parse(localStorage.getItem("cart") || "[]")).toHaveLength(0);
  });

  it("successful payment shows success toast", async () => {
    mockRequestPaymentMethod.mockResolvedValue({ nonce: "fake-nonce-abc" });
    axios.post.mockResolvedValue({ data: { success: true } });

    renderCartPage([productA]);

    const payBtn = await screen.findByRole("button", { name: /make payment/i });
    fireEvent.click(payBtn);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Payment Completed Successfully ",
      ),
    );
  });

  it(" Make Payment button shows loading state while processing", async () => {
    mockRequestPaymentMethod.mockReturnValue(new Promise(() => {}));
    renderCartPage([productA]);

    const payBtn = await screen.findByRole("button", { name: /make payment/i });
    fireEvent.click(payBtn);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /processing/i }),
      ).toBeInTheDocument(),
    );
  });
});
