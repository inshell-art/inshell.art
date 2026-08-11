export const canonicalThoughtExternalUrlBase = "https://inshell.art/thought/";
export const canonicalThoughtMarketplaceTraitOrder = Object.freeze([
  "Agent",
  "Model",
  "Creation Attestation",
  "Prompt Bytes",
  "Agent Bytes",
]);
export const redundantThoughtMarketplaceTraits = Object.freeze([
  "Pair Bytes",
  "Prompt Length",
  "Agent Length",
]);

export const thoughtExternalUrlLegacyArtifacts = new Set([
  "thought-v2-noncanonical-integration-preview-20260731-r8",
]);

export const canonicalThoughtExternalUrl = (tokenId) =>
  `${canonicalThoughtExternalUrlBase}${BigInt(String(tokenId)).toString(10)}`;

export const verifyThoughtMarketplaceTraits = (attributes, tokenId = "unknown") => {
  if (!Array.isArray(attributes)) {
    throw new Error(`metadata portability gate: token ${tokenId} attributes are missing`);
  }
  const names = attributes.map((attribute) => attribute?.trait_type);
  if (JSON.stringify(names) !== JSON.stringify(canonicalThoughtMarketplaceTraitOrder)) {
    throw new Error(
      `metadata portability gate: token ${tokenId} trait order is ${JSON.stringify(names)}; ` +
      `expected ${JSON.stringify(canonicalThoughtMarketplaceTraitOrder)}`,
    );
  }
  for (const name of ["Agent", "Model", "Creation Attestation"]) {
    const trait = attributes.find((attribute) => attribute.trait_type === name);
    if (typeof trait?.value !== "string" || trait.value.length === 0) {
      throw new Error(`metadata portability gate: token ${tokenId} ${name} trait is invalid`);
    }
  }
  for (const name of ["Prompt Bytes", "Agent Bytes"]) {
    const trait = attributes.find((attribute) => attribute.trait_type === name);
    if (
      trait?.display_type !== "number" ||
      trait?.max_value !== 64 ||
      !Number.isInteger(trait?.value) ||
      trait.value < 1 ||
      trait.value > 64
    ) {
      throw new Error(`metadata portability gate: token ${tokenId} ${name} trait is invalid`);
    }
  }
  return { traitOrder: [...canonicalThoughtMarketplaceTraitOrder] };
};

export const verifyThoughtMetadataPortability = ({
  artifactId,
  decodedExamples = [],
  metadataProfile,
  requirePortableTraits = false,
}) => {
  if (thoughtExternalUrlLegacyArtifacts.has(artifactId)) {
    return {
      externalUrlRequired: false,
      reason: "explicit pre-external_url integration-preview grandfather",
    };
  }

  if (!metadataProfile?.marketplaceRequired?.includes("external_url")) {
    throw new Error("metadata portability gate: external_url is not marketplace-required");
  }
  if (decodedExamples.length === 0) {
    throw new Error("metadata portability gate: tokenURI fixtures contain no decoded examples");
  }

  if (
    requirePortableTraits &&
    JSON.stringify(metadataProfile?.attributeOrder) !==
      JSON.stringify(canonicalThoughtMarketplaceTraitOrder)
  ) {
    throw new Error(
      `metadata portability gate: metadata profile trait order is ` +
      `${JSON.stringify(metadataProfile?.attributeOrder ?? [])}; expected ` +
      `${JSON.stringify(canonicalThoughtMarketplaceTraitOrder)}`,
    );
  }

  for (const example of decodedExamples) {
    const rawTokenId = example?.metadata?.thought?.mint?.tokenId ?? example?.tokenId;
    if (!example?.metadata || rawTokenId === undefined || rawTokenId === null) {
      throw new Error("metadata portability gate: decoded fixture is missing token identity");
    }
    const expected = canonicalThoughtExternalUrl(rawTokenId);
    if (example.metadata.external_url !== expected) {
      throw new Error(
        `metadata portability gate: external_url mismatch for token ${BigInt(String(rawTokenId))}: ${example.metadata.external_url ?? "missing"}`,
      );
    }
    if (requirePortableTraits) {
      verifyThoughtMarketplaceTraits(example.metadata.attributes, BigInt(String(rawTokenId)));
    }
  }

  return {
    canonicalExternalUrlBase: canonicalThoughtExternalUrlBase,
    externalUrlRequired: true,
    ...(requirePortableTraits ? { marketplaceTraitsVerified: true } : {}),
    verifiedExamples: decodedExamples.length,
  };
};
