// Gabriel Seethor, A0257008H
import React from "react";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import ProductDetails from "./ProductDetails";
import HomePage from "./HomePage";
import { mock } from "node:test";
import Register from "./Auth/Register";
import Login from "./Auth/Login";
import CartPage from "./CartPage";

jest.mock("axios");

jest.mock("../context/auth", () => ({
  useAuth: jest.fn(() => [null, jest.fn()]),
}));

jest.mock("../context/cart", () => ({
  useCart: jest.fn(() => [null, jest.fn()]),
}));

jest.mock("../context/search", () => ({
  useSearch: jest.fn(() => [{ keyword: "" }, jest.fn()]),
}));

jest.mock("../hooks/useCategory", () => ({
  __esModule: true,
  default: jest.fn(() => [
    [
      { _id: "cat1", name: "Electronics", slug: "electronics" },
      { _id: "cat2", name: "Books", slug: "books" },
      { _id: "cat3", name: "Clothing", slug: "clothing" },
    ],
    jest.fn(),
  ]),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

// Gabriel Seethor, A0257008H
describe("Home Page Component/ View Product List", () => {
  const mockProduct = {
    _id: "123",
    name: "Test Product",
    description: "Test Description",
    price: 100,
    category: { _id: "cat1", name: "Electronics" },
    slug: "test-product",
  };

  const mockProductList = Array.from({ length: 10 }, (_, i) => ({
    _id: `prod${i}`,
    name: `Test Product ${i}`,
    description: `Test Description ${i}`,
    price: 100 + i,
    category: { _id: "cat1", name: "Electronics" },
    slug: `test-product-${i}`,
  }));

  const mockSimilarProducts = [
    {
      _id: "456",
      name: "Similar Product",
      description: "Similar Description",
      price: 150,
      slug: "similar-product",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("navigation to Register Page works", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </MemoryRouter>,
    );

    const registerButton = screen.getByText(/register/i);
    fireEvent.click(registerButton);
    expect(screen.getByText("REGISTER FORM")).toBeInTheDocument();
  });

  it("navigation to Login Page works", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );

    const loginButton = screen.getByText(/login/i);
    fireEvent.click(loginButton);
    expect(screen.getByText("LOGIN FORM")).toBeInTheDocument();
  });

  it("navigation to Cart Page works", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cart" element={<CartPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const cartButton = screen.getByText(/cart/i);
    fireEvent.click(cartButton);
    expect(screen.getByText(/cart summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Hello Guest/i)).toBeInTheDocument();
  });
});
