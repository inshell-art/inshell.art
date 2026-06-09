import {
  getCommandCompletions,
  type SurfaceCompletion,
} from "surface-shell/packages/surface-shell-core/src/index.ts";

import { thoughtCommandTree } from "./thoughtCommandTree";

export const getThoughtShellCompletions = (input: string): SurfaceCompletion[] =>
  getCommandCompletions(input, {
    includeAliases: true,
    config: {
      mode: "command-first",
      commandPrefix: null,
      root: thoughtCommandTree,
      caseInsensitiveCommands: true,
    },
  });
