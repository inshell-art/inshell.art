import React from "react";
import { afterEach, beforeEach, describe, test, expect, jest } from "@jest/globals";
import { fireEvent, render, screen, act, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("react-error-boundary", () => ({
  __esModule: true,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock("../src/components/AuctionCanvas", () => ({
  __esModule: true,
  default: () => <div data-testid="auction-canvas" />,
}));

jest.mock("@inshell/ethereum", () => ({
  __esModule: true,
  getChainId: jest.fn(),
  getCode: jest.fn(async () => "0x"),
  getDefaultProvider: jest.fn(() => ({ request: jest.fn() })),
  hashUtf8String: jest.fn(),
}));

import App from "../src/App";

describe("App Component", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    jest.useRealTimers();
    window.history.pushState({}, "", "/");
  });

  test("initial opacity values", () => {
    render(<App />);
    const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
    projectElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeCloseTo(0.2, 1);
    });

    const yearElements = screen.getAllByText(/First Half 2025|2025|2026/i);
    yearElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeCloseTo(0, 1);
    });
  });

  test("opacity increases on click", () => {
    render(<App />);
    act(() => {
      fireEvent.click(document);
    });
    const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
    projectElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeGreaterThanOrEqual(0.4);
    });
  });

  test("opacity does not exceed maximum limit on multiple clicks", () => {
    render(<App />);
    act(() => {
      for (let i = 0; i < 10; i++) {
        fireEvent.click(document);
      }
    });
    const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
    projectElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeCloseTo(1, 1);
    });
  });

  test("opacity decreases over time", () => {
    jest.useFakeTimers();
    render(<App />);
    act(() => {
      fireEvent.click(document); // Increase opacity first
    });

    act(() => {
      jest.advanceTimersByTime(1000); // Advance time by 1 second
    });

    const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
    projectElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeCloseTo(0.3, 1);
    });

    jest.useRealTimers();
  });

  test("opacity increases with mouse movement", () => {
    render(<App />);
    act(() => {
      fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    });
    const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
    projectElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeGreaterThan(0.2);
    });
  });

  test("year opacity updates correctly based on project opacity", () => {
    render(<App />);
    act(() => {
      for (let i = 0; i < 5; i++) {
        fireEvent.click(document);
      }
    });

    const yearElements = screen.getAllByText(/First Half 2025| 2025| 2026/i);
    yearElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeGreaterThanOrEqual(0.5);
    });
  });

  test("renders the Pulse primitive page on /pulse", () => {
    window.history.pushState({}, "", "/pulse");
    render(<App />);

    expect(document.title).toBe("Pulse");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/pulse.svg");
    expect(screen.getByRole("heading", { name: "pulse" })).toBeInTheDocument();
    expect(screen.getByText("An original pricing sketch for a decentralized automatic auction.")).toBeInTheDocument();
    expect(screen.getByText("Pulse is the pricing primitive behind the current $PATH auction.")).toBeInTheDocument();
    expect(screen.getByText(/A sale pumps the ask upward\./)).toBeInTheDocument();
    expect(screen.getByText(/Silence lets the ask drop\./)).toBeInTheDocument();
    expect(screen.getByText(/During the drop phase, time and price follow an offset constant-product curve\./)).toBeInTheDocument();
    expect(screen.getByText(/The hammer price is sampled at settlement time\./)).toBeInTheDocument();
    expect(screen.getByText(/xy = k/)).toBeInTheDocument();
    expect(screen.getByText(/f\(x\) = k \/ \(x - a\) \+ b/)).toBeInTheDocument();
    expect(screen.getByText(/This is not implementation code\./)).toBeInTheDocument();
    expect(screen.getByText(/It preserves the primitive pricing shape before implementation\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open original Desmos sketch ↗" })).toHaveAttribute(
      "href",
      "https://www.desmos.com/calculator/1d89f93d21",
    );
    expect(screen.getByRole("link", { name: "View source ↗" })).toHaveAttribute(
      "href",
      "https://github.com/inshell-art/pulse",
    );
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
    expect(screen.queryByLabelText("Open Pulse primitive page")).toBeNull();
  });

  test("renders the Color Font primitive page on /color-font", async () => {
    window.history.pushState({}, "", "/color-font");
    render(<App />);

    expect(document.title).toBe("Color Font");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/color-font.svg");
    expect(screen.getByRole("heading", { name: "color font" })).toBeInTheDocument();
    expect(
      screen.getByText("Contract-defined A-Z color glyph system.")
    ).toBeInTheDocument();
    expect(await screen.findByText("INSHELL_COLOR_FONT")).toBeInTheDocument();
    const glyphs = within(await screen.findByLabelText("A-Z color glyph preview"));
    expect(glyphs.getAllByRole("img")).toHaveLength(26);
    expect(glyphs.getByLabelText("A, aqua, #00ffff")).toHaveAttribute(
      "data-label",
      "A:Aqua:#00ffff",
    );
    expect(glyphs.getByLabelText("A, aqua, #00ffff")).not.toHaveAttribute("title");
    expect(glyphs.getByLabelText("Z, zombie gray, #778877")).toHaveAttribute(
      "data-label",
      "Z:Zombie gray:#778877",
    );
    expect(screen.getByText("onchain source unavailable.")).toBeInTheDocument();
    expect(screen.getByText("showing bundled mirror copy.")).toBeInTheDocument();
    expect(screen.getByText("loaded from")).toBeInTheDocument();
    expect(screen.getByText("frontend mirror fallback")).toBeInTheDocument();
    expect(screen.getByText("authority")).toBeInTheDocument();
    expect(screen.getByText("onchain color font ABI unavailable")).toBeInTheDocument();
    expect(screen.getByText("mirror")).toBeInTheDocument();
    expect(screen.getByText("inshell.art color font mirror")).toBeInTheDocument();
    expect(screen.getByText(/A:1:aqua:#00ffff/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open raw color font mapping" })).toHaveAttribute(
      "href",
      expect.stringContaining("data:text/plain;charset=utf-8,"),
    );
    expect(screen.getByRole("link", { name: "Open color font mirror" })).toHaveAttribute(
      "href",
      "https://github.com/inshell-art/inshell.art/blob/try/sparse-live-tail-viewport/apps/home/src/content/colorFont.ts",
    );
    expect(screen.getByRole("link", { name: "Open color font mirror" })).not.toHaveAttribute(
      "href",
      expect.stringContaining("github.com/inshell-art/thought"),
    );
    expect(screen.getByText(/source: frontend mirror fallback/)).toBeInTheDocument();
    expect(screen.getByText(/mirror: inshell\.art color font mirror/)).toBeInTheDocument();
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
    expect(screen.queryByLabelText("Open Color Font primitive page")).toBeNull();
  });

  test("footer links Pulse and color font without facets or hone", () => {
    render(<App />);

    expect(screen.getByLabelText("Open Pulse primitive page")).toHaveAttribute("href", "/pulse");
    expect(screen.getByLabelText("Open Pulse primitive page")).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("Open Color Font primitive page")).toHaveAttribute(
      "href",
      "/color-font",
    );
    expect(screen.getByLabelText("Open Color Font primitive page")).toHaveAttribute("target", "_blank");
    expect(screen.queryByLabelText("Open facets")).toBeNull();
    expect(screen.queryByLabelText("Open hone")).toBeNull();
  });
});
