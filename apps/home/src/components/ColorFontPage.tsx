import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { maybeResolveAddress } from "@inshell/contracts";
import {
  getChainId,
  getCode,
  getDefaultProvider,
  hashUtf8String,
  type ProviderInterface,
} from "@inshell/ethereum";
import { COLOR_FONT } from "@/content/colorFont";

type ColorGlyph = {
  letter: string;
  index: number;
  name: string;
  hex: string;
};

type ColorFontDoc = {
  loadKind: "onchain" | "fallback";
  loadedFrom: string;
  authority: string;
  authorityTitle?: string;
  authorityUrl?: string;
  chain: string;
  id: string;
  version: string;
  format: string;
  hash: string;
  mirror: string;
  raw: string;
  glyphs: ColorGlyph[];
  warning?: string[];
  status: string;
  repositoryUrl: string;
};

type ColorFontState =
  | { kind: "loading" }
  | { kind: "ready"; doc: ColorFontDoc }
  | { kind: "error"; title: string; detail: string };

type WordReplacement = {
  word: string;
  x: number;
  y: number;
  width: number;
  height: number;
  letterSize: number;
  backgroundColor: string;
};

type WordMatch = {
  word: string;
  start: number;
  end: number;
};

type CaretDocument = globalThis.Document & {
  caretRangeFromPoint?: (x: number, y: number) => globalThis.Range | null;
  caretPositionFromPoint?: (
    x: number,
    y: number
  ) => { offsetNode: globalThis.Node; offset: number } | null;
};

const THOUGHT_NFT_COLOR_FONT_METHODS = {
  colorFontId: "0xa61ca744",
  colorFontVersion: "0xdf495573",
  colorFontData: "0xc6cc9e6f",
  colorFontHash: "0x2d53d7de",
} as const;

const COLOR_FONT_LOADED_FROM_ONCHAIN = "ThoughtNFT.colorFontData()";
const COLOR_FONT_LOADED_FROM_FALLBACK = "frontend mirror fallback";
const COLOR_FONT_AUTHORITY_UNAVAILABLE =
  "onchain color font ABI unavailable";
const FALLBACK_STATUS =
  `authority: ${COLOR_FONT_AUTHORITY_UNAVAILABLE}\nsource: ${COLOR_FONT_LOADED_FROM_FALLBACK}\nmirror: ${COLOR_FONT.mirror}`;
const FALLBACK_WARNING = [
  "warning: onchain color font could not be loaded.",
  "showing bundled mirror copy.",
];
const HASH_MISMATCH_WARNING = [
  "warning: color font hash mismatch.",
  "loaded data does not match contract hash.",
];

function dataHtmlHref(html: string) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function rawMappingDocument(doc: ColorFontDoc) {
  return [
    "THOUGHT Color Font v1",
    `source: ${doc.loadedFrom}`,
    `authority: ${doc.authority}`,
    `chain: ${doc.chain}`,
    `hash: ${doc.hash}`,
    "",
    ...(doc.warning ? [...doc.warning, ""] : []),
    doc.raw,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rawMappingHtml(doc: ColorFontDoc) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>THOUGHT Color Font v1</title>",
    "<style>",
    "body{margin:24px;background:#fff;color:#111;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}",
    "pre{white-space:pre-wrap;margin:0;}",
    "</style>",
    "</head>",
    "<body>",
    `<pre>${escapeHtml(rawMappingDocument(doc))}</pre>`,
    "</body>",
    "</html>",
  ].join("");
}

function createRawMappingHref(doc: ColorFontDoc) {
  const html = rawMappingHtml(doc);
  if (
    typeof globalThis.URL === "undefined" ||
    typeof globalThis.URL.createObjectURL !== "function" ||
    typeof globalThis.Blob === "undefined"
  ) {
    return dataHtmlHref(html);
  }
  return globalThis.URL.createObjectURL(
    new globalThis.Blob([html], { type: "text/html;charset=utf-8" })
  );
}

function getEnv(name: string): string | undefined {
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  const value = envCache?.[name] ?? procEnv?.[name];
  return typeof value === "string" ? value : undefined;
}

