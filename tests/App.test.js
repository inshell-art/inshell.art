import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../src/App";
describe("App Component", () => {
    test("initial opacity values", () => {
        render(_jsx(App, {}));
        const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
        projectElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeCloseTo(0.2, 1);
        });
        const yearElements = screen.getAllByText(/In 2024|In 2025|In 2026/i);
        yearElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeCloseTo(0, 1);
        });
    });
    test("opacity increases on click", () => {
        render(_jsx(App, {}));
        act(() => {
            fireEvent.click(document);
        });
        const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
        projectElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeGreaterThanOrEqual(0.4);
        });
    });
    test("opacity does not exceed maximum limit on multiple clicks", () => {
        render(_jsx(App, {}));
        act(() => {
            for (let i = 0; i < 10; i++) {
                fireEvent.click(document);
            }
        });
        const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
        projectElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeCloseTo(1, 1);
        });
    });
    test("opacity decreases over time", () => {
        jest.useFakeTimers();
        render(_jsx(App, {}));
        act(() => {
            fireEvent.click(document); // Increase opacity first
        });
        act(() => {
            jest.advanceTimersByTime(1000); // Advance time by 1 second
        });
        const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
        projectElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeCloseTo(0.3, 1);
        });
        jest.useRealTimers();
    });
    test("opacity increases with mouse movement", () => {
        render(_jsx(App, {}));
        act(() => {
            fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });
        });
        const projectElements = screen.getAllByText(/THOUGHT|WILL|AWA!/i);
        projectElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeGreaterThan(0.2);
        });
    });
    test("year opacity updates correctly based on project opacity", () => {
        render(_jsx(App, {}));
        act(() => {
            for (let i = 0; i < 5; i++) {
                fireEvent.click(document);
            }
        });
        const yearElements = screen.getAllByText(/In 2024|In 2025|In 2026/i);
        yearElements.forEach((element) => {
            expect(parseFloat(element.style.opacity)).toBeGreaterThanOrEqual(0.5);
        });
    });
});
