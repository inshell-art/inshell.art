const fail = (message) => {
  throw new Error(`Detail surface contract check failed: ${message}`);
};

const mustInclude = (source, snippet, label) => {
  if (!source.includes(snippet)) fail(`${label} drifted`);
};

const selectorBlocks = (source, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...source.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))]
    .map((match) => match[1]);
};

const mustDeclare = (source, selector, declaration, label) => {
  const blocks = selectorBlocks(source, selector);
  if (!blocks.some((block) => block.includes(declaration))) {
    fail(`${label} must keep ${selector} ${declaration}`);
  }
};

const mustEndWithDeclaration = (source, selector, property, expected, label) => {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const declarations = selectorBlocks(source, selector).flatMap((block) =>
    [...block.matchAll(new RegExp(`${escapedProperty}\\s*:\\s*([^;]+);`, "g"))]
      .map((match) => match[1].trim()),
  );
  if (declarations.at(-1) !== expected) {
    fail(
      `${label} must end with ${selector} ${property}: ${expected}; found ${JSON.stringify(declarations)}`,
    );
  }
};

export function assertDetailSurfaceNavigation({
  contract,
  homeDetail,
  standaloneIndex,
  standaloneMain,
  restoredIndex,
  restoredMain,
}) {
  const homeReturn = contract.thoughtDetail.homeReturn;
  mustInclude(homeDetail, 'href={`/#thought-${tokenId}`}', "Home THOUGHT detail return href");
  mustInclude(homeDetail, homeReturn.label, "Home THOUGHT detail return label");
  mustInclude(
    standaloneIndex,
    `id="thought-detail-gallery-link" class="thought-detail__link" href="${homeReturn.productionOrigin}/">${homeReturn.label}</a>`,
    "standalone THOUGHT detail return",
  );
  mustInclude(
    standaloneMain,
    "thoughtDetailGalleryLink.href = inshellHomeUrl(ROUTE_THOUGHT_NFT_ID);",
    "standalone THOUGHT detail return configuration",
  );
  mustInclude(
    standaloneMain,
    "url.hash = `thought-${targetTokenId}`;",
    "standalone THOUGHT detail return fragment",
  );
  mustInclude(
    restoredIndex,
    `id="thought-detail-gallery-link" class="thought-detail__link" href="${homeReturn.productionOrigin}/">${homeReturn.label}</a>`,
    "restored immutable snapshot detail return",
  );
  mustInclude(
    restoredMain,
    "thoughtDetailGalleryLink.href = inshellHomeUrl(ROUTE_THOUGHT_NFT_ID);",
    "restored immutable snapshot detail return configuration",
  );
}

export function assertDetailSurfaceActionLayout({
  contract,
  homeCss,
  standaloneCss,
  restoredCss,
}) {
  mustDeclare(homeCss, ".path-detail__title", "min-width: 0;", "Home PATH title");
  mustDeclare(homeCss, ".path-detail__links", "flex: 0 0 auto;", "Home PATH actions");
  mustDeclare(homeCss, ".path-detail__link", "white-space: nowrap;", "Home PATH action");

  for (const [label, css] of [
    ["Home THOUGHT", homeCss],
    ["standalone THOUGHT", standaloneCss],
    ["restored THOUGHT", restoredCss],
  ]) {
    mustDeclare(css, ".thought-detail__title", "min-width: 0;", `${label} title`);
    mustDeclare(css, ".thought-detail__links", "flex: 0 0 auto;", `${label} actions`);
    mustDeclare(css, ".thought-detail__link", "white-space: nowrap;", `${label} action`);
    mustEndWithDeclaration(
      css,
      ".thought-detail__dialogue-role",
      "color",
      contract.pathCanonicalVisuals.labelColor,
      `${label} work label`,
    );
    mustEndWithDeclaration(
      css,
      ".thought-detail__fields dt",
      "color",
      contract.pathCanonicalVisuals.labelColor,
      `${label} record key`,
    );
  }
}
