import { renderText, type SurfaceReturn } from "surface-shell/packages/surface-shell-core/src/index.ts";

export const surfaceReturnToCliLines = (result: SurfaceReturn) => renderText(result).split("\n");

export const thoughtUnknownCommandLines = () => ["unknown command.", "use: help"];

export const thoughtMyBrainWaitingLines = () => [
  "my-brain is waiting for return.",
  "use: return <text>",
  "use: cancel",
];
