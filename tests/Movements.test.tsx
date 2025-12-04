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
import Movements from "../src/components/Movements";

const mockIsDesktopDevice = jest.fn();

jest.mock("../src/device", () => ({
  isDesktopDevice: (...args: any[]) => mockIsDesktopDevice(...args),
}));

describe("Movements", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsDesktopDevice.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test("renders nothing when not on desktop", () => {
    mockIsDesktopDevice.mockReturnValue(false);
    const { container, queryByLabelText } = render(<Movements />);
    expect(queryByLabelText(/movements-hero/i)).toBeNull();
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
});
