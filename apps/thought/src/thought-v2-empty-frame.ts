export type ThoughtV2EmptyFrameStyle = {
  canvasSize: number;
  color: string;
  inset: number;
};

const OUTER_FRAME_IMPLEMENTATION_PATTERN =
  /-(?:outer-)?frame-(?<inset>[1-9]\d*)-(?<color>[0-9a-f]{6})(?:-|$)/i;

export const parseThoughtV2EmptyFrameStyle = (
  implementationId: string,
  canvasSize = 960,
): ThoughtV2EmptyFrameStyle | null => {
  const match = OUTER_FRAME_IMPLEMENTATION_PATTERN.exec(implementationId.trim());
  const inset = Number(match?.groups?.inset);
  const color = match?.groups?.color;
  if (
    !match ||
    !Number.isSafeInteger(canvasSize) ||
    canvasSize <= 0 ||
    !Number.isSafeInteger(inset) ||
    inset <= 0 ||
    !color
  ) {
    return null;
  }

  return {
    canvasSize,
    color: `#${color.toLowerCase()}`,
    inset,
  };
};

export const thoughtV2EmptyFrameCanvasRect = (
  surfaceWidth: number,
  surfaceHeight: number,
  style: ThoughtV2EmptyFrameStyle,
) => {
  const artboardSize = style.canvasSize + (style.inset * 2);
  const insetX = (surfaceWidth * style.inset) / artboardSize;
  const insetY = (surfaceHeight * style.inset) / artboardSize;

  return {
    height: surfaceHeight - (insetY * 2),
    width: surfaceWidth - (insetX * 2),
    x: insetX,
    y: insetY,
  };
};
