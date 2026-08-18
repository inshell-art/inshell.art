export type MainstreamPhoneTarget = {
  rank: number;
  model: string;
  playwrightDevice: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  browserEngine: "webkit" | "chromium";
  coverageRole: string;
};

/**
 * Canonical portrait browser targets, reviewed 2026-08-17.
 *
 * The rank is the priority of the regression target, informed by the dominant
 * global phone families and active installed-base viewport classes. It is not
 * presented as a live model-sales leaderboard. Viewports are CSS content
 * pixels from Playwright 1.60 device profiles and intentionally exclude
 * browser chrome.
 */
export const MAINSTREAM_PHONE_TARGETS: readonly MainstreamPhoneTarget[] = [
  { rank: 1, model: "iPhone 15 Pro Max", playwrightDevice: "iPhone 15 Pro Max", viewport: { width: 430, height: 739 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "large current iPhone" },
  { rank: 2, model: "iPhone 15 Pro", playwrightDevice: "iPhone 15 Pro", viewport: { width: 393, height: 659 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "current Pro iPhone" },
  { rank: 3, model: "iPhone 15 Plus", playwrightDevice: "iPhone 15 Plus", viewport: { width: 430, height: 739 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "large current iPhone" },
  { rank: 4, model: "iPhone 15", playwrightDevice: "iPhone 15", viewport: { width: 393, height: 659 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "current standard iPhone" },
  { rank: 5, model: "iPhone 14 Pro Max", playwrightDevice: "iPhone 14 Pro Max", viewport: { width: 430, height: 740 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "large installed-base iPhone" },
  { rank: 6, model: "iPhone 14 Pro", playwrightDevice: "iPhone 14 Pro", viewport: { width: 393, height: 660 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "installed-base Pro iPhone" },
  { rank: 7, model: "iPhone 14 Plus", playwrightDevice: "iPhone 14 Plus", viewport: { width: 428, height: 746 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "large installed-base iPhone" },
  { rank: 8, model: "iPhone 14", playwrightDevice: "iPhone 14", viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "installed-base standard iPhone" },
  { rank: 9, model: "iPhone 13 Pro Max", playwrightDevice: "iPhone 13 Pro Max", viewport: { width: 428, height: 746 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "large long-lived iPhone" },
  { rank: 10, model: "iPhone 13", playwrightDevice: "iPhone 13", viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "long-lived standard iPhone" },
  { rank: 11, model: "iPhone 12 mini", playwrightDevice: "iPhone 12 Mini", viewport: { width: 375, height: 629 }, deviceScaleFactor: 3, browserEngine: "webkit", coverageRole: "operator device and compact iPhone" },
  { rank: 12, model: "iPhone SE (3rd generation)", playwrightDevice: "iPhone SE", viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, browserEngine: "webkit", coverageRole: "smallest supported iPhone viewport" },
  { rank: 13, model: "Samsung Galaxy S24", playwrightDevice: "Galaxy S24", viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, browserEngine: "chromium", coverageRole: "current Galaxy flagship" },
  { rank: 14, model: "Samsung Galaxy A55", playwrightDevice: "Galaxy A55", viewport: { width: 480, height: 1040 }, deviceScaleFactor: 2.25, browserEngine: "chromium", coverageRole: "mass-market large Android" },
  { rank: 15, model: "Google Pixel 7", playwrightDevice: "Pixel 7", viewport: { width: 412, height: 839 }, deviceScaleFactor: 2.625, browserEngine: "chromium", coverageRole: "mainstream Pixel" },
  { rank: 16, model: "Google Pixel 5", playwrightDevice: "Pixel 5", viewport: { width: 393, height: 727 }, deviceScaleFactor: 2.75, browserEngine: "chromium", coverageRole: "compact Pixel installed base" },
  { rank: 17, model: "Google Pixel 4a (5G)", playwrightDevice: "Pixel 4a (5G)", viewport: { width: 412, height: 765 }, deviceScaleFactor: 2.63, browserEngine: "chromium", coverageRole: "mid-size Android installed base" },
  { rank: 18, model: "Samsung Galaxy S8", playwrightDevice: "Galaxy S8", viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, browserEngine: "chromium", coverageRole: "narrow Galaxy installed base" },
  { rank: 19, model: "Samsung Galaxy S9+", playwrightDevice: "Galaxy S9+", viewport: { width: 320, height: 658 }, deviceScaleFactor: 4.5, browserEngine: "chromium", coverageRole: "narrowest tall Android viewport" },
  { rank: 20, model: "Motorola Moto G4", playwrightDevice: "Moto G4", viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, browserEngine: "chromium", coverageRole: "mass-market compact Android" },
] as const;
