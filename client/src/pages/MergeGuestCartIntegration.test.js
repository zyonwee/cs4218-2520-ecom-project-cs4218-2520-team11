// Gabriel Seethor, A0257008H
import { render, screen, waitFor } from "@testing-library/react";
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
  token: "",
  user: null,
};

jest.mock("../context/auth", () => ({
  useAuth: () => [mockAuthState, jest.fn()],
  AuthProvider: ({ children }) => <>{children}</>,
}));

jest.mock("braintree-web-drop-in-react", () => ({ onInstance }) => {
  const { useEffect } = require("react");
  useEffect(() => {
    onInstance({ requestPaymentMethod: jest.fn() });
  }, []);
  return <div data-testid="braintree-dropin" />;
});

const productA = {
  _id: "prod_001",
  name: "Wireless Headphones",
  description: "Noise-cancelling headphones.",
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

const seedGuestCart = (items) =>
  localStorage.setItem("cart", JSON.stringify(items));

const simulateLogin = () => {
  mockAuthState.token = "mock-jwt-token";
  mockAuthState.user = {
    name: "Jane Doe",
    email: "jane@example.com",
    address: "123 Main St, Singapore",
  };
};

const simulateLogout = () => {
  mockAuthState.token = "";
  mockAuthState.user = null;
};

const renderCartPage = () =>
  render(
    <MemoryRouter initialEntries={["/cart"]}>
      <CartProvider>
        <Routes>
          <Route path="/cart" element={<CartPage />} />
        </Routes>
      </CartProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  simulateLogout();
  axios.get.mockResolvedValue({ data: { clientToken: "token_abc" } });
});

afterEach(() => {
  localStorage.clear();
  simulateLogout();
});

describe("Integration | Guest Cart → Login → Cart Merge", () => {
  it("guest sees login prompt instead of checkout button", async () => {
    seedGuestCart([productA]);

    renderCartPage();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /please login to checkout/i }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /make payment/i }),
    ).not.toBeInTheDocument();
  });

  it("guest cart is stored in localStorage before login", () => {
    seedGuestCart([productA, productB]);

    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    expect(stored).toHaveLength(2);
    expect(stored.map((i) => i._id)).toContain(productA._id);
    expect(stored.map((i) => i._id)).toContain(productB._id);
  });

  it(" guest cart greeting shows correct unauthenticated message", async () => {
    seedGuestCart([productA]);

    renderCartPage();

    await waitFor(() =>
      expect(screen.getByText(/hello guest/i)).toBeInTheDocument(),
    );
  });

  it("cart greeting changes from guest to user name after login", async () => {
    seedGuestCart([productA]);

    const { unmount } = renderCartPage();
    await waitFor(() =>
      expect(screen.getByText(/hello guest/i)).toBeInTheDocument(),
    );

    unmount();
    simulateLogin();
    renderCartPage();

    await waitFor(() =>
      expect(screen.getByText(/hello.*jane doe/i)).toBeInTheDocument(),
    );
  });

  it(" localStorage cart survives the login transition unchanged", () => {
    seedGuestCart([productA, productB]);
    simulateLogin();

    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0]._id).toBe(productA._id);
    expect(stored[1]._id).toBe(productB._id);
  });

  it(" same product added twice by guest appears as two entries in localStorage", () => {
    seedGuestCart([productA, productA]);

    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    expect(stored).toHaveLength(2);
    expect(stored.every((i) => i._id === productA._id)).toBe(true);
  });

  it("merged cart subtotal after login matches the guest cart total", async () => {
    seedGuestCart([productA, productB]);
    simulateLogin();

    renderCartPage();

    await waitFor(() =>
      expect(screen.getByText(/\$239\.98/i)).toBeInTheDocument(),
    );
  });
});
