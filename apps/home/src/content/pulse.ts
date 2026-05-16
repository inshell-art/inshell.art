export const PULSE_REPOSITORY_URL = "https://github.com/inshell-art/pulse";

export const PULSE = {
  title: "pulse",
  subtitle: "Pricing rule for the $PATH auction.",
  desmosUrl: "https://www.desmos.com/calculator/1d89f93d21",
  repositoryUrl: PULSE_REPOSITORY_URL,
  explanation: [
    "Pulse is the pricing rule for the public $PATH auction.",
    "It shapes the ask over time.",
    "A successful bid closes the current epoch and starts the next one.",
    "The start ask is raised by a time premium.",
    "Between bids, the ask decays toward the floor.",
    "Settlement samples the ask at bid time.",
  ],
  math: [
    "pump",
    "",
    "PTS = price-time scale",
    "elapsed time = bid time - previous curve start",
    "premium = elapsed time × PTS",
    "start ask = last price + premium",
    "floor b = last price",
    "",
    "",
    "drop",
    "",
    "ask(t) = b + floor(k / (t - a))",
    "(t - a) × (ask(t) - b) ≈ k",
    "",
    "b = floor",
    "k = curve constant",
    "a = anchor time",
  ].join("\n"),
  note: [
    "Pulse began as the Desmos sketch linked below.",
    "This page preserves the pricing shape, not implementation code.",
  ],
} as const;
