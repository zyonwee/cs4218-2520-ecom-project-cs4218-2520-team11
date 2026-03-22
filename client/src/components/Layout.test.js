import React from "react";
import { render, screen } from "@testing-library/react";
import Layout from "./Layout";

jest.mock("./Header", () => ({
  __esModule: true,
  default: () => <div data-testid="header">Header</div>,
}));

jest.mock("./Footer", () => ({
  __esModule: true,
  default: () => <div data-testid="footer">Footer</div>,
}));

jest.mock("react-hot-toast", () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

jest.mock("react-helmet", () => ({
  Helmet: ({ children }) => <>{children}</>,
}));

describe("Layout", () => {
  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders header footer toaster and children with custom metadata", async () => {
    // Arrange
    const { container } = render(
      <Layout
        title="Custom Title"
        description="Custom description"
        keywords="alpha,beta"
        author="Zyon"
      >
        <div>Body Content</div>
      </Layout>
    );

    // Act
    const title = container.querySelector("title");
    const description = container.querySelector('meta[name="description"]');
    const keywords = container.querySelector('meta[name="keywords"]');
    const author = container.querySelector('meta[name="author"]');

    // Assert
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
    expect(screen.getByText("Body Content")).toBeInTheDocument();
    expect(title).toHaveTextContent("Custom Title");
    expect(description).toHaveAttribute("content", "Custom description");
    expect(keywords).toHaveAttribute("content", "alpha,beta");
    expect(author).toHaveAttribute("content", "Zyon");
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("falls back to the component default metadata", () => {
    // Arrange
    const { container } = render(
      <Layout>
        <div>Defaults</div>
      </Layout>
    );

    // Act
    const title = container.querySelector("title");
    const description = container.querySelector('meta[name="description"]');
    const keywords = container.querySelector('meta[name="keywords"]');
    const author = container.querySelector('meta[name="author"]');

    // Assert
    expect(title).toHaveTextContent("Ecommerce app - shop now");
    expect(description).toHaveAttribute("content", "mern stack project");
    expect(keywords).toHaveAttribute("content", "mern,react,node,mongodb");
    expect(author).toHaveAttribute("content", "Techinfoyt");
  });
});
