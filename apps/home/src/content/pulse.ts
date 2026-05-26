export const PULSE_REPOSITORY_URL = "https://github.com/inshell-art/pulse";

export const PULSE = {
  title: "pulse",
  subtitle: "Pricing rule for the $PATH auction.",
  desmosUrl: "https://www.desmos.com/calculator/1d89f93d21",
  repositoryUrl: PULSE_REPOSITORY_URL,
  explanation: [
    "Pulse is the pricing rule for the public $PATH auction.",
    "A Pulse cycle starts when a sale lifts the start ask.",
    "Elapsed time creates a time premium.",
    "The time premium lifts the start ask above the new floor.",
    "After the start ask, the curve decays toward floor.",
    "t½ marks when the above-floor amount has halved.",
  ],
  math: [
    "lift",
    "",
    "PTS = price-time scale",
    "duration = sale time - previous curve start",
    "time premium = duration × PTS",
    "start ask = floor + time premium",
    "floor = last sale price",
    "",
    "",
    "decay",
    "",
    "ask = k/(t-anchor) + floor",
    "(t-anchor) × (ask - floor) ≈ k",
    "",
    "k = curve constant",
    "anchor = curve start",
    "t½ = when above floor is halved",
  ].join("\n"),
  note: [
    "Pulse began as the Desmos sketch linked below.",
    "This page preserves the pricing shape, not implementation code.",
  ],
} as const;
