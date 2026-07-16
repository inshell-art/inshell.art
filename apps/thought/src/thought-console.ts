export type ThoughtConsoleInput = {
  time: string;
  title: string;
  detail?: string;
  actions?: string[];
};

const normalizeConsoleText = (value: string) => value.trim();

export const buildThoughtConsoleLines = ({
  time,
  title,
  detail = "",
  actions = [],
}: ThoughtConsoleInput) => {
  const normalizedTitle = normalizeConsoleText(title);
  const normalizedDetail = normalizeConsoleText(detail);
  const normalizedActions = actions
    .map(normalizeConsoleText)
    .filter(Boolean);
  const lines = [`[${normalizeConsoleText(time)}] ${normalizedTitle}`];

  if (
    normalizedDetail &&
    normalizedDetail.toLowerCase() !== normalizedTitle.toLowerCase()
  ) {
    lines.push(normalizedDetail);
  }

  if (normalizedActions.length > 0) {
    lines.push(`next: ${normalizedActions.join(" / ")}`);
  }

  return lines;
};
