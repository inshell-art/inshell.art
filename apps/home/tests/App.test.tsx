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

const mockUseAuctionCore = jest.fn();
const mockUseAuctionBids = jest.fn();

jest.mock("@/hooks/useAuctionCore", () => ({
  __esModule: true,
  useAuctionCore: (...args: unknown[]) => mockUseAuctionCore(...args),
}));

jest.mock("@/hooks/useAuctionBids", () => ({
  __esModule: true,
  useAuctionBids: (...args: unknown[]) => mockUseAuctionBids(...args),
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

function u256(value: bigint) {
  return {
    raw: { low: value.toString(), high: "0" },
    value,
    dec: value.toString(),
  };
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
    mockUseAuctionCore.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      ready: true,
      refresh: jest.fn(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [],
      loading: false,
      error: null,
      ready: true,
      pullOnce: jest.fn(),
    });
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
      /next ask = last price \+ premium/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /next floor = last price/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).toHaveTextContent(
      /ask\(t\) = b \+ floor\(k \/ \(t - a\)\)/,
    );
    expect(screen.getByLabelText("Pulse pump and drop equations")).not.toHaveTextContent(
      /premium per second/,
    );
    expect(screen.getByLabelText("Pulse current instance")).toBeInTheDocument();
    expect(screen.getByText("current instance")).toBeInTheDocument();
    expect(screen.getByText("$PATH is the current public auction using Pulse.")).toBeInTheDocument();
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

  test("renders Pulse current instance live params with units", () => {
    window.history.pushState({}, "", "/pulse");
    const oneEth = 10n ** 18n;
    mockUseAuctionCore.mockReturnValue({
      data: {
        active: true,
        price: u256(420_000_000_000_000_000n),
        config: {
          openTimeSec: 1_778_240_550,
          genesisPrice: u256(oneEth),
          genesisFloor: u256(oneEth / 10n),
          k: u256(100n * oneEth),
          pts: "100000000000000",
        },
      },
      loading: false,
      error: null,
      ready: true,
      refresh: jest.fn(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [
        {
          key: "sale-2",
          atMs: 1_778_241_000_000,
          amount: u256(250_000_000_000_000_000n),
          amountDec: "0.25",
          bidder: "0x1111111111111111111111111111111111111111",
          blockNumber: 42,
          epochIndex: 2,
          anchorASec: 1_778_240_900,
        },
      ],
      loading: false,
      error: null,
      ready: true,
      pullOnce: jest.fn(),
    });

    render(<App />);

    const params = screen.getByLabelText("Pulse current instance contract params");
    const scopedParams = within(params);
    expect(scopedParams.getByText("authority")).toBeInTheDocument();
    expect(scopedParams.getByText("PulseAuction 0x2A59...2e76")).toBeInTheDocument();
    expect(scopedParams.getByText("chain")).toBeInTheDocument();
    expect(scopedParams.getByText("Local Devnet")).toBeInTheDocument();
    expect(scopedParams.getByText("payment")).toBeInTheDocument();
    expect(scopedParams.getByText("ETH")).toBeInTheDocument();
    expect(scopedParams.getByText("loaded from")).toBeInTheDocument();
    expect(scopedParams.getByText("PulseAuction contract")).toBeInTheDocument();
    expect(scopedParams.getByText("k")).toBeInTheDocument();
    expect(scopedParams.getByText("100")).toBeInTheDocument();
    expect(scopedParams.getByText("PTS")).toBeInTheDocument();
    expect(scopedParams.getByText("0.0001 ETH/s")).toBeInTheDocument();
    expect(scopedParams.getByText("opening ask")).toBeInTheDocument();
    expect(scopedParams.getByText("1 ETH")).toBeInTheDocument();
    expect(scopedParams.getByText("opening floor")).toBeInTheDocument();
    expect(scopedParams.getByText("0.1 ETH")).toBeInTheDocument();
    expect(scopedParams.getByText("current ask")).toBeInTheDocument();
    expect(scopedParams.getByText("0.42 ETH")).toBeInTheDocument();
    expect(scopedParams.getByText("floor b")).toBeInTheDocument();
    expect(scopedParams.getByText("0.25 ETH")).toBeInTheDocument();
    expect(scopedParams.getByText("epoch")).toBeInTheDocument();
    expect(scopedParams.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open live Pulse params" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^(blob:|data:text\/html;charset=utf-8,)/),
    );
  });

  test("does not show stale Pulse params when live params fail", () => {
    window.history.pushState({}, "", "/pulse");
    mockUseAuctionCore.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("RPC read failed"),
      ready: true,
      refresh: jest.fn(),
    });
    mockUseAuctionBids.mockReturnValue({
      bids: [],
      loading: false,
      error: new Error("RPC read failed"),
      ready: false,
      pullOnce: jest.fn(),
    });

    render(<App />);

    expect(screen.getByText("live params unavailable.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pulse current instance contract params")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open live params ↗" })).toBeNull();
    expect(screen.queryByText("opening ask")).toBeNull();
    expect(screen.queryByText("current ask")).toBeNull();
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

  test("renders the PATH fixture for one WILL mint out of quota ten", () => {
    window.history.pushState({}, "", "/path?fixture=will");
    render(<App />);

    expect(document.title).toBe("$PATH");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/path.svg");
    expect(screen.getByRole("heading", { name: "$PATH" })).toBeInTheDocument();
    expect(screen.getByText("Permission tokens for Inshell movement mints.")).toBeInTheDocument();
    expect(screen.getByText("$PATH is minted by the public Pulse auction.")).toBeInTheDocument();
    expect(
      screen.getByText("Each $PATH authorizes movement mints in order: THOUGHT, WILL, then AWA."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The image and traits show movement progress for each token."),
    ).toBeInTheDocument();
    expect(screen.getByText("fixture: WILL minted 1 of 10")).toBeInTheDocument();
    expect(screen.getByText("mode")).toBeInTheDocument();
    expect(screen.getByText("fixture state gallery")).toBeInTheDocument();
    expect(screen.getByText("$PATH #1")).toBeInTheDocument();
    expect(screen.getAllByText("WILL")).toHaveLength(2);
    expect(screen.getByText("progress")).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.queryByText("Minted(1/10)")).toBeNull();
    const image = screen.getByRole("img", { name: "$PATH #1 token image" });
    expect(image).toHaveAttribute("src", expect.stringContaining("will-fill"));
    expect(image).toHaveAttribute("src", expect.stringContaining("r%3D'3'"));
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
  });

  test("renders the PATH state gallery fixture", () => {
    window.history.pushState({}, "", "/path?fixture=states");
    render(<App />);

    expect(document.title).toBe("$PATH");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/path.svg");
    expect(screen.getByText("fixture: $PATH state gallery")).toBeInTheDocument();
    expect(screen.getByText("fixture state gallery")).toBeInTheDocument();
    expect(screen.getByText("fixture tokenURI()")).toBeInTheDocument();
    for (let tokenId = 1; tokenId <= 8; tokenId += 1) {
      expect(screen.getByText(`$PATH #${tokenId}`)).toBeInTheDocument();
    }
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("5 / 10")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("COMPLETE")).toBeInTheDocument();
    expect(screen.queryByText("Minted(2/3)")).toBeNull();

    const thoughtProgressImage = screen.getByRole("img", { name: "$PATH #2 token image" });
    expect(thoughtProgressImage).toHaveAttribute(
      "src",
      expect.stringContaining("circle%20id%3D'thought-box'"),
    );
    expect(thoughtProgressImage).toHaveAttribute("src", expect.stringContaining("thought-fill"));
    expect(thoughtProgressImage).toHaveAttribute("src", expect.stringContaining("r%3D'20'"));
    expect(thoughtProgressImage).not.toHaveAttribute(
      "src",
      expect.stringContaining("clip-path"),
    );
    const oneWillImage = screen.getByRole("img", { name: "$PATH #4 token image" });
    expect(oneWillImage).toHaveAttribute("src", expect.stringContaining("r%3D'3'"));
    const midWillImage = screen.getByRole("img", { name: "$PATH #5 token image" });
    expect(midWillImage).toHaveAttribute("src", expect.stringContaining("r%3D'15'"));
    const awaProgressImage = screen.getByRole("img", { name: "$PATH #7 token image" });
    expect(awaProgressImage).toHaveAttribute("src", expect.stringContaining("awa-fill"));
    expect(awaProgressImage).toHaveAttribute("src", expect.stringContaining("r%3D'15'"));
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
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
