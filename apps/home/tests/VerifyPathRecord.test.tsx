import "@testing-library/jest-dom";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import VerifyPage from "../src/components/VerifyPage";

const CONTRACT = "0x1111222233334444555566667777888899990000";
const OWNER = "0x9999888877776666555544443333222211110000";
const TRANSACTION =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const mockParsePathVerificationTarget = jest.fn<any>();
const mockVerifyPathRecord = jest.fn<any>();

jest.mock("../src/services/pathVerification", () => ({
  parsePathVerificationTarget: (...args: unknown[]) =>
    mockParsePathVerificationTarget(...args),
  verifyPathRecord: (...args: unknown[]) => mockVerifyPathRecord(...args),
}));

function verificationResult(overrides: Record<string, unknown> = {}) {
  return {
    actualCodeHash: `0x${"a".repeat(64)}`,
    codeHashMatches: true,
    configuredChainId: 31337,
    configuredContract: CONTRACT,
    contractMatches: true,
    expectedCodeHash: `0x${"a".repeat(64)}`,
    metadataAttributeCount: 5,
    metadataName: "$PATH #4",
    observedAtBlock: 99,
    observedChainId: 31337,
    owner: OWNER,
    passed: true,
    target: {
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
      transactionHash: TRANSACTION,
    },
    tokenUri: "data:application/json;utf8,%7B%7D",
    transaction: {
      blockNumber: 98,
      from: OWNER,
      status: "confirmed",
      transferEvent: "matched",
      valueWei: "10000000000000000",
    },
    ...overrides,
  };
}

describe("PATH record verification page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, "", "/verify?type=path#verify-path-record");
    mockParsePathVerificationTarget.mockReturnValue({
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
      transactionHash: TRANSACTION,
    });
  });

  test("renders chain-read evidence and transaction facts", async () => {
    mockVerifyPathRecord.mockResolvedValue(verificationResult());
    render(<VerifyPage />);

    expect(screen.getByRole("heading", { name: "verify $PATH #4" })).toBeInTheDocument();
    expect(screen.getByText("reading chain...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("$PATH #4")).toBeInTheDocument());
    expect(screen.getByText(/verified at block/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/0xaaaa\.\.\.aaaa · confirmed/)).toBeInTheDocument();
    expect(screen.getByText("matched")).toBeInTheDocument();
    expect(screen.getByText("0.01 ETH")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "back to $PATH #4" })).toHaveAttribute(
      "href",
      "/path/4",
    );
    fireEvent.click(screen.getByText("raw evidence"));
    expect(screen.getAllByText(`0x${"a".repeat(64)}`)).toHaveLength(2);
  });

  test("shows mismatches returned by the chain verifier", async () => {
    mockVerifyPathRecord.mockResolvedValue(
      verificationResult({
        passed: false,
        codeHashMatches: false,
        contractMatches: false,
        transaction: null,
      }),
    );
    render(<VerifyPage />);

    await waitFor(() =>
      expect(screen.getByText(/verification mismatch at block/)).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/mismatch/).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("mint transaction")).not.toBeInTheDocument();
  });

  test("recovers from a failed chain read when retry succeeds", async () => {
    mockVerifyPathRecord
      .mockRejectedValueOnce(new Error("RPC unavailable"))
      .mockResolvedValueOnce(verificationResult());
    render(<VerifyPage />);

    await waitFor(() =>
      expect(screen.getByText("record verification unavailable.")).toHaveAttribute(
        "title",
        "RPC unavailable",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    await waitFor(() => expect(screen.getByText("$PATH #4")).toBeInTheDocument());
    expect(mockVerifyPathRecord).toHaveBeenCalledTimes(2);
  });

  test("surfaces malformed locator errors without calling the chain", () => {
    mockParsePathVerificationTarget.mockImplementation(() => {
      throw new Error("The verification link has an invalid chain ID.");
    });
    render(<VerifyPage />);

    expect(screen.getByRole("heading", { name: "verify $PATH #—" })).toBeInTheDocument();
    expect(screen.getByText("record verification unavailable.")).toHaveAttribute(
      "title",
      "The verification link has an invalid chain ID.",
    );
    expect(mockVerifyPathRecord).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "back to all $PATH" })).toHaveAttribute(
      "href",
      "/path",
    );
  });
});
