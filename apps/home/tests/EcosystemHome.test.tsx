import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockLoadThoughtGallery = jest.fn();

jest.mock("@/services/thoughtGallery", () => ({
  __esModule: true,
  isThoughtGalleryDeploymentActive: () => true,
  loadThoughtGallery: () => mockLoadThoughtGallery(),
  readCachedThoughtGallery: () => null,
}));

import EcosystemHome from "../src/components/EcosystemHome";

describe("EcosystemHome THOUGHT gallery", () => {
  beforeEach(() => {
    mockLoadThoughtGallery.mockReset();
    window.history.pushState({}, "", "/");
  });

  test("renders release-locked gallery records instead of static fixture works", async () => {
    mockLoadThoughtGallery.mockResolvedValue([
      {
        tokenId: 7,
        pathId: "12",
        minter: "0x0000000000000000000000000000000000000007",
        textHash: "0x01",
        promptHash: "0x02",
        provenanceHash: "0x03",
        thoughtSpecId: "0x04",
        thoughtSpecHash: "0x05",
        mintedAt: 1,
        rawText: "THE ANSWER",
        prompt: "THE QUESTION",
        mode: "agent",
        provider: "Codex",
        model: "gpt-5",
        returnedText: "THE ANSWER",
        returnedTextHash: "0x06",
        provenanceJson: "{}",
        image: "data:image/svg+xml,%3Csvg/%3E",
        tokenUri: "data:application/json,{}",
        txHash: "0x07",
        blockNumber: 99,
      },
    ]);

    render(<EcosystemHome />);

    await waitFor(() => {
      expect(screen.getByText("1 minted THOUGHT.")).toBeInTheDocument();
    });
    expect(screen.getByText("on Sepolia now")).toBeInTheDocument();
    expect(screen.getByLabelText("THOUGHT #7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open THOUGHT #7" })).toHaveAttribute(
      "href",
      "/thought/7",
    );
    expect(screen.getByAltText("THOUGHT #7")).toHaveAttribute(
      "src",
      "data:image/svg+xml,%3Csvg/%3E",
    );
    expect(screen.getByText("Agent: Codex")).toBeInTheDocument();
    expect(screen.getByText("Model: gpt-5")).toBeInTheDocument();
    expect(screen.queryByLabelText("THOUGHT V2 fixture works")).toBeNull();
  });

  test("focuses the linked THOUGHT after the home gallery loads", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: (time: number) => void) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: jest.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    try {
      mockLoadThoughtGallery.mockResolvedValue([
        {
          tokenId: 7,
          pathId: "12",
          minter: "0x0000000000000000000000000000000000000007",
          textHash: "0x01",
          promptHash: "0x02",
          provenanceHash: "0x03",
          thoughtSpecId: "0x04",
          thoughtSpecHash: "0x05",
          mintedAt: 1,
          rawText: "THE ANSWER",
          prompt: "THE QUESTION",
          mode: "agent",
          provider: "Codex",
          model: "gpt-5",
          returnedText: "THE ANSWER",
          returnedTextHash: "0x06",
          provenanceJson: "{}",
          image: "data:image/svg+xml,%3Csvg/%3E",
          tokenUri: "data:application/json,{}",
          txHash: "0x07",
          blockNumber: 99,
        },
      ]);
      window.history.pushState({}, "", "/#thought-7");

      render(<EcosystemHome />);

      const workLink = await screen.findByRole("link", {
        name: "Open THOUGHT #7",
      });
      const card = document.getElementById("thought-7");
      expect(card).toHaveClass("ecosystem-home__work-card--focused");
      expect(document.activeElement).toBe(workLink);
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        behavior: "auto",
      });
      fireEvent.animationEnd(workLink);
      expect(card).not.toHaveClass("ecosystem-home__work-card--focused");
    } finally {
      Object.defineProperty(window, "requestAnimationFrame", {
        configurable: true,
        value: originalRequestAnimationFrame,
      });
      Object.defineProperty(window, "cancelAnimationFrame", {
        configurable: true,
        value: originalCancelAnimationFrame,
      });
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete HTMLElement.prototype.scrollIntoView;
      }
    }
  });
});
