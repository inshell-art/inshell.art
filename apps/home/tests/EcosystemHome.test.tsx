import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
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
      "/api/thought-image?id=7",
    );
    expect(screen.getByText("Agent: Codex")).toBeInTheDocument();
    expect(screen.queryByLabelText("THOUGHT V2 fixture works")).toBeNull();
  });
});
