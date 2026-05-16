import React from "react";
import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { fireEvent, render } from "@testing-library/react";
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

  test("keeps launch years hidden until the matching movement is hovered", () => {
    const { getAllByText } = render(<Movements />);
    const will = getAllByText("WILL")[0] as HTMLElement;
    const willCell = will.closest(".movements__cell") as HTMLElement;
    const willYear = getAllByText(/2027/i)[0] as HTMLElement;
    const awaYear = getAllByText(/2028/i)[0] as HTMLElement;

    expect(willYear.style.opacity).toBe("0");
    expect(awaYear.style.opacity).toBe("0");

    fireEvent.mouseEnter(willCell);
    expect(willYear.style.opacity).toBe("0");

    fireEvent.mouseEnter(will);
    expect(willYear.style.opacity).toBe("1");
    expect(awaYear.style.opacity).toBe("0");

    fireEvent.mouseLeave(will);
    expect(willYear.style.opacity).toBe("0");
  });

  test("does not reveal launch years from global mouse movement", () => {
    const { getAllByText } = render(<Movements />);
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
    const yearElements = getAllByText(/2027|2028/i);
    yearElements.forEach((el) => {
      expect((el as HTMLElement).style.opacity).toBe("0");
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
