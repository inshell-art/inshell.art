import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import {
  isThoughtGalleryDeploymentActive,
  loadThoughtGallery,
  readCachedThoughtGallery,
} from "../src/services/thoughtGallery";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.localStorage.clear();
  jest.restoreAllMocks();
});

test("disabled production deployment cannot resurrect a legacy gallery cache", async () => {
  globalThis.localStorage.setItem(
    "inshell:thought-gallery:v1",
    JSON.stringify({ cachedAt: Date.now(), thoughts: [{ tokenId: 1 }] }),
  );
  const fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  expect(isThoughtGalleryDeploymentActive()).toBe(false);
  expect(readCachedThoughtGallery()).toBeNull();
  expect(globalThis.localStorage.getItem("inshell:thought-gallery:v1")).toBeNull();
  await expect(loadThoughtGallery()).rejects.toThrow(
    "Current THOUGHT collection is not deployed.",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
