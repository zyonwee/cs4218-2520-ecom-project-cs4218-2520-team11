// Antony Swami Alfred Ben, A0253016R
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import Search from "./Search";

// Antony Swami Alfred Ben, A0253016R — mock dependencies
jest.mock("../context/auth", () => ({
    useAuth: jest.fn(() => [null, jest.fn()]),
}));

jest.mock("../context/cart", () => ({
    useCart: jest.fn(() => [null, jest.fn()]),
}));

const mockSetValues = jest.fn();
let mockSearchValues = { keyword: "", results: [] };

// Antony Swami Alfred Ben, A0253016R — mock search context
jest.mock("../context/search", () => ({
    useSearch: jest.fn(() => [mockSearchValues, mockSetValues]),
}));

// Antony Swami Alfred Ben, A0253016R — mock Layout
jest.mock("../components/Layout", () => {
    return function MockLayout({ children, title }) {
        return (
            <div data-testid="layout" data-title={title}>
                {children}
            </div>
        );
    };
});

Object.defineProperty(window, "localStorage", {
    value: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
    },
    writable: true,
});

window.matchMedia =
    window.matchMedia ||
    function () {
        return {
            matches: false,
            addListener: function () { },
            removeListener: function () { },
        };
    };

const { useSearch } = require("../context/search");

// Antony Swami Alfred Ben, A0253016R — test suite
describe("Search Results Page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Antony Swami Alfred Ben, A0253016R
    it('should display "No Products Found" when results array is empty', () => {
        useSearch.mockReturnValue([{ keyword: "laptop", results: [] }, mockSetValues]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByText("No Products Found")).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it('should display "Found {count}" when results exist', () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                description: "A powerful laptop for all purposes",
                price: 999,
            },
            {
                _id: "2",
                name: "Phone",
                description: "A smartphone with great camera quality",
                price: 699,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "electronics", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByText("Found 2")).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should render product names", () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Gaming Laptop",
                description: "High performance gaming laptop with RTX",
                price: 1499,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "gaming", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByText("Gaming Laptop")).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should truncate product description to 30 characters", () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                description: "This is a long description that should be truncated after thirty chars",
                price: 999,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "laptop", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        const truncated = "This is a long description tha...";
        expect(screen.getByText(truncated)).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should render product price with $ prefix", () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                description: "A great laptop for productivity",
                price: 999,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "laptop", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(
            screen.getByText((content, element) =>
                element?.tagName === "P" &&
                /\$/.test(content) &&
                /999/.test(content)
            )
        ).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should render product images with correct src URL", () => {
        const mockProducts = [
            {
                _id: "abc123",
                name: "Laptop",
                description: "A laptop for daily use and more",
                price: 999,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "laptop", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        const img = screen.getByAltText("Laptop");
        expect(img).toHaveAttribute(
            "src",
            "/api/v1/product/product-photo/abc123"
        );
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should render product images with alt text matching product name", () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Wireless Mouse",
                description: "Ergonomic wireless mouse design",
                price: 29,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "mouse", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByAltText("Wireless Mouse")).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it('should render "More Details" button for each product', () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                description: "A laptop with amazing features!",
                price: 999,
            },
            {
                _id: "2",
                name: "Phone",
                description: "Smartphone with high resolution",
                price: 699,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "electronics", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        const moreDetailsButtons = screen.getAllByText("More Details");
        expect(moreDetailsButtons).toHaveLength(2);
    });

    // Antony Swami Alfred Ben, A0253016R
    it('should render "ADD TO CART" button for each product', () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                description: "Portable laptop for travelling",
                price: 999,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "laptop", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByText("ADD TO CART")).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should render Layout with title 'Search results'", () => {
        useSearch.mockReturnValue([{ keyword: "", results: [] }, mockSetValues]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        const layout = screen.getByTestId("layout");
        expect(layout).toHaveAttribute("data-title", "Search results");
    });

    // Antony Swami Alfred Ben, A0253016R
    it('should render the "Search Results" heading text', () => {
        useSearch.mockReturnValue([{ keyword: "", results: [] }, mockSetValues]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByText("Search Results")).toBeInTheDocument();
    });

    // Antony Swami Alfred Ben, A0253016R
    it("should render multiple products correctly", () => {
        const mockProducts = [
            {
                _id: "1",
                name: "Product A",
                description: "Description for product A here",
                price: 100,
            },
            {
                _id: "2",
                name: "Product B",
                description: "Description for product B here",
                price: 200,
            },
            {
                _id: "3",
                name: "Product C",
                description: "Description for product C here",
                price: 300,
            },
        ];

        useSearch.mockReturnValue([
            { keyword: "product", results: mockProducts },
            mockSetValues,
        ]);

        render(
            <MemoryRouter>
                <Search />
            </MemoryRouter>
        );

        expect(screen.getByText("Found 3")).toBeInTheDocument();
        expect(screen.getByText("Product A")).toBeInTheDocument();
        expect(screen.getByText("Product B")).toBeInTheDocument();
        expect(screen.getByText("Product C")).toBeInTheDocument();
    });
});
