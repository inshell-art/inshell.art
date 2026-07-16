function getEnvValue(name: string): unknown {
  const envCache: Record<string, any> | undefined = (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined = (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function isPreviewHost(hostname: string): boolean {
  return (
    hostname === "preview.inshell.art" ||
    hostname.endsWith(".preview.inshell.art") ||
    hostname === "staging.inshell-art.pages.dev" ||
    hostname === "staging.thought-inshell-art.pages.dev" ||
    (hostname.startsWith("staging.") && hostname.endsWith(".pages.dev"))
  );
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function configuredUrl(name: string): string | null {
  const value = getEnvValue(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") ? trimmed : null;
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
  if (isLocalHost(hostname)) {
    return {
      home: origin,
      path: `${origin}/path`,
      thought: configuredUrl("VITE_THOUGHT_URL") ?? `${origin}/thought`,
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
