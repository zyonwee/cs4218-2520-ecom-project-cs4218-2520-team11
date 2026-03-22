// Gabriel Seethor, A0257008H
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import ProductDetails from "../pages/ProductDetails";
import CartPage from "../pages/CartPage";
import { CartProvider } from "../context/cart";
import { AuthProvider } from "../context/auth";
import Header from "../components/Header";

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

const mockProduct = {
  _id: "prod_001",
  name: "Wireless Headphones",
  description: "Premium noise-cancelling headphones with 30h battery life.",
  price: 149.99,
  quantity: 5,
  slug: "wireless-headphones",
  category: { _id: "cat_001", name: "Electronics" },
};

const outOfStockProduct = {
  ...mockProduct,
  _id: "prod_002",
  quantity: 0,
  slug: "sold-out-speaker",
};

const mockAuthUser = {
  token: "mock-jwt-token",
  user: { name: "Jane Doe", email: "jane@example.com", address: "123 Main St" },
};

const setupAxiosMocks = (product = mockProduct) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("get-product"))
      return Promise.resolve({ data: { product } });
    if (url.includes("related-product"))
      return Promise.resolve({ data: { products: [] } });
    if (url.includes("braintree/token"))
      return Promise.resolve({ data: { clientToken: "token_abc" } });
    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });
};

const renderProductDetail = (slug = mockProduct.slug) =>
  render(
    <MemoryRouter initialEntries={[`/product/${slug}`]}>
      <AuthProvider initialValue={mockAuthUser}>
        <CartProvider>
          <Routes>
            <Route path="/product/:slug" element={<ProductDetails />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

const renderCartPage = () =>
  render(
    <MemoryRouter initialEntries={["/cart"]}>
      <AuthProvider initialValue={mockAuthUser}>
        <CartProvider>
          <Routes>
            <Route path="/cart" element={<CartPage />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

const seedCart = (items) => localStorage.setItem("cart", JSON.stringify(items));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe("Product Detail Shopping Cart Integration", () => {
  it("renders product name, price and category from API", async () => {
    setupAxiosMocks();
    renderProductDetail();

    await waitFor(() =>
      expect(screen.getByText(/Wireless Headphones/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/\$149\.99/i)).toBeInTheDocument();
    expect(screen.getByText(/Electronics/i)).toBeInTheDocument();
  });

  it("renders product image with correct src and alt", async () => {
    setupAxiosMocks();
    renderProductDetail();

    const img = await screen.findByAltText("Wireless Headphones");
    expect(img).toBeInTheDocument();
    expect(img.src).toContain(
      `/api/v1/product/product-photo/${mockProduct._id}`,
    );
  });

  it("adds product to localStorage after clicking Add to Cart", async () => {
    setupAxiosMocks();
    renderProductDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: /add to cart/i }),
    );

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("cart") || "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0]._id).toBe(mockProduct._id);
    });
  });

  it("shows success toast after adding an in-stock item", async () => {
    setupAxiosMocks();
    renderProductDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: /ADD TO CART/i }),
    );

    // Wait for the async onClick to complete before asserting
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Item Added to cart");
    });
  });

  it(" cart counter badge in nav does NOT update after add", async () => {
    setupAxiosMocks();
    renderProductDetail();

    fireEvent.click(
      await screen.findByRole("button", { name: /add to cart/i }),
    );

    await waitFor(() => {
      const badge = screen.queryByTestId("cart-count-badge");
      expect(badge).not.toBeNull();
      expect(badge).toHaveTextContent("1");
    });
  });

  it("shows OUT OF STOCK label and disables button when quantity is 0", async () => {
    setupAxiosMocks(outOfStockProduct);
    renderProductDetail(outOfStockProduct.slug);

    const btn = await screen.findByRole("button", { name: /out of stock/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it(" disables Add to Cart when cart already holds max available quantity", async () => {
    seedCart(Array(mockProduct.quantity).fill(mockProduct));
    setupAxiosMocks();
    renderProductDetail();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /out of stock/i }),
      ).toBeDisabled(),
    );
  });

  it(" does not add item to localStorage when product is out of stock", async () => {
    setupAxiosMocks(outOfStockProduct);
    renderProductDetail(outOfStockProduct.slug);

    fireEvent.click(
      await screen.findByRole("button", { name: /out of stock/i }),
    );

    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    expect(stored).toHaveLength(0);
  });

  it(" cart page renders correct product name, price and image", async () => {
    seedCart([mockProduct]);
    axios.get.mockResolvedValue({ data: { clientToken: "token_abc" } });
    renderCartPage();

    await waitFor(() =>
      expect(screen.getByText("Wireless Headphones")).toBeInTheDocument(),
    );

    expect(screen.getByAltText("Wireless Headphones").src).toContain(
      `/api/v1/product/product-photo/${mockProduct._id}`,
    );
  });

  it(" subtotal reflects the correct total price of cart items", async () => {
    seedCart([mockProduct]);
    axios.get.mockResolvedValue({ data: { clientToken: "token_abc" } });
    renderCartPage();

    await waitFor(() =>
      expect(screen.getByText(/\$149\.99/)).toBeInTheDocument(),
    );
  });

  it(" subtotal recalculates instantly after removing an item (no API call needed)", async () => {
    const secondItem = {
      ...mockProduct,
      _id: "prod_003",
      name: "Earbuds",
      price: 89.99,
    };
    seedCart([mockProduct, secondItem]);
    axios.get.mockResolvedValue({ data: { clientToken: "token_abc" } });
    renderCartPage();

    await waitFor(() => screen.getAllByRole("button", { name: /remove/i }));

    axios.get.mockRejectedValue(new Error("Should not call API for subtotal"));

    fireEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);

    expect(screen.getByText(/\$89\.99/i)).toBeInTheDocument();
  });

  it(" does not exceed stock limit under rapid repeated clicks", async () => {
    setupAxiosMocks({ ...mockProduct, quantity: 1 });
    renderProductDetail();

    const btn = await screen.findByRole("button", { name: /add to cart/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    const stored = JSON.parse(localStorage.getItem("cart") || "[]");
    expect(stored.length).toBeLessThanOrEqual(1);
  });

  it("handles API failure on product fetch without crashing", async () => {
    axios.get.mockRejectedValue(new Error("Network Error"));

    expect(() => renderProductDetail()).not.toThrow();
    await waitFor(() =>
      expect(screen.queryByText("Wireless Headphones")).not.toBeInTheDocument(),
    );
  });
});
