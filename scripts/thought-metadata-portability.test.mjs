import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalThoughtMarketplaceTraitOrder,
  canonicalThoughtExternalUrl,
  verifyThoughtMarketplaceTraits,
  verifyThoughtMetadataPortability,
} from "./lib/thought-metadata-portability.mjs";

const profile = {
  marketplaceRequired: [
    "name",
    "description",
    "image",
    "external_url",
    "background_color",
    "attributes",
  ],
};
const example = (tokenId, externalUrl = canonicalThoughtExternalUrl(tokenId)) => ({
  metadata: {
    attributes: [
      { trait_type: "Agent", value: "Codex" },
      { trait_type: "Model", value: "gpt-5.6" },
      { trait_type: "Creation Attestation", value: "Inshell THOUGHT App" },
      { display_type: "number", max_value: 64, trait_type: "Prompt Bytes", value: 8 },
      { display_type: "number", max_value: 64, trait_type: "Agent Bytes", value: 13 },
    ],
    external_url: externalUrl,
    thought: { mint: { tokenId: String(tokenId) } },
  },
});

test("r8 is the only grandfathered pre-external_url artifact", () => {
  assert.deepEqual(
    verifyThoughtMetadataPortability({
      artifactId: "thought-v2-noncanonical-integration-preview-20260731-r8",
    }),
    {
      externalUrlRequired: false,
      reason: "explicit pre-external_url integration-preview grandfather",
    },
  );
});

test("later artifacts require external_url in the metadata profile", () => {
  assert.throws(
    () => verifyThoughtMetadataPortability({
      artifactId: "thought-v2-noncanonical-integration-preview-20260731-r9",
      decodedExamples: [example(1)],
      metadataProfile: { marketplaceRequired: ["name", "image"] },
    }),
    /external_url is not marketplace-required/,
  );
});

test("later artifacts require decoded tokenURI fixtures", () => {
  assert.throws(
    () => verifyThoughtMetadataPortability({
      artifactId: "thought-v2-noncanonical-integration-preview-20260731-r9",
      decodedExamples: [],
      metadataProfile: profile,
    }),
    /contain no decoded examples/,
  );
});

test("later artifacts require exact canonical same-origin URLs", () => {
  assert.throws(
    () => verifyThoughtMetadataPortability({
      artifactId: "thought-v2-noncanonical-integration-preview-20260731-r9",
      decodedExamples: [example(42, "https://thought.inshell.art/42")],
      metadataProfile: profile,
    }),
    /external_url mismatch for token 42/,
  );
});

test("later artifacts accept exact canonical URLs and canonical decimal token IDs", () => {
  assert.deepEqual(
    verifyThoughtMetadataPortability({
      artifactId: "thought-v2-noncanonical-integration-preview-20260731-r9",
      decodedExamples: [example("00042", "https://inshell.art/thought/42"), example(1)],
      metadataProfile: profile,
    }),
    {
      canonicalExternalUrlBase: "https://inshell.art/thought/",
      externalUrlRequired: true,
      verifiedExamples: 2,
    },
  );
});

test("portable marketplace traits have one exact nonredundant order", () => {
  assert.deepEqual(
    verifyThoughtMarketplaceTraits(example(1).metadata.attributes, 1),
    { traitOrder: [...canonicalThoughtMarketplaceTraitOrder] },
  );
});

test("portable marketplace traits reject r10's redundant length traits", () => {
  const attributes = [
    ...example(1).metadata.attributes,
    { display_type: "number", max_value: 128, trait_type: "Pair Bytes", value: 21 },
    { trait_type: "Prompt Length", value: "Compact" },
    { trait_type: "Agent Length", value: "Compact" },
  ];
  assert.throws(
    () => verifyThoughtMarketplaceTraits(attributes, 1),
    /trait order/,
  );
});

test("strict portability validates both the metadata profile and decoded traits", () => {
  assert.deepEqual(
    verifyThoughtMetadataPortability({
      artifactId: "thought-v2-canonical-portable-release-20260801-r1",
      decodedExamples: [example(1), example(2)],
      metadataProfile: {
        ...profile,
        attributeOrder: [...canonicalThoughtMarketplaceTraitOrder],
      },
      requirePortableTraits: true,
    }),
    {
      canonicalExternalUrlBase: "https://inshell.art/thought/",
      externalUrlRequired: true,
      marketplaceTraitsVerified: true,
      verifiedExamples: 2,
    },
  );
});

test("strict portability rejects a stale metadata profile before release acceptance", () => {
  assert.throws(
    () => verifyThoughtMetadataPortability({
      artifactId: "thought-v2-noncanonical-integration-preview-20260801-r10",
      decodedExamples: [example(1)],
      metadataProfile: {
        ...profile,
        attributeOrder: [
          ...canonicalThoughtMarketplaceTraitOrder,
          "Pair Bytes",
          "Prompt Length",
          "Agent Length",
        ],
      },
      requirePortableTraits: true,
    }),
    /metadata profile trait order/,
  );
});
