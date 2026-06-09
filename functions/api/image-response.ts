import { json } from "./chain-cache";

const SVG_MIME = "image/svg+xml; charset=utf-8";
const SVG_CACHE_CONTROL = "public, max-age=60, s-maxage=60, stale-while-revalidate=240";

export function parseImageRequest(url: string): { id: string; format: "svg" } | Response {
  const parsed = new globalThis.URL(url);
  const id = parsed.searchParams.get("id")?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(id)) {
    return json(400, { error: "invalid token id" });
  }

  const format = (parsed.searchParams.get("format")?.trim().toLowerCase() || "svg") as string;
  if (format !== "svg") {
    return json(400, { error: "unsupported image format", format });
  }

  return { id, format };
}

export function svgFromImageSource(source: unknown): string | null {
  if (typeof source !== "string") return null;
  const trimmed = source.trim();
  if (/^<svg[\s>]/i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith("data:image/svg+xml")) return null;

  const commaIndex = trimmed.indexOf(",");
  if (commaIndex === -1) return null;

  const header = trimmed.slice(0, commaIndex).toLowerCase();
  const payload = trimmed.slice(commaIndex + 1);
  try {
    const decoded = header.includes(";base64")
      ? decodeBase64Utf8(payload)
      : decodeURIComponent(payload);
    return /^<svg[\s>]/i.test(decoded.trim()) ? decoded.trim() : null;
  } catch {
    return null;
  }
}

export function svgImageResponse(svg: string | null, filename: string): Response {
  if (!svg) {
    return json(404, { error: "SVG image unavailable" });
  }

  const headers = new Headers({
    "content-type": SVG_MIME,
    "cache-control": SVG_CACHE_CONTROL,
    "access-control-allow-origin": "*",
    "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
  });
  return new Response(svg, { status: 200, headers });
}

function decodeBase64Utf8(value: string): string {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
