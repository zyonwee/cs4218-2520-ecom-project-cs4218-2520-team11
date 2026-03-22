import React from "react";
import { render, screen } from "@testing-library/react";
import About from "./About";

jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children, title }) => (
    <div>
      <div data-testid="layout-title">{title}</div>
      {children}
    </div>
  ),
}));

describe("About", () => {
  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders the about page content inside the layout", () => {
    // Arrange
    render(<About />);

    // Act
    const title = screen.getByTestId("layout-title");
    const image = screen.getByAltText(/contactus/i);
    const description = screen.getByText(/add text/i);

    // Assert
    expect(title).toHaveTextContent("About us - Ecommerce app");
    expect(image).toHaveAttribute("src", "/images/about.jpeg");
    expect(description).toBeInTheDocument();
  });
});
