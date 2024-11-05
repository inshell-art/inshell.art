import { fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../src/App";

describe("App Component", () => {
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
});
