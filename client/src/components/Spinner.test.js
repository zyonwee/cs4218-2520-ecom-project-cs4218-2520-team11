import React from "react";
import { act, render, screen } from "@testing-library/react";
import Spinner from "./Spinner";

const mockNavigate = jest.fn();
const mockLocation = { pathname: "/protected" };

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

describe("Spinner", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("renders the countdown message before redirecting", () => {
    // Arrange
    render(<Spinner />);

    // Act
    const message = screen.getByRole("heading", {
      name: /redirecting to you in 3 second/i,
    });

    // Assert
    expect(message).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("redirects to the default login path with the current location as state", () => {
    // Arrange
    render(<Spinner />);

    // Act
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      state: "/protected",
    });
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("redirects to the provided custom path", () => {
    // Arrange
    render(<Spinner path="dashboard" />);

    // Act
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard", {
      state: "/protected",
    });
  });
});
