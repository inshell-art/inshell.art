import { describe, expect, test, beforeEach } from "@jest/globals";
import {
  CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID,
  maybeInstallCloudflareWebAnalytics,
} from "@inshell/shared";

const env = {
  VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "test-rum-token",
};

describe("Cloudflare Web Analytics install policy", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete (globalThis as any).__VITE_ENV__;
  });

  test("installs the beacon on production Inshell hosts", () => {
    expect(
      maybeInstallCloudflareWebAnalytics({
        document,
        env,
        hostname: "inshell.art",
      }),
    ).toBe(true);

    const script = document.getElementById(CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID);
    expect(script).not.toBeNull();
    expect(script?.getAttribute("src")).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(script?.getAttribute("data-cf-beacon")).toBe(
      JSON.stringify({ token: env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN }),
    );
  });

  test("does not install on preview, ops, pages.dev, or local hosts", () => {
    const blockedHosts = [
      "preview.inshell.art",
      "thought.preview.inshell.art",
      "gallery.preview.inshell.art",
      "ops.inshell.art",
      "staging.inshell-art.pages.dev",
      "127.0.0.1",
      "localhost",
    ];

    for (const hostname of blockedHosts) {
      document.head.innerHTML = "";
      expect(maybeInstallCloudflareWebAnalytics({ document, env, hostname })).toBe(false);
      expect(document.getElementById(CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID)).toBeNull();
    }
  });

  test("does not install without a token or duplicate an installed beacon", () => {
    expect(
      maybeInstallCloudflareWebAnalytics({ document, env: {}, hostname: "inshell.art" }),
    ).toBe(false);
    expect(
      maybeInstallCloudflareWebAnalytics({ document, env, hostname: "thought.inshell.art" }),
    ).toBe(true);
    expect(
      maybeInstallCloudflareWebAnalytics({ document, env, hostname: "thought.inshell.art" }),
    ).toBe(false);
    expect(document.querySelectorAll(`#${CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID}`)).toHaveLength(1);
  });
});
