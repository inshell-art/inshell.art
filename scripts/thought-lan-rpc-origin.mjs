const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension):\/\/([^/?#]+)$/;

const validExtensionHost = (scheme, host) => {
  if (scheme === "chrome-extension") return /^[a-p]{32}$/.test(host);
  if (scheme === "moz-extension") {
    return /^[a-z0-9][a-z0-9-]{14,126}[a-z0-9]$/i.test(host);
  }
  return /^[a-z0-9][a-z0-9.-]{1,253}[a-z0-9]$/i.test(host);
};

export const isAllowedLanRpcOrigin = (origin, homeOrigin) => {
  if (origin == null || origin === "") return true;
  if (origin === homeOrigin) return true;
  const match = EXTENSION_ORIGIN.exec(origin);
  return Boolean(match && validExtensionHost(match[1], match[2]));
};
