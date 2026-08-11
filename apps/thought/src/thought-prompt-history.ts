export type ThoughtPromptHistoryCursor = {
  index: number | null;
  draft: string;
};

export type ThoughtPromptHistoryNavigation = ThoughtPromptHistoryCursor & {
  handled: boolean;
  value: string;
};

export const parseThoughtPromptHistory = (
  raw: string | null,
  limit: number,
): string[] => {
  if (!raw || !Number.isSafeInteger(limit) || limit < 1) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .slice(-limit);
  } catch {
    return [];
  }
};

export const appendThoughtPromptHistory = (
  history: readonly string[],
  prompt: string,
  limit: number,
): string[] => {
  if (!prompt || !Number.isSafeInteger(limit) || limit < 1) return [...history];
  if (history.at(-1) === prompt) return [...history];
  return [...history, prompt].slice(-limit);
};

export const navigateThoughtPromptHistory = (input: {
  history: readonly string[];
  cursor: ThoughtPromptHistoryCursor;
  currentValue: string;
  direction: "older" | "newer";
}): ThoughtPromptHistoryNavigation => {
  const { history, currentValue, direction } = input;
  if (history.length === 0) {
    return { ...input.cursor, handled: false, value: currentValue };
  }

  if (direction === "older") {
    if (input.cursor.index === null) {
      const newestIndex = history.length - 1;
      const index = history[newestIndex] === currentValue && newestIndex > 0
        ? newestIndex - 1
        : newestIndex;
      return {
        handled: true,
        index,
        draft: currentValue,
        value: history[index]!,
      };
    }
    const index = Math.max(0, input.cursor.index - 1);
    return {
      handled: true,
      index,
      draft: input.cursor.draft,
      value: history[index]!,
    };
  }

  if (input.cursor.index === null) {
    return { ...input.cursor, handled: false, value: currentValue };
  }
  if (input.cursor.index < history.length - 1) {
    const index = input.cursor.index + 1;
    return {
      handled: true,
      index,
      draft: input.cursor.draft,
      value: history[index]!,
    };
  }
  return {
    handled: true,
    index: null,
    draft: "",
    value: input.cursor.draft,
  };
};
