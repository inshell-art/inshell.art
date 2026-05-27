import React from "react";
import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd, env } from "node:process";
import { TextEncoder } from "node:util";
import { afterEach, beforeEach, describe, test, expect, jest } from "@jest/globals";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  getBlockNumber: jest.fn(async () => 0),
  getDefaultProvider: jest.fn(() => ({ request: jest.fn() })),
  hashUtf8String: jest.fn(),
  supportsRpcRequest: jest.fn(() => true),
}));

const mockUseAuctionCore = jest.fn();
const mockUseAuctionBids = jest.fn();
const originalFetch = globalThis.fetch;

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

function thoughtGalleryItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tokenId: 1,
    pathId: "1",
    minter: "0x170a00000000000000000000000000000000e100",
    textHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    promptHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    provenanceHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    thoughtSpecId: "0x4444444444444444444444444444444444444444444444444444444444444444",
    thoughtSpecHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
    mintedAt: 1_780_000_000,
    rawText: "THOUGHT WILL AWA",
    prompt: "make a thought",
    mode: "connect",
    provider: "openrouter",
    model: "test-model",
    returnedText: "THOUGHT WILL AWA",
    returnedTextHash: "0x6666666666666666666666666666666666666666666666666666666666666666",
    provenanceJson: "{}",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
    tokenUri: "data:application/json,{}",
    txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
    blockNumber: 1_234_567,
    ...overrides,
  };
}

function mockThoughtGalleryApi(items = [thoughtGalleryItem()]) {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    json: async () => ({ thoughts: items }),
  }));
  globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  return fetchMock;
}

async function flushAsyncEffects(cycles = 6) {
  await act(async () => {
    for (let index = 0; index < cycles; index += 1) {
      await Promise.resolve();
    }
  });
}

function expectedEnvChainLabel() {
  return String(env.VITE_NETWORK ?? "").toLowerCase() === "sepolia"
    ? "Sepolia"
    : "Local Devnet";
}

function expectedColorFontFallbackChainLabel() {
  return String(env.VITE_NETWORK ?? "").toLowerCase() === "sepolia"
    ? "Sepolia (11155111)"
    : "Local Devnet";
}

