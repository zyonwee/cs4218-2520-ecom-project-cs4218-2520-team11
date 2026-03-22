import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Pagenotfound from "./Pagenotfound";

jest.mock("../components/Layout", () => ({
  __esModule: true,
  default: ({ children, title }) => (
    <div>
      <div data-testid="layout-title">{title}</div>
      {children}
    </div>
  ),
}));

describe("Pagenotfound", () => {
  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders the 404 message and a link back home", () => {
    // Arrange
    render(
      <MemoryRouter>
        <Pagenotfound />
      </MemoryRouter>
    );

    // Act
    const title = screen.getByTestId("layout-title");
    const statusCode = screen.getByRole("heading", { name: "404" });
    const heading = screen.getByRole("heading", { name: /oops ! page not found/i });
    const goBack = screen.getByRole("link", { name: /go back/i });

    // Assert
    expect(title).toHaveTextContent("go back- page not found");
    expect(statusCode).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
    expect(goBack).toHaveAttribute("href", "/");
  });
});