function resolveThoughtNftAddress() {
  return (
    maybeResolveAddress("thought_nft") ??
    maybeResolveAddress("thought_nft_address")
  );
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function chainLabelFromNetwork(network: string | undefined): string | undefined {
  switch (network?.toLowerCase()) {
    case "mainnet":
    case "ethereum":
    case "prod":
    case "production":
      return "Ethereum";
    case "sepolia":
      return "Sepolia (11155111)";
    case "devnet":
    case "local":
    case "localhost":
      return "Local Devnet";
    default:
      return undefined;
  }
}

function chainLabelFromChainId(chainId: bigint): string {
  if (chainId === 1n) return "Ethereum";
  if (chainId === 11155111n) return "Sepolia (11155111)";
  if (chainId === 31337n || chainId === 1337n) return "Local Devnet";
  return `Chain ${chainId.toString()}`;
}

function fallbackChainLabel(): string {
  return chainLabelFromNetwork(getEnv("VITE_NETWORK")) ?? "Local Devnet";
}

function explorerUrl(chainId: bigint, address: string): string | undefined {
  if (chainId === 1n) return `https://etherscan.io/address/${address}`;
  if (chainId === 11155111n) {
    return `https://sepolia.etherscan.io/address/${address}`;
  }
  return undefined;
}

function onchainStatus(authority: string) {
  return [
    `authority: ${authority}`,
    `source: ${COLOR_FONT_LOADED_FROM_ONCHAIN}`,
    `mirror: ${COLOR_FONT.mirror}`,
  ].join("\n");
}

function colorLabel(glyph: ColorGlyph): string {
  const name = `${glyph.name.charAt(0).toUpperCase()}${glyph.name.slice(1)}`;
  return `${glyph.letter}:${name}:${glyph.hex}`;
}

function fallbackDoc(): ColorFontDoc {
  return {
    loadKind: "fallback",
    loadedFrom: COLOR_FONT_LOADED_FROM_FALLBACK,
    authority: COLOR_FONT_AUTHORITY_UNAVAILABLE,
    chain: fallbackChainLabel(),
    id: COLOR_FONT.id,
    version: COLOR_FONT.version,
    format: COLOR_FONT.format,
    hash: COLOR_FONT.hash,
    mirror: COLOR_FONT.mirror,
    raw: COLOR_FONT.raw,
    glyphs: [...COLOR_FONT.glyphs],
    warning: FALLBACK_WARNING,
    status: FALLBACK_STATUS,
    repositoryUrl: COLOR_FONT.repositoryUrl,
  };
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function hexToUtf8(hex: string): string {
  const clean = stripHexPrefix(hex);
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16);
  }
  return new TextDecoder().decode(bytes);
}

function decodeAbiString(result: string): string {
  const clean = stripHexPrefix(result);
  if (clean.length < 128) throw new Error("contract returned no mapping data.");

  const offset = Number(BigInt(`0x${clean.slice(0, 64)}`)) * 2;
  const length = Number(BigInt(`0x${clean.slice(offset, offset + 64)}`));
  const start = offset + 64;
  const end = start + length * 2;
  if (!Number.isFinite(offset) || !Number.isFinite(length) || end > clean.length) {
    throw new Error("contract returned no mapping data.");
  }
  return hexToUtf8(clean.slice(start, end));
}

function decodeBytes32(result: string): string {
  const clean = stripHexPrefix(result);
  if (clean.length < 64) throw new Error("contract returned no mapping data.");
  return `0x${clean.slice(0, 64)}`;
}

async function ethCall(
  provider: ProviderInterface,
  contractAddress: string,
  data: string
) {
  if (typeof provider.request !== "function") {
    throw new Error("RPC read failed.");
  }
  const result = (await provider.request({
    method: "eth_call",
    params: [{ to: contractAddress, data }, "latest"],
  })) as string | undefined;
  if (!result || result === "0x") {
    throw new Error("contract returned no mapping data.");
  }
  return result;
}

async function optionalEthCall(
  provider: ProviderInterface,
  contractAddress: string,
  data: string
) {
  try {
    return await ethCall(provider, contractAddress, data);
  } catch {
    return undefined;
  }
}

