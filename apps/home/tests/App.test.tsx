import React from "react";
import { TextEncoder } from "node:util";
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
import { COLOR_FONT, COLOR_FONT_RAW } from "../src/content/colorFont";
import {
  getChainId,
  getCode,
  getDefaultProvider,
  hashUtf8String,
} from "@inshell/ethereum";

const mockedGetChainId = getChainId as jest.MockedFunction<typeof getChainId>;
const mockedGetCode = getCode as jest.MockedFunction<typeof getCode>;
const mockedGetDefaultProvider = getDefaultProvider as jest.MockedFunction<
  typeof getDefaultProvider
>;
const mockedHashUtf8String = hashUtf8String as jest.MockedFunction<
  typeof hashUtf8String
>;

function bytesToHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function wordHex(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function encodeAbiString(value: string): string {
  const data = bytesToHex(new TextEncoder().encode(value));
  const paddedData = data.padEnd(Math.ceil(data.length / 64) * 64, "0");
  return `0x${wordHex(32n)}${wordHex(BigInt(data.length / 2))}${paddedData}`;
}

function defaultRpcProvider() {
  return { request: jest.fn(async () => "0x") };
}

describe("App Component", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    delete (globalThis as any).__VITE_ENV__;
    mockedGetChainId.mockResolvedValue(31337n);
    mockedGetCode.mockResolvedValue("0x");
    mockedGetDefaultProvider.mockReturnValue(defaultRpcProvider());
    mockedHashUtf8String.mockReturnValue(COLOR_FONT.hash);
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

    const yearElements = screen.getAllByText(/2027|2028/i);
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

    const yearElements = screen.getAllByText(/2027|2028/i);
    yearElements.forEach((element: HTMLElement) => {
      expect(parseFloat(element.style.opacity)).toBeGreaterThanOrEqual(0.5);
    });
  });

  test("renders the Pulse primitive page on /pulse", () => {
    window.history.pushState({}, "", "/pulse");
    render(<App />);

    expect(document.title).toBe("pulse — inshell.art");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/pulse.svg");
    expect(screen.getByRole("heading", { name: "pulse" })).toBeInTheDocument();
    expect(screen.getByText("Pricing sketch for the $PATH auction.")).toBeInTheDocument();
    expect(screen.getByText("Pulse shapes the ask over time.")).toBeInTheDocument();
    expect(screen.getByText(/A successful bid closes the current epoch and starts the next one\./)).toBeInTheDocument();
    expect(screen.getByText(/The next ask is raised by a time premium\./)).toBeInTheDocument();
    expect(screen.getByText(/Between sales, the ask decays toward the floor\./)).toBeInTheDocument();
    expect(screen.getByText(/Settlement samples the ask at sale time\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /PTS = price-time scale/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /elapsed time = sale time - previous curve start/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /premium = elapsed time × PTS/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /current ask = last price \+ premium/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /ask\(t\) = b \+ floor\(k \/ \(t - a\)\)/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).not.toHaveTextContent(
      /premium per second/,
    );
    expect(screen.getByText(/It is a source note, not implementation code\./)).toBeInTheDocument();
    expect(screen.getByText(/This is the Desmos sketch behind Pulse\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open original Desmos sketch ↗" })).toHaveAttribute(
      "href",
      "https://www.desmos.com/calculator/1d89f93d21",
    );
    expect(screen.getByRole("link", { name: "View source ↗" })).toHaveAttribute(
      "href",
      "https://github.com/inshell-art/pulse",
    );
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
    expect(screen.queryByLabelText("Open Pulse")).toBeNull();
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
    expect(await screen.findByText("thought.colorfont.v1")).toBeInTheDocument();
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
    expect(screen.getByText("warning: onchain color font could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("showing bundled mirror copy.")).toBeInTheDocument();
    expect(screen.getByText("authority")).toBeInTheDocument();
    expect(screen.getByText("onchain color font ABI unavailable")).toBeInTheDocument();
    expect(screen.getByText("chain")).toBeInTheDocument();
    expect(screen.getByText("Local Devnet")).toBeInTheDocument();
    expect(screen.getByText("loaded from")).toBeInTheDocument();
    expect(screen.getByText("frontend mirror fallback")).toBeInTheDocument();
    expect(screen.getByText("mirror")).toBeInTheDocument();
    expect(screen.getByText("GitHub COLOR_FONT.v1.json")).toBeInTheDocument();
    expect(screen.getByText(/A:1:aqua:#00ffff/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open raw onchain data ↗" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retry onchain load" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View GitHub mirror ↗" })).toHaveAttribute(
      "href",
      "https://github.com/inshell-art/inshell.art/blob/main/spec/COLOR_FONT.v1.json",
    );
    expect(screen.getByRole("link", { name: "View GitHub mirror ↗" })).not.toHaveAttribute(
      "href",
      expect.stringContaining("github.com/inshell-art/thought"),
    );
    expect(screen.getByText(/authority: onchain color font ABI unavailable/)).toBeInTheDocument();
    expect(screen.getByText(/source: frontend mirror fallback/)).toBeInTheDocument();
    expect(screen.getByText(/mirror: GitHub COLOR_FONT\.v1\.json/)).toBeInTheDocument();
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
    expect(screen.queryByLabelText("Open Color Font primitive page")).toBeNull();
  });

  test("renders the Color Font primitive page with onchain authority metadata", async () => {
    window.history.pushState({}, "", "/color-font");
    const thoughtNftAddress = "0x627b9A657eac8c3463AD17009a424dFE3FDbd0b1";
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_THOUGHT_NFT: thoughtNftAddress,
    };
    const request = jest.fn(async ({ method, params }: any) => {
      if (method === "eth_call") {
        const data = params[0].data;
        if (data === "0xa61ca744") return encodeAbiString(COLOR_FONT.id);
        if (data === "0xdf495573") return encodeAbiString(COLOR_FONT.version);
        if (data === "0x2d53d7de") return COLOR_FONT.hash;
        if (data === "0xc6cc9e6f") return encodeAbiString(COLOR_FONT_RAW);
      }
      throw new Error(`unexpected RPC request: ${method}`);
    });
    mockedGetCode.mockResolvedValue("0x1234");
    mockedGetChainId.mockResolvedValue(11155111n);
    mockedGetDefaultProvider.mockReturnValue({ request });

    render(<App />);

    expect(await screen.findByText("thought.colorfont.v1")).toBeInTheDocument();
    const authority = screen.getByText("ThoughtNFT 0x627b...d0b1");
    expect(authority).toHaveAttribute(
      "href",
      `https://sepolia.etherscan.io/address/${thoughtNftAddress}`,
    );
    expect(authority).toHaveAttribute("title", `ThoughtNFT ${thoughtNftAddress}`);
    expect(screen.getByText("Sepolia (11155111)")).toBeInTheDocument();
    expect(screen.getByText("ThoughtNFT.colorFontData()")).toBeInTheDocument();
    expect(screen.getByText("GitHub COLOR_FONT.v1.json")).toBeInTheDocument();
    expect(screen.queryByText("frontend mirror fallback")).toBeNull();
    expect(
      screen.queryByText("warning: onchain color font could not be loaded.")
    ).toBeNull();
    expect(screen.getByRole("link", { name: "Open raw onchain data ↗" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^(blob:|data:text\/html;charset=utf-8,)/),
    );
    expect(screen.queryByRole("button", { name: "Retry onchain load" })).toBeNull();
    expect(screen.getByText(/authority: ThoughtNFT 0x627b\.\.\.d0b1/)).toBeInTheDocument();
    expect(screen.getByText(/source: ThoughtNFT\.colorFontData\(\)/)).toBeInTheDocument();
    expect(screen.getByText(/mirror: GitHub COLOR_FONT\.v1\.json/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "eth_call",
        params: [expect.objectContaining({ to: thoughtNftAddress, data: "0xc6cc9e6f" }), "latest"],
      }),
    );
  });

  test("footer links Pulse and color font without facets or hone", () => {
    render(<App />);

    expect(screen.getByLabelText("Open Pulse")).toHaveAttribute("href", "/pulse");
    expect(screen.getByLabelText("Open Pulse")).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("Open Color Font primitive page")).toHaveAttribute(
      "href",
      "/color-font",
    );
    expect(screen.getByLabelText("Open Color Font primitive page")).toHaveAttribute("target", "_blank");
    expect(screen.queryByLabelText("Open facets")).toBeNull();
    expect(screen.queryByLabelText("Open hone")).toBeNull();
  });
});
