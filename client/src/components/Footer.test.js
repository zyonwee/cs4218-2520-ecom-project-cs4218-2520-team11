import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Footer from "./Footer";

describe("Footer", () => {
  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders the footer copyright text and navigation links", () => {
    // Arrange
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    // Act
    const about = screen.getByRole("link", { name: /about/i });
    const contact = screen.getByRole("link", { name: /contact/i });
    const policy = screen.getByRole("link", { name: /privacy policy/i });

    // Assert
    expect(
      screen.getByText(/all rights reserved/i)
    ).toHaveTextContent("All Rights Reserved © TestingComp");
    expect(about).toHaveAttribute("href", "/about");
    expect(contact).toHaveAttribute("href", "/contact");
    expect(policy).toHaveAttribute("href", "/policy");
  });
});
