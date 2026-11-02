import { expect, test } from "@jest/globals";
import { maybeInstallCloudflareWebAnalytics, CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID } from "@inshell/shared";

test("compatibility installer never bypasses qualification or actual document", () => {
  for (const hostname of ["inshell.art", "thought.inshell.art", "preview.inshell.art", "127.0.0.1"]) {
    expect(maybeInstallCloudflareWebAnalytics({ document, hostname, env: {
      PROD: true, VITE_DEPLOY_ENV: "production", VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED: "true",
      VITE_CLOUDFLARE_WEB_ANALYTICS_SITE_TAG: "1".repeat(32), VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN: "2".repeat(32),
    } })).toBe(false);
    expect(document.getElementById(CLOUDFLARE_WEB_ANALYTICS_SCRIPT_ID)).toBeNull();
  }
});
