import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Header from "./Header";
import { useAuth } from "../context/auth";
import { useCart } from "../context/cart";
import useCategory from "../hooks/useCategory";
import toast from "react-hot-toast";

jest.mock("../context/auth", () => ({
  __esModule: true,
  useAuth: jest.fn(),
}));

jest.mock("../context/cart", () => ({
  __esModule: true,
  useCart: jest.fn(),
}));

jest.mock("../hooks/useCategory", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("./Form/SearchInput", () => ({
  __esModule: true,
  default: () => <div data-testid="search-input">Search Input</div>,
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
  },
}));

jest.mock("antd", () => ({
  Badge: ({ count, children }) => (
    <div data-testid="cart-badge" data-count={count}>
      {children}
    </div>
  ),
}));

describe("Header", () => {
  let setAuth;
  let removeItemSpy;

  beforeEach(() => {
    setAuth = jest.fn();
    removeItemSpy = jest.spyOn(Storage.prototype, "removeItem");

    useCart.mockReturnValue([[{ _id: "cart-1" }, { _id: "cart-2" }]]);
    useCategory.mockReturnValue([
      { _id: "1", name: "Phones", slug: "phones" },
      { _id: "2", name: "Laptops", slug: "laptops" },
    ]);

    jest.clearAllMocks();
  });

  afterEach(() => {
    removeItemSpy.mockRestore();
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders guest navigation, category links, and cart count", () => {
    // Arrange
    useAuth.mockReturnValue([{}, setAuth]);

    // Act
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByRole("link", { name: /virtual vault/i })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /register/i })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(screen.getByRole("link", { name: /login/i })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.getByRole("link", { name: /all categories/i })
    ).toHaveAttribute("href", "/categories");
    expect(screen.getByRole("link", { name: "Phones" })).toHaveAttribute(
      "href",
      "/category/phones"
    );
    expect(screen.getByRole("link", { name: "Laptops" })).toHaveAttribute(
      "href",
      "/category/laptops"
    );
    expect(screen.getByTestId("cart-badge")).toHaveAttribute("data-count", "2");
    expect(screen.getByRole("link", { name: /cart/i })).toHaveAttribute(
      "href",
      "/cart"
    );
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders authenticated admin navigation with the dashboard link", () => {
    // Arrange
    useAuth.mockReturnValue([
      { user: { name: "Admin User", role: 1 }, token: "token" },
      setAuth,
    ]);

    // Act
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByRole("button", { name: "Admin User" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "href",
      "/dashboard/admin"
    );
    expect(screen.queryByRole("link", { name: /register/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^login$/i })).not.toBeInTheDocument();
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("clears auth state and shows a toast when logout is clicked", () => {
    // Arrange
    const auth = { user: { name: "Alice", role: 0 }, token: "secret-token" };
    useAuth.mockReturnValue([auth, setAuth]);

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    // Act
    fireEvent.click(screen.getByRole("link", { name: /logout/i }));

    // Assert
    expect(setAuth).toHaveBeenCalledWith({
      ...auth,
      user: null,
      token: "",
    });
    expect(removeItemSpy).toHaveBeenCalledWith("auth");
    expect(toast.success).toHaveBeenCalledWith("Logout Successfully");
  });
});