function expectedDefaultGalleryUrl() {
  const configured = env.VITE_THOUGHT_GALLERY_URL || env.VITE_GALLERY_URL;
  if (configured) {
    return new globalThis.URL(configured).toString();
  }
  return String(env.VITE_DEPLOY_ENV ?? "").toLowerCase() === "preview"
    ? "https://gallery.preview.inshell.art/"
    : "https://gallery.inshell.art/";
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
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  test("movement launch years are hidden by default", () => {
    render(<App />);

    const yearElements = screen.getAllByText(/2027|2028/i);
    yearElements.forEach((element: HTMLElement) => {
      expect(element.style.opacity).toBe("0");
    });
  });

  test("movement hover reveals only that movement launch year", () => {
    render(<App />);
    const will = screen.getAllByText("WILL")[0] as HTMLElement;
    const willCell = will.closest(".movements__cell") as HTMLElement;
    const willYear = screen.getByText(/2027/i) as HTMLElement;
    const awaYear = screen.getByText(/2028/i) as HTMLElement;

    fireEvent.mouseEnter(willCell);
    expect(willYear.style.opacity).toBe("0");

    fireEvent.mouseEnter(will);

    expect(willYear.style.opacity).toBe("1");
    expect(awaYear.style.opacity).toBe("0");

    fireEvent.mouseLeave(will);
    expect(willYear.style.opacity).toBe("0");
  });

  test("global mouse movement does not reveal movement launch years", () => {
    render(<App />);
    fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });

    const yearElements = screen.getAllByText(/2027|2028/i);
    yearElements.forEach((element: HTMLElement) => {
      expect(element.style.opacity).toBe("0");
    });
  });

  test("renders the home browser title and favicon as Inshell", () => {
    render(<App />);

    expect(document.title).toBe("Inshell");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/inshell.svg");
    expect(document.querySelector(".shell--home")).toBeInTheDocument();
    expect(screen.queryByLabelText("Public update terms")).toBeNull();
  });

  test("renders the Pulse primitive page on /pulse", () => {
    window.history.pushState({}, "", "/pulse");
    render(<App />);

    expect(document.title).toBe("pulse — $PATH");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/pulse.svg");
    expect(screen.getByRole("heading", { name: "pulse" })).toBeInTheDocument();
    expect(screen.getByText("Pricing rule for the $PATH auction.")).toBeInTheDocument();
    expect(screen.getByText("Pulse is the pricing rule for the public $PATH auction.")).toBeInTheDocument();
    expect(screen.getByText(/\$PATH has no fixed cap\./)).toBeInTheDocument();
    expect(screen.getByText(/Issuance is demand-tempered/)).toBeInTheDocument();
    expect(screen.getByText(/The limit is not a number set in advance\./)).toBeInTheDocument();
    expect(screen.getByText(/The limit is the price buyers are willing to accept over time\./)).toBeInTheDocument();
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /PTS = price-time scale/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /duration = sale time - previous curve start/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /time premium = duration × PTS/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /start ask = floor \+ time premium/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /floor = last sale price/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /Each sale starts the next Pulse cycle\./,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /ask = k\/\(t-anchor\) \+ floor/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /t½ = when above floor is halved/,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).toHaveTextContent(
      /If demand waits, ask decays toward floor\./,
    );
    expect(screen.getByLabelText("Pulse lift and decay equations")).not.toHaveTextContent(
      /premium per second/,
    );
    expect(screen.queryByLabelText("Pulse pump and drop equations")).toBeNull();
    expect(screen.getByLabelText("Linked Pulse auction curves")).toBeInTheDocument();
    expect(screen.getByLabelText("Pulse current instance")).toBeInTheDocument();
    expect(screen.getByText("current instance")).toBeInTheDocument();
    expect(screen.getByText("$PATH is the current public auction using Pulse.")).toBeInTheDocument();
    expect(
      screen.getByText(/Pulse began as the Desmos sketch linked below\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This page preserves the pricing shape, not implementation code\./),
    ).toBeInTheDocument();
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
    expect(
      scopedParams.getByText(/^PulseAuction 0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/),
    ).toBeInTheDocument();
    expect(scopedParams.getByText("chain")).toBeInTheDocument();
    expect(scopedParams.getByText(expectedEnvChainLabel())).toBeInTheDocument();
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
    expect(scopedParams.getByText("floor")).toBeInTheDocument();
    expect(scopedParams.getByText("0.25 ETH")).toBeInTheDocument();
    expect(scopedParams.getByText("epoch")).toBeInTheDocument();
    expect(scopedParams.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open live params" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^(blob:|data:text\/html;charset=utf-8,)/),
    );
    expect(screen.getByRole("link", { name: "View $PATH tokens" })).toHaveAttribute(
      "href",
      "/path",
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
    expect(screen.queryByRole("link", { name: "Open live params" })).toBeNull();
    expect(screen.queryByText("opening ask")).toBeNull();
    expect(screen.queryByText("current ask")).toBeNull();
  });

  test("renders the color-font primitive page on /color-font", async () => {
    window.history.pushState({}, "", "/color-font");
    render(<App />);
    await flushAsyncEffects();

    expect(document.title).toBe("color-font");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/color-font.svg");
    expect(screen.getByRole("heading", { name: "color-font" })).toBeInTheDocument();
    expect(screen.queryByText(/THOUGHT Color Font/i)).toBeNull();
    expect(
      screen.getByText("Contract-defined A-Z color glyph system.")
    ).toBeInTheDocument();
    expect(await screen.findByText("inshell.colorfont.v1")).toBeInTheDocument();
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
    expect(screen.getByText(expectedColorFontFallbackChainLabel())).toBeInTheDocument();
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
    expect(screen.getByText(/loaded from: frontend mirror fallback/)).toBeInTheDocument();
    expect(screen.getByText(/mirror: GitHub COLOR_FONT\.v1\.json/)).toBeInTheDocument();
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
    expect(screen.queryByLabelText("Open color-font primitive page")).toBeNull();
  });

  test("renders the verify page with official wallet facts", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
    };
    window.history.pushState({}, "", "/verify");
    render(<App />);

    expect(document.title).toBe("verify — $PATH");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/inshell.svg");
    expect(screen.getByRole("heading", { name: "verify" })).toBeInTheDocument();
    expect(screen.getByText("Official Inshell dapp and wallet surfaces.")).toBeInTheDocument();
    expect(screen.getByText("https://inshell.art")).toBeInTheDocument();
    expect(screen.getByText("https://thought.inshell.art")).toBeInTheDocument();
    expect(screen.getByText("Sepolia")).toBeInTheDocument();
    expect(screen.getByText("11155111")).toBeInTheDocument();
    expect(screen.getByText("PathNFT")).toBeInTheDocument();
    expect(screen.getByText("ThoughtNFT")).toBeInTheDocument();
    expect(screen.getByText("PulseAuction")).toBeInTheDocument();
    expect(screen.getByText("THOUGHT.v1.md")).toBeInTheDocument();
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
  });

  test("keeps PATH artwork frame background aligned with the auction frame", () => {
    const css = readFileSync(
      nodePath.resolve(cwd(), "src/main.css"),
      "utf8",
    );

    expect(css).toMatch(/--canvas-frame-bg:\s*var\(--panel\);/);
    expect(css).toMatch(/--canvas-frame-bg:\s*#fff;/);
    expect(css).toMatch(
      /\.dotfield\s*{[^}]*background:\s*var\(--canvas-frame-bg\);/s,
    );
    expect(css).toMatch(/\.dotfield\s*{[^}]*width:\s*min\(100%,\s*960px\);/s);
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1400px\)\s*{[^}]*\.dotfield\s*{[^}]*width:\s*min\(72vw,\s*1180px\);/s,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1400px\)\s*{[\s\S]*?\.dotfield__canvas\s*{[^}]*height:\s*min\(58vh,\s*520px\);/s,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1800px\)\s*{[^}]*\.dotfield\s*{[^}]*width:\s*min\(68vw,\s*1360px\);/s,
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1800px\)\s*{[\s\S]*?\.dotfield__canvas\s*{[^}]*height:\s*min\(56vh,\s*600px\);/s,
    );
    expect(css).toMatch(/\.shell--home\s*{[^}]*min-height:\s*100dvh;/s);
    expect(css).not.toMatch(/\.shell--home\s+\.dotfield__canvas/);
    expect(css).toMatch(
      /\.path-page-token\s*{[^}]*background:\s*var\(--canvas-frame-bg\);/s,
    );
    expect(css).toMatch(
      /\.path-page-token__media\s*{[^}]*background:\s*#050505;/s,
    );
  });

  test("renders the color-font primitive page with onchain authority metadata", async () => {
    window.history.pushState({}, "", "/color-font");
    const colorFontV1Address = "0x627b9A657eac8c3463AD17009a424dFE3FDbd0b1";
    (globalThis as any).__VITE_ENV__ = {
      VITE_NETWORK: "sepolia",
      VITE_COLOR_FONT_V1: colorFontV1Address,
    };
    const request = jest.fn(async ({ method, params }: any) => {
      if (method === "eth_call") {
        const data = params[0].data;
        if (data === "0xaf640d0f") return encodeAbiString(COLOR_FONT.id);
        if (data === "0x54fd4d50") return encodeAbiString(COLOR_FONT.version);
        if (data === "0x09bd5a60") return COLOR_FONT.hash;
        if (data === "0x73d4a13a") return encodeAbiString(COLOR_FONT_RAW);
      }
      throw new Error(`unexpected RPC request: ${method}`);
    });
    mockedGetCode.mockResolvedValue("0x1234");
    mockedGetChainId.mockResolvedValue(11155111n);
    mockedGetDefaultProvider.mockReturnValue({ request });

    render(<App />);
    await flushAsyncEffects();

    expect(await screen.findByText("inshell.colorfont.v1")).toBeInTheDocument();
    const authority = screen.getByText("ColorFontV1 0x627b...d0b1");
    expect(authority).toHaveAttribute(
      "href",
      `https://sepolia.etherscan.io/address/${colorFontV1Address}`,
    );
    expect(authority).toHaveAttribute("title", `ColorFontV1 ${colorFontV1Address}`);
    expect(screen.getByText("Sepolia (11155111)")).toBeInTheDocument();
    expect(screen.getByText("ColorFontV1.data()")).toBeInTheDocument();
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
    expect(screen.getByText(/authority: ColorFontV1 0x627b\.\.\.d0b1/)).toBeInTheDocument();
    expect(screen.getByText(/loaded from: ColorFontV1\.data\(\)/)).toBeInTheDocument();
    expect(screen.getByText(/mirror: GitHub COLOR_FONT\.v1\.json/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "eth_call",
        params: [expect.objectContaining({ to: colorFontV1Address, data: "0x73d4a13a" }), "latest"],
      }),
    );
  });

  test("renders the PATH fixture for one WILL mint out of quota ten", () => {
    window.history.pushState({}, "", "/path?fixture=will");
    render(<App />);

    expect(document.title).toBe("$PATH");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/path.svg");
    expect(screen.getByRole("heading", { name: "$PATH" })).toBeInTheDocument();
    expect(screen.getByText("Permission tokens for movement mints.")).toBeInTheDocument();
    expect(screen.getByText("$PATH is minted by the public Pulse auction.")).toBeInTheDocument();
    expect(
      screen.getByText("Each $PATH authorizes movement mints in order: THOUGHT, WILL, then AWA."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The token image and traits show movement progress."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A movement minted from $PATH consumes a movement unit and updates the $PATH lifecycle."),
    ).toBeInTheDocument();
    expect(screen.getByText("stage shows the current movement phase.")).toBeInTheDocument();
    expect(screen.getByText("units show used / total movement units.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View $PATH pricing" })).toHaveAttribute(
      "href",
      "/pulse",
    );
    expect(screen.queryByRole("link", { name: "View Pulse pricing" })).toBeNull();
    expect(screen.getByText("1 token")).toBeInTheDocument();
    expect(screen.getByText("mode")).toBeInTheDocument();
    expect(screen.getByText("fixture state gallery")).toBeInTheDocument();
    expect(screen.getByText("$PATH #1")).toBeInTheDocument();
    expect(screen.getAllByText("WILL")).toHaveLength(2);
    expect(screen.getByText("units")).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
    expect(screen.getByText("- / -")).toBeInTheDocument();
    expect(screen.queryByText("Minted(1/10)")).toBeNull();
    expect(screen.queryByText("0 / 0")).toBeNull();
    const image = screen.getByRole("img", { name: "$PATH #1 movement progress" });
    expect(image).toHaveAttribute("src", expect.stringContaining("will-fill"));
    expect(image).toHaveAttribute("src", expect.stringContaining("r%3D'3'"));
    expect(screen.getByLabelText("Open $PATH #1")).toHaveAttribute(
      "href",
      "/path/1?fixture=will",
    );
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
  });

  test("renders the live PATH page with an explicit chain loading message", async () => {
    window.history.pushState({}, "", "/path");
    render(<App />);

    expect(
      screen.getByLabelText("reading from chain: checking latest block..."),
    ).toBeInTheDocument();
    expect(screen.getByText(/reading from chain: checking latest block/)).toBeInTheDocument();
    await flushAsyncEffects();
    expect(screen.getByText("token list unavailable")).toBeInTheDocument();
  });

  test("renders the PATH state gallery fixture", () => {
    window.history.pushState({}, "", "/path?fixture=states");
    render(<App />);

    expect(document.title).toBe("$PATH");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/path.svg");
    expect(screen.getByText("8 tokens")).toBeInTheDocument();
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

    const thoughtProgressImage = screen.getByRole("img", { name: "$PATH #2 movement progress" });
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
    const oneWillImage = screen.getByRole("img", { name: "$PATH #4 movement progress" });
    expect(oneWillImage).toHaveAttribute("src", expect.stringContaining("r%3D'3'"));
    const midWillImage = screen.getByRole("img", { name: "$PATH #5 movement progress" });
    expect(midWillImage).toHaveAttribute("src", expect.stringContaining("r%3D'15'"));
    const awaProgressImage = screen.getByRole("img", { name: "$PATH #7 movement progress" });
    expect(awaProgressImage).toHaveAttribute("src", expect.stringContaining("awa-fill"));
    expect(awaProgressImage).toHaveAttribute("src", expect.stringContaining("r%3D'15'"));
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
  });

  test("renders a focused PATH token card route", () => {
    window.history.pushState({}, "", "/path/4?fixture=states");
    render(<App />);

    expect(document.title).toBe("$PATH #4");
    expect(document.querySelector('link[rel="icon"]')).toHaveAttribute("href", "/path.svg");
    expect(screen.getByRole("heading", { level: 1, name: "$PATH" })).toBeInTheDocument();
    expect(screen.getByText("Permission tokens for movement mints.")).toBeInTheDocument();
    expect(screen.getByText("8 tokens · focused $PATH #4")).toBeInTheDocument();
    expect(screen.getByText("$PATH #1")).toBeInTheDocument();
    expect(screen.getByText("$PATH #8")).toBeInTheDocument();
    expect(screen.queryByText("PATH token detail.")).toBeNull();
    expect(screen.queryByText("token detail")).toBeNull();
    expect(screen.queryByText("loaded")).toBeNull();
    expect(screen.getByRole("button", { name: "refresh" })).toBeInTheDocument();
    expect(screen.getByLabelText("$PATH #4 focused card")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "$PATH #4 movement progress" })).toHaveAttribute(
      "src",
      expect.stringContaining("will-fill"),
    );
    const lifecycle = within(screen.getByLabelText("$PATH #4 lifecycle"));
    expect(lifecycle.getByText("This $PATH has started its movement lifecycle.")).toBeInTheDocument();
    expect(lifecycle.getByText("units")).toBeInTheDocument();
    expect(lifecycle.getByText("from this $PATH")).toBeInTheDocument();
    expect(lifecycle.getByText("mint")).toBeInTheDocument();
    expect(lifecycle.getAllByText("pricing").length).toBeGreaterThanOrEqual(1);
    expect(lifecycle.getByText("share")).toBeInTheDocument();
    expect(lifecycle.getAllByText("owner").length).toBeGreaterThanOrEqual(1);
    expect(lifecycle.getByText("stage")).toBeInTheDocument();
    expect(lifecycle.getAllByText("WILL").length).toBeGreaterThanOrEqual(2);
    expect(lifecycle.getByText("3 / 3")).toBeInTheDocument();
    expect(lifecycle.getByText("1 / 10")).toBeInTheDocument();
    expect(lifecycle.getByText("$PATH #4 consumed one THOUGHT unit.")).toBeInTheDocument();
    expect(lifecycle.getByText("$PATH #4 consumed one WILL unit.")).toBeInTheDocument();
    expect(lifecycle.getByRole("link", { name: "THOUGHT #4 ↗" })).toHaveAttribute(
      "href",
      "/thought/4",
    );
    expect(lifecycle.getByText("start ask")).toBeInTheDocument();
    expect(lifecycle.getByRole("link", { name: "View $PATH pricing ↗" })).toHaveAttribute(
      "href",
      "/pulse",
    );
    expect(lifecycle.getByRole("link", { name: "$PATH #4 ↗" })).toHaveAttribute(
      "href",
      "/path/4?fixture=states",
    );
    expect(lifecycle.queryByRole("link", { name: "View Pulse pricing ↗" })).toBeNull();
    expect(lifecycle.queryByText("PATH burned")).toBeNull();
    expect(lifecycle.queryByText("PATH destroyed")).toBeNull();
    expect(lifecycle.queryByText("$PATH consumed")).toBeNull();
    expect(lifecycle.queryByText("pump")).toBeNull();
    expect(lifecycle.queryByText("drop")).toBeNull();
    expect(screen.queryByRole("link", { name: "Back to all PATH tokens" })).toBeNull();
  });

  test("renders a fresh focused PATH card without movement token links", () => {
    window.history.pushState({}, "", "/path/1?fixture=states");
    render(<App />);

    const lifecycle = within(screen.getByLabelText("$PATH #1 lifecycle"));
    expect(lifecycle.getByText("This $PATH is ready to move through THOUGHT, WILL, and AWA.")).toBeInTheDocument();
    expect(lifecycle.getAllByText("owner").length).toBeGreaterThanOrEqual(1);
    expect(lifecycle.getByText("stage")).toBeInTheDocument();
    expect(lifecycle.getByText("0 / 3")).toBeInTheDocument();
    expect(lifecycle.getByText("0 / 10")).toBeInTheDocument();
    expect(lifecycle.getByText("0 / 2")).toBeInTheDocument();
    expect(lifecycle.queryByRole("link", { name: /THOUGHT #/ })).toBeNull();
  });

  test("renders THOUGHT detail routes at the Inshell root", async () => {
    mockThoughtGalleryApi([
      thoughtGalleryItem({
        tokenId: 1,
        pathId: "4",
        rawText: "ONE THOUGHT",
      }),
    ]);
    window.history.pushState({}, "", "/thought/1");
    render(<App />);
    await flushAsyncEffects();

    expect(document.title).toBe("THOUGHT #1");
    expect(screen.getByRole("heading", { level: 1, name: "THOUGHT #1" })).toBeInTheDocument();
    expect(screen.getByText("THOUGHT work detail.")).toBeInTheDocument();
    expect(screen.getByLabelText("THOUGHT #1 detail")).toBeInTheDocument();
    expect(screen.getByText("ONE THOUGHT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "$PATH #4" })).toHaveAttribute("href", "/path/4");
    expect(window.location.pathname).toBe("/thought/1");
    expect(screen.queryByTestId("auction-canvas")).toBeNull();
  });

  test("footer links gallery, Pulse, color-font, Telegram, X, and GitHub", () => {
    render(<App />);

    const footerLinks = screen.getByLabelText("Project links").querySelectorAll("a");
    expect(Array.from(footerLinks).map((link) => link.getAttribute("aria-label"))).toEqual([
      "Open THOUGHT gallery",
      "Open Pulse",
      "Open color-font primitive page",
      "Open Telegram announcements channel",
      "Open X",
      "Open GitHub",
    ]);
    expect(screen.getByLabelText("Open Pulse")).toHaveAttribute("href", "/pulse");
    expect(screen.getByLabelText("Open Pulse")).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("Open color-font primitive page")).toHaveAttribute(
      "href",
      "/color-font",
    );
    expect(screen.getByLabelText("Open color-font primitive page")).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("Open color-font primitive page")).toHaveTextContent("■■■");
    expect(screen.getByLabelText("Open THOUGHT gallery")).toHaveAttribute(
      "href",
      expectedDefaultGalleryUrl(),
    );
    expect(screen.getByLabelText("Open THOUGHT gallery")).toHaveAttribute("target", "_blank");
    expect(screen.getByLabelText("Open Telegram announcements channel")).toHaveAttribute(
      "href",
      "https://t.me/inshell_art",
    );
    expect(screen.getByLabelText("Open Telegram announcements channel")).toHaveTextContent("■■");
    expect(screen.queryByLabelText("Open facets")).toBeNull();
    expect(screen.queryByLabelText("Open hone")).toBeNull();
  });

  test("footer gallery uses configured gallery URL", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_THOUGHT_GALLERY_URL: "https://gallery.preview.inshell.art/",
    };

    render(<App />);

    expect(screen.getByLabelText("Open THOUGHT gallery")).toHaveAttribute(
      "href",
      "https://gallery.preview.inshell.art/",
    );
  });

  test("footer gallery does not fall back to thought-level gallery query URLs", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_DEPLOY_ENV: "preview",
      VITE_THOUGHT_URL: "https://thought.preview.inshell.art/",
    };

    render(<App />);

    expect(screen.getByLabelText("Open THOUGHT gallery")).toHaveAttribute(
      "href",
      "https://gallery.preview.inshell.art/",
    );
  });

  test("sepolia invite footer opens GitHub org and exposes floating report bug link", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md",
      VITE_GITHUB_URL: "https://github.com/inshell-art/inshell.art",
      VITE_DEBUG_PANEL: "off",
    };

    render(<App />);

    expect(screen.getByLabelText("Open GitHub")).toHaveAttribute(
      "href",
      "https://github.com/inshell-art/",
    );
    const report = screen.getByRole("link", { name: "Report a Sepolia bug" });
    expect(report).toHaveTextContent("report bug ↗");
    expect(report).toHaveAttribute("href", expect.stringContaining("template=sepolia-bug.md"));
    expect(report.className).toContain("inshell-report-bug-link--floating");
    expect(report.closest("footer")).toBeNull();
  });

  test("shows the preview watermark only for preview deployments", () => {
    (globalThis as any).__VITE_ENV__ = {
      VITE_DEPLOY_ENV: "preview",
    };

    const { unmount } = render(<App />);

    expect(screen.getByText("preview")).toHaveClass("inshell-preview-watermark");

    unmount();
    (globalThis as any).__VITE_ENV__ = {
      VITE_DEPLOY_ENV: "production",
    };
    render(<App />);

    expect(screen.queryByText("preview")).toBeNull();
  });

  test.each([
    ["/pulse", "pulse"],
    ["/color-font", "color_font"],
    ["/path", "path_tokens"],
    ["/verify", "verify"],
  ])("sepolia invite exposes floating report bug link on %s", async (route, state) => {
    window.history.pushState({}, "", route);
    (globalThis as any).__VITE_ENV__ = {
      VITE_PUBLIC_LAUNCH_MODE: "sepolia_invite",
      VITE_REPORT_BUG_URL: "https://github.com/inshell-art/inshell.art/issues/new?template=sepolia-bug.md",
      VITE_DEBUG_PANEL: "off",
    };

    render(<App />);
    if (route === "/color-font" || route === "/path") {
      await flushAsyncEffects();
    }

    const report = screen.getByRole("link", { name: "Report a Sepolia bug" });
    expect(report.className).toContain("inshell-report-bug-link--floating");
    const url = new window.URL(report.getAttribute("href") ?? "");
    expect(url.searchParams.get("body")).toContain(`page: ${route}`);
    expect(url.searchParams.get("body")).toContain(`state: ${state}`);
  });
});
