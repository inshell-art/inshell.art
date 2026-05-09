export const PULSE_REPOSITORY_URL = "https://github.com/inshell-art/pulse";

export const PULSE = {
  title: "pulse",
  subtitle: "An original pricing sketch for a decentralized automatic auction.",
  desmosUrl: "https://www.desmos.com/calculator/1d89f93d21",
  repositoryUrl: PULSE_REPOSITORY_URL,
  theory: [
    "Pulse is the pricing primitive behind the current $PATH auction.",
    "A sale pumps the ask upward.",
    "Silence lets the ask drop.",
    "During the drop phase, time and price follow an offset constant-product curve.",
    "The hammer price is sampled at settlement time.",
  ],
  formulas: ["xy = k", "f(x) = k / (x - a) + b"],
  note: [
    "This is not implementation code.",
    "It preserves the primitive pricing shape before implementation.",
  ],
} as const;