function parseColorFontData(raw: string): ColorGlyph[] | null {
  const lines = raw.split("\n");
  if (lines.length !== 26) return null;

  const glyphs: ColorGlyph[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const expectedLetter = String.fromCharCode(65 + index);
    const match = lines[index].match(
      /^([A-Z]):([1-9]|1\d|2[0-6]):([a-z][a-z ]*):(#[0-9a-f]{6})$/
    );
    if (!match) return null;
    const [, letter, ordinal, name, hex] = match;
    if (letter !== expectedLetter || Number(ordinal) !== index + 1) return null;
    glyphs.push({ letter, index: Number(ordinal), name, hex });
  }
  return glyphs;
}

async function fetchOnchainColorFont(): Promise<ColorFontDoc | null> {
  const contractAddress = resolveThoughtNftAddress();
  if (!contractAddress) return null;

  const provider = getDefaultProvider();
  const code = await getCode(provider, contractAddress);
  if (!code || code === "0x") throw new Error("RPC read failed.");

  const dataResult = await ethCall(
    provider,
    contractAddress,
    THOUGHT_NFT_COLOR_FONT_METHODS.colorFontData
  );
  const [idResult, versionResult, hashResult] = await Promise.all([
    optionalEthCall(
      provider,
      contractAddress,
      THOUGHT_NFT_COLOR_FONT_METHODS.colorFontId
    ),
    optionalEthCall(
      provider,
      contractAddress,
      THOUGHT_NFT_COLOR_FONT_METHODS.colorFontVersion
    ),
    optionalEthCall(
      provider,
      contractAddress,
      THOUGHT_NFT_COLOR_FONT_METHODS.colorFontHash
    ),
  ]);

  const raw = decodeAbiString(dataResult);
  if (!raw) throw new Error("contract returned no mapping data.");

  const computedHash = hashUtf8String(raw);
  const hash = hashResult ? decodeBytes32(hashResult) : computedHash;
  const warning = hashResult
    ? computedHash.toLowerCase() === hash.toLowerCase()
      ? undefined
      : HASH_MISMATCH_WARNING
    : [
        "warning: ThoughtNFT.colorFontHash() unavailable.",
        "showing computed hash for loaded data.",
      ];

  const glyphs = parseColorFontData(raw);
  if (!glyphs) throw new Error("contract returned no mapping data.");

  const chainId = await getChainId(provider);
  const authority = `ThoughtNFT ${shortenAddress(contractAddress)}`;

  return {
    loadKind: "onchain",
    loadedFrom: COLOR_FONT_LOADED_FROM_ONCHAIN,
    authority,
    authorityTitle: `ThoughtNFT ${contractAddress}`,
    authorityUrl: explorerUrl(chainId, contractAddress),
    chain: chainLabelFromChainId(chainId),
    id: idResult ? decodeAbiString(idResult) || COLOR_FONT.id : COLOR_FONT.id,
    version: versionResult
      ? decodeAbiString(versionResult) || COLOR_FONT.version
      : COLOR_FONT.version,
    format: COLOR_FONT.format,
    hash,
    mirror: COLOR_FONT.mirror,
    raw,
    glyphs,
    warning,
    status: onchainStatus(authority),
    repositoryUrl: COLOR_FONT.repositoryUrl,
  };
}

function getWordAt(text: string, offset: number): WordMatch | null {
  const index = Math.max(0, Math.min(offset, text.length));
  const words = text.matchAll(/[A-Za-z0-9]+/g);
  for (const match of words) {
    const word = match[0];
    const start = match.index ?? 0;
    const end = start + word.length;
    if (index >= start && index <= end) return { word, start, end };
  }
  return null;
}

function getWordReplacementFromTextNode(
  node: globalThis.Node,
  offset: number,
  x: number,
  y: number
): WordReplacement | null {
  if (node.nodeType !== globalThis.Node.TEXT_NODE) return null;

  const match = getWordAt(node.textContent ?? "", offset);
  if (!match) return null;

  const range = document.createRange();
  range.setStart(node, match.start);
  range.setEnd(node, match.end);

  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0
  );
  const rect =
    rects.find(
      (candidate) =>
        x >= candidate.left &&
        x <= candidate.right &&
        y >= candidate.top &&
        y <= candidate.bottom
    ) ?? null;
  if (!rect) return null;

  return {
    word: match.word,
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    letterSize: rect.width / match.word.length,
    backgroundColor: "var(--bg-body)",
  };
}

