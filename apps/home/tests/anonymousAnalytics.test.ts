import { expect, test, jest } from "@jest/globals";
import { installInshellAnonymousAnalytics, trackInshellAnonymousAnalytics } from "@inshell/shared";

test("legacy tracker is inert and preserves saved work and historical identities", () => {
  const keys = ["saved-work", "inshell.analytics.visitor.v1", "inshell.analytics.session.v1", "inshell.analytics.visit.v1"];
  for (const key of keys) localStorage.setItem(key, "retained");
  const originalFetch = window.fetch;
  const originalPush = window.history.pushState;
  const listener = jest.spyOn(window, "addEventListener");
  expect(installInshellAnonymousAnalytics({ window, document, hostname: "inshell.art", env: { VITE_INSHELL_ANALYTICS_ENABLED: "true" } })).toBe(false);
  expect(trackInshellAnonymousAnalytics({ eventType: "wallet_connect_started" })).toBe(false);
  expect(listener).not.toHaveBeenCalled();
  expect(window.fetch).toBe(originalFetch);
  expect(window.history.pushState).toBe(originalPush);
  for (const key of keys) expect(localStorage.getItem(key)).toBe("retained");
  listener.mockRestore();
});
