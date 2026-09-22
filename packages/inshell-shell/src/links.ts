export function isInshellPagesPreviewHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "inshell-art.pages.dev" ||
    normalized.endsWith(".inshell-art.pages.dev")
  );
}

function isPreviewHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "preview.inshell.art" ||
    normalized.endsWith(".preview.inshell.art") ||
    isInshellPagesPreviewHost(normalized) ||
    normalized === "thought-inshell-art.pages.dev" ||
    normalized.endsWith(".thought-inshell-art.pages.dev")
  );
}

function sameOriginLinks(origin: string) {
  return {
    home: origin,
    path: `${origin}/path`,
    thought: `${origin}/thought`,
    works: `${origin}/gallery`,
    docs: `${origin}/docs`,
    x: "https://twitter.com/inshell_art",
  };
}

export function resolveInshellLinksForLocation({
  hostname,
  origin,
}: {
  hostname: string;
  origin: string;
}) {
  if (
    isLocalRuntimeHost(hostname) ||
    hostname === "preview.inshell.art" ||
    isInshellPagesPreviewHost(hostname)
  ) {
    return sameOriginLinks(origin);
  }
  if (isPreviewHost(hostname)) {
    return sameOriginLinks("https://preview.inshell.art");
  }
  return sameOriginLinks("https://inshell.art");
}

export function isLocalRuntimeHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return false;
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  return /^(?:fc|fd|fe8|fe9|fea|feb)[0-9a-f]*:/i.test(normalized);
}

export function resolveInshellLinks() {
  if (typeof window === "undefined") {
    return {
      home: "https://inshell.art/",
      path: "https://inshell.art/path",
      thought: "https://inshell.art/thought",
      works: "https://inshell.art/gallery",
      docs: "https://inshell.art/docs",
      x: "https://twitter.com/inshell_art",
    };
  }
  return resolveInshellLinksForLocation(window.location);
}