function getWordReplacementFromPoint(x: number, y: number): WordReplacement | null {
  const doc = document as CaretDocument;
  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) {
    return getWordReplacementFromTextNode(
      range.startContainer,
      range.startOffset,
      x,
      y
    );
  }

  const position = doc.caretPositionFromPoint?.(x, y);
  return position
    ? getWordReplacementFromTextNode(position.offsetNode, position.offset, x, y)
    : null;
}

function isVisibleBackground(backgroundColor: string) {
  return (
    backgroundColor !== "" &&
    backgroundColor !== "transparent" &&
    backgroundColor !== "rgba(0, 0, 0, 0)"
  );
}

function getReplacementBackground(target: globalThis.Element | null) {
  let current: globalThis.Element | null = target;
  while (current) {
    const backgroundColor = window.getComputedStyle(current).backgroundColor;
    if (isVisibleBackground(backgroundColor)) return backgroundColor;
    current = current.parentElement;
  }
  return window.getComputedStyle(document.body).backgroundColor || "var(--bg-body)";
}

export default function ColorFontPage() {
  const [state, setState] = useState<ColorFontState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);
  const [wordReplacement, setWordReplacement] =
    useState<WordReplacement | null>(null);
  const doc = state.kind === "ready" ? state.doc : null;
  const glyphByLetter = useMemo(
    () =>
      new Map<string, string>(
        (doc?.glyphs ?? []).map((glyph) => [glyph.letter, glyph.hex])
      ),
    [doc]
  );
  const rawMappingHref = useMemo(
    () => (doc?.loadKind === "onchain" ? createRawMappingHref(doc) : null),
    [doc]
  );

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    async function loadColorFont() {
      try {
        const onchainDoc = await fetchOnchainColorFont();
        if (cancelled) return;
        setState({ kind: "ready", doc: onchainDoc ?? fallbackDoc() });
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "ready", doc: fallbackDoc() });
      }
    }

    void loadColorFont();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  useEffect(() => {
    return () => {
      if (rawMappingHref?.startsWith("blob:")) {
        globalThis.URL.revokeObjectURL(rawMappingHref);
      }
    };
  }, [rawMappingHref]);

  function handleWordMouseMove(event: MouseEvent<HTMLElement>) {
    if (!doc) return;
    const target =
      event.target instanceof globalThis.Element ? event.target : null;
    if (target?.closest(".color-font-page__glyph")) {
      setWordReplacement(null);
      return;
    }

    const nextReplacement = getWordReplacementFromPoint(
      event.clientX,
      event.clientY
    );
    if (!nextReplacement) {
      setWordReplacement(null);
      return;
    }
    nextReplacement.backgroundColor = getReplacementBackground(target);
    setWordReplacement((current) => {
      if (
        current?.word === nextReplacement.word &&
        Math.abs(current.x - nextReplacement.x) < 1 &&
        Math.abs(current.y - nextReplacement.y) < 1 &&
        Math.abs(current.width - nextReplacement.width) < 1 &&
        Math.abs(current.height - nextReplacement.height) < 1 &&
        current.backgroundColor === nextReplacement.backgroundColor
      ) {
        return current;
      }
      return nextReplacement;
    });
  }

  return (
    <main
      className="primitive-page color-font-page"
      aria-labelledby="color-font-page-title"
      onMouseMove={handleWordMouseMove}
      onMouseLeave={() => setWordReplacement(null)}
    >
      <header className="primitive-page__header">
        <div className="color-font-page__masthead">
          <div className="color-font-page__title-stack">
            <h1 id="color-font-page-title" className="primitive-page__title">
              {COLOR_FONT.title}
            </h1>
            {doc ? (
              <div
                className="color-font-page__glyphs"
                aria-label="A-Z color glyph preview"
              >
                {doc.glyphs.map((glyph) => {
                  const value = colorLabel(glyph);
                  return (
                    <span
                      key={glyph.letter}
                      className="color-font-page__glyph"
                      style={{ backgroundColor: glyph.hex }}
                      data-label={value}
                      role="img"
                      aria-label={`${glyph.letter}, ${glyph.name}, ${glyph.hex}`}
                      tabIndex={0}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
          <p className="primitive-page__subtitle">{COLOR_FONT.subtitle}</p>
        </div>
      </header>

      {state.kind === "loading" ? (
        <section className="primitive-page__body" aria-live="polite">
          <p className="primitive-page__status">loading color font from contract...</p>
        </section>
      ) : state.kind === "error" ? (
        <section className="primitive-page__body" aria-live="polite">
          <div className="primitive-page__copy">
            <p>{state.title}</p>
            <p>{state.detail}</p>
          </div>
        </section>
      ) : (
        <section className="primitive-page__body" aria-label="Color Font primitive note">
          {state.doc.warning ? (
            <div className="primitive-page__warning" aria-live="polite">
              {state.doc.warning.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}

          <div className="primitive-page__copy">
            <p>
              {COLOR_FONT.copy[0]}
              <br />
              {COLOR_FONT.copy[1]}
            </p>
            <p>
              {COLOR_FONT.copy[2]}
              <br />
              {COLOR_FONT.copy[3]}
            </p>
          </div>

          <dl className="primitive-page__fields" aria-label="Color Font authority">
            <div>
              <dt>authority</dt>
              <dd title={state.doc.authorityTitle}>
                {state.doc.authorityUrl ? (
                  <a
                    href={state.doc.authorityUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={state.doc.authorityTitle}
                  >
                    {state.doc.authority}
                  </a>
                ) : (
                  state.doc.authority
                )}
              </dd>
            </div>
            <div>
              <dt>chain</dt>
              <dd>{state.doc.chain}</dd>
            </div>
            <div>
              <dt>loaded from</dt>
              <dd>{state.doc.loadedFrom}</dd>
            </div>
            <div>
              <dt>id</dt>
              <dd>{state.doc.id}</dd>
            </div>
            <div>
              <dt>version</dt>
              <dd>{state.doc.version}</dd>
            </div>
            <div>
              <dt>format</dt>
              <dd>{state.doc.format}</dd>
            </div>
            <div>
              <dt>hash</dt>
              <dd>{state.doc.hash}</dd>
            </div>
            <div>
              <dt>mirror</dt>
              <dd>{state.doc.mirror}</dd>
            </div>
          </dl>

          <pre className="primitive-page__raw" aria-label="Raw color font mapping">
            {state.doc.raw}
          </pre>

          <nav className="primitive-page__links" aria-label="Color Font references">
            {rawMappingHref ? (
              <a href={rawMappingHref} target="_blank" rel="noopener noreferrer">
                Open raw onchain data ↗
              </a>
            ) : (
              <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                Retry onchain load
              </button>
            )}
            <a
              href={state.doc.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={state.doc.repositoryUrl}
            >
              View GitHub mirror ↗
            </a>
          </nav>

          <p className="primitive-page__status" aria-live="polite">
            {state.doc.status}
          </p>
        </section>
      )}
      {wordReplacement && glyphByLetter.size > 0 ? (
        <div
          className="color-font-page__word-replacement"
          style={
            {
              left: wordReplacement.x,
              top: wordReplacement.y,
              width: wordReplacement.width,
              height: wordReplacement.height,
              backgroundColor: wordReplacement.backgroundColor,
              "--color-font-word-square-size": `${wordReplacement.letterSize}px`,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          {wordReplacement.word.split("").map((character, index) => {
            const color = glyphByLetter.get(character.toUpperCase());
            return color ? (
              <span
                key={`${character}-${index}`}
                className="color-font-page__word-square"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            ) : (
              <span
                key={`${character}-${index}`}
                className="color-font-page__word-square color-font-page__word-square--empty"
                aria-hidden="true"
              />
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
