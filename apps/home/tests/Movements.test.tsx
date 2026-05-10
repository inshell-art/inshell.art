import React from "react";
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Movements from "../src/components/Movements";

const mockIsDesktopDevice = jest.fn();

jest.mock("@inshell/utils", () => ({
  isDesktopDevice: (...args: any[]) => mockIsDesktopDevice(...args),
}));

describe("Movements", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (globalThis as any).__VITE_ENV__ = {
      NODE_ENV: "test",
    };
    mockIsDesktopDevice.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (globalThis as any).__VITE_ENV__;
  });

  test("renders nothing when not on desktop", () => {
    mockIsDesktopDevice.mockReturnValue(false);
    const { container, queryByLabelText } = render(<Movements />);
    expect(queryByLabelText(/Movements/i)).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  test("opacity ticks toward baseline over time", () => {
    const { getAllByText } = render(<Movements />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const projectElements = getAllByText(/THOUGHT|WILL|AWA!/i);
    projectElements.forEach((el) => {
      expect(parseFloat(el.style.opacity)).toBeGreaterThan(0);
    });
  });

  test("links THOUGHT to the configured thought app in a new tab", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_THOUGHT_URL: "http://127.0.0.1:5174/",
    };
    const { getByRole } = render(<Movements />);
    const link = getByRole("link", { name: "THOUGHT" });
    expect(link).toHaveAttribute("href", "http://127.0.0.1:5174/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("renders THOUGHT as text when no production URL is configured", () => {
    (globalThis as any).__VITE_ENV__ = {
      MODE: "production",
      NODE_ENV: "production",
    };
    const { queryByRole, getByText } = render(<Movements />);
    expect(getByText("THOUGHT")).toBeTruthy();
    expect(queryByRole("link", { name: "THOUGHT" })).toBeNull();
  });

  test("does not render a year above THOUGHT", () => {
    const { queryByText, getByText } = render(<Movements />);
    expect(getByText("THOUGHT")).toBeTruthy();
    expect(queryByText(/in 2026/i)).toBeNull();
  });
});
