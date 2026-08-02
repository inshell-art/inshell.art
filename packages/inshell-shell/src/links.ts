function isPreviewHost(hostname: string): boolean {
  return (
    hostname === "preview.inshell.art" ||
    hostname.endsWith(".preview.inshell.art") ||
    hostname === "staging.inshell-art.pages.dev" ||
    hostname === "staging.thought-inshell-art.pages.dev" ||
    (hostname.startsWith("staging.") && hostname.endsWith(".pages.dev"))
  );
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
  const { hostname, origin } = window.location;
  if (isLocalRuntimeHost(hostname)) {
    return {
      home: origin,
      path: `${origin}/path`,
      thought: `${origin}/thought`,
      works: `${origin}/gallery`,
      docs: `${origin}/docs`,
      x: "https://twitter.com/inshell_art",
    };
  }
  if (isPreviewHost(hostname)) {
    return {
      home: "https://preview.inshell.art/",
      path: "https://preview.inshell.art/path",
      thought: "https://preview.inshell.art/thought",
      works: "https://preview.inshell.art/gallery",
      docs: "https://preview.inshell.art/docs",
      x: "https://twitter.com/inshell_art",
    };
  }
  return {
    home: "https://inshell.art/",
    path: "https://inshell.art/path",
    thought: "https://inshell.art/thought",
    works: "https://inshell.art/gallery",
    docs: "https://inshell.art/docs",
    x: "https://twitter.com/inshell_art",
  };
}
