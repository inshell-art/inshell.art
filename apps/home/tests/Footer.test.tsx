import React from "react";
import { afterEach, describe, expect, test } from "@jest/globals";
import { cleanup, render, screen } from "@testing-library/react";
import Footer from "../src/components/Footer/Footer";

describe("Footer after public-feed retirement", () => {
  const originalEnv = (globalThis as any).__VITE_ENV__;

  afterEach(() => {
    cleanup();
    (globalThis as any).__VITE_ENV__ = originalEnv;
  });

  test("retains project links without advertising RSS", () => {
    render(<Footer />);

    expect(screen.getByRole("navigation", { name: "Project links" })).toBeTruthy();
    for (const name of ["Open gallery", "Open Pulse", "Open color-font primitive page",
      "Open Telegram announcements channel", "Open X", "Open GitHub"]) {
      expect(screen.getByRole("link", { name, exact: true })).toBeTruthy();
    }
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.queryByRole("link", { name: /RSS|feed/i })).toBeNull();
  });

  test("old feed configuration cannot restore a retired link", () => {
    (globalThis as any).__VITE_ENV__ = {
      NODE_ENV: "test",
      VITE_PUBLIC_FEED_RSS_URL: "https://retired-feed.example/rss.xml",
      PUBLIC_FEED_RSS_URL: "/rss.sepolia.xml",
      VITE_GALLERY_URL: "/gallery",
    };
    render(<Footer />);

    expect(screen.getByRole("link", { name: "Open gallery" }).getAttribute("href"))
      .toBe("/gallery");
    expect(screen.getAllByRole("link").every((link) =>
      !/rss|feed/i.test(link.getAttribute("href") ?? ""))).toBe(true);
    expect(screen.queryByRole("link", { name: /RSS|feed/i })).toBeNull();
  });
});
