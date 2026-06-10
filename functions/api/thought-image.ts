import { findThoughtRecord, onRequestOptions } from "./thought-record";
import { json, type PagesContextLike } from "./chain-cache";

export { onRequestOptions };

const SVG_CACHE_SECONDS = 5 * 60;

export async function onRequestGet(ctx: PagesContextLike): Promise<Response> {
  const thought = await findThoughtRecord(ctx);
  if (thought instanceof Response) return thought;

  const svg = decodeSvgImage(thought.image);
  if (!svg) {
    return json(404, { error: "THOUGHT image unavailable", id: thought.tokenId });
  }

  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": `public, max-age=${SVG_CACHE_SECONDS}, s-maxage=${SVG_CACHE_SECONDS}, stale-while-revalidate=86400`,
      "content-disposition": `inline; filename="thought-${thought.tokenId}.svg"`,
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    },
  });
}

function decodeSvgImage(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^<svg[\s>]/i.test(trimmed)) return trimmed;

  const commaIndex = trimmed.indexOf(",");
  if (!trimmed.startsWith("data:image/svg+xml") || commaIndex === -1) {
    return "";
  }

  try {
    const header = trimmed.slice(0, commaIndex).toLowerCase();
    const payload = trimmed.slice(commaIndex + 1);
    const decoded = header.includes(";base64")
      ? decodeBase64Utf8(payload)
      : decodeURIComponent(payload);
    return /^<svg[\s>]/i.test(decoded.trim()) ? decoded : "";
  } catch {
    return "";
  }
}

function decodeBase64Utf8(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
