import type { SurfaceCommandNode } from "surface-shell/packages/surface-shell-core/src/index.ts";

import type { ThoughtShellState } from "./thoughtShellState";
import {
  sideEffectContractRead,
  sideEffectContractWrite,
  sideEffectExternalModel,
  sideEffectLocalWrite,
  sideEffectNetwork,
  sideEffectNone,
  sideEffectRead,
  sideEffectWallet,
} from "./thoughtSideEffects";

type ThoughtCommandNode = SurfaceCommandNode<ThoughtShellState>;

const leaf = (
  path: string[],
  title: string,
  options: Partial<ThoughtCommandNode> = {},
): ThoughtCommandNode => ({
  id: path.join("."),
  path,
  title,
  sideEffect: sideEffectNone,
  ...options,
});

const branch = (
  path: string[],
  title: string,
  children: ThoughtCommandNode[],
  options: Partial<ThoughtCommandNode> = {},
): ThoughtCommandNode => ({
  id: path.join("."),
  path,
  title,
  children,
  ...options,
});

const configLocal = branch(
  ["config", "local"],
  "local model route",
  [
    leaf(["config", "local", "detect"], "detect local Ollama", {
      sideEffect: sideEffectNetwork("detect local Ollama endpoint"),
    }),
    leaf(["config", "local", "retry"], "retry local detection", {
      sideEffect: sideEffectNetwork("retry local Ollama detection"),
    }),
    leaf(["config", "local", "endpoint"], "set local endpoint", {
      sideEffect: sideEffectLocalWrite("store local model endpoint"),
    }),
    branch(
      ["config", "local", "model"],
      "local model",
      [
        leaf(["config", "local", "model", "list"], "list local models", {
          sideEffect: sideEffectNetwork("list local models"),
        }),
      ],
      {
        sideEffect: sideEffectLocalWrite("select local model"),
      },
    ),
  ],
);

const configConnect = branch(
  ["config", "connect"],
  "OpenRouter Connect route",
  [
    leaf(["config", "connect", "authorize"], "authorize OpenRouter Connect", {
      sideEffect: sideEffectNetwork("open external OpenRouter authorization"),
    }),
    leaf(["config", "connect", "openrouter"], "authorize OpenRouter Connect", {
      canonicalPath: ["config", "connect", "authorize"],
      sideEffect: sideEffectNetwork("open external OpenRouter authorization"),
    }),
    leaf(["config", "connect", "disconnect"], "disconnect OpenRouter Connect", {
      sideEffect: sideEffectLocalWrite("remove OpenRouter Connect session"),
    }),
    branch(
      ["config", "connect", "model"],
      "OpenRouter Connect model",
      [
        leaf(["config", "connect", "model", "list"], "list OpenRouter models", {
          sideEffect: sideEffectNetwork("list OpenRouter models"),
        }),
      ],
      {
        sideEffect: sideEffectLocalWrite("select OpenRouter Connect model"),
      },
    ),
  ],
  {
    aliases: ["connect"],
  },
);

const configDirect = branch(
  ["config", "direct"],
  "direct API route",
  [
    branch(
      ["config", "direct", "provider"],
      "direct provider",
      [leaf(["config", "direct", "provider", "list"], "list direct providers")],
      {
        sideEffect: sideEffectLocalWrite("select direct provider"),
      },
    ),
    branch(
      ["config", "direct", "key"],
      "direct API key",
      [leaf(["config", "direct", "key", "clear"], "clear direct API key")],
      {
        sideEffect: sideEffectLocalWrite("store direct API key locally"),
      },
    ),
    branch(
      ["config", "direct", "model"],
      "direct model",
      [
        leaf(["config", "direct", "model", "list"], "list direct models", {
          sideEffect: sideEffectNetwork("list direct provider models"),
        }),
      ],
      {
        sideEffect: sideEffectLocalWrite("select direct model"),
      },
    ),
  ],
);

export const thoughtCommandTree: ThoughtCommandNode[] = [
  leaf(["help"], "show help", {
    aliases: ["?", "--help"],
  }),
  leaf(["commands"], "list commands"),
  leaf(["current"], "show current state"),
  leaf(["status"], "show current state", {
    canonicalPath: ["current"],
  }),
  leaf(["clear"], "clear transcript", {
    sideEffect: sideEffectLocalWrite("clear CLI transcript"),
  }),
  leaf(["reset"], "reset current work", {
    sideEffect: sideEffectLocalWrite("clear current work state"),
  }),
  leaf(["gallery"], "open gallery", {
    sideEffect: sideEffectRead("navigate to gallery"),
  }),
  branch(
    ["config"],
    "configure THOUGHT",
    [
      branch(
        ["config", "route"],
        "model route",
        [
          leaf(["config", "route", "local"], "use local route"),
          leaf(["config", "route", "connect"], "use OpenRouter Connect route"),
          leaf(["config", "route", "direct"], "use direct API route"),
          leaf(["config", "route", "my-brain"], "use my-brain route", {
            aliases: ["mybrain"],
          }),
        ],
        {
          sideEffect: sideEffectLocalWrite("select model route"),
        },
      ),
      branch(
        ["config", "preview"],
        "preview policy",
        [
          leaf(["config", "preview", "auto"], "use auto preview"),
          leaf(["config", "preview", "wallet"], "use wallet preview"),
          leaf(["config", "preview", "off"], "disable preview"),
        ],
        {
          sideEffect: sideEffectLocalWrite("set preview mode"),
        },
      ),
      configLocal,
      configConnect,
      configDirect,
      leaf(["config", "my-brain"], "use my-brain route", {
        aliases: ["mybrain"],
        renderHelp: () => ({
          kind: "guidance",
          title: "my-brain route",
          body: "you become the model for one THOUGHT round.",
          sections: [
            {
              title: "use",
              lines: ["config my-brain", "prompt <text>", "run", "return <text>", "cancel"],
            },
          ],
        }),
        sideEffect: sideEffectLocalWrite("select my-brain route"),
      }),
    ],
  ),
  leaf(["mode"], "select model route", {
    canonicalPath: ["config", "route"],
    sideEffect: sideEffectLocalWrite("select model route"),
  }),
  leaf(["my-brain"], "use my-brain route", {
    aliases: ["mybrain"],
    canonicalPath: ["config", "my-brain"],
    sideEffect: sideEffectLocalWrite("select my-brain route"),
  }),
  leaf(["connect"], "authorize OpenRouter Connect", {
    canonicalPath: ["config", "connect", "authorize"],
    sideEffect: sideEffectNetwork("open external OpenRouter authorization"),
  }),
  leaf(["disconnect"], "disconnect OpenRouter Connect", {
    canonicalPath: ["config", "connect", "disconnect"],
    sideEffect: sideEffectLocalWrite("remove OpenRouter Connect session"),
  }),
  leaf(["provider"], "select direct provider", {
    canonicalPath: ["config", "direct", "provider"],
    sideEffect: sideEffectLocalWrite("select direct provider"),
  }),
  leaf(["key"], "set direct API key", {
    canonicalPath: ["config", "direct", "key"],
    sideEffect: sideEffectLocalWrite("store direct API key locally"),
  }),
  leaf(["models"], "list models", {
    canonicalPath: ["config", "direct", "model", "list"],
    sideEffect: sideEffectNetwork("list models"),
  }),
  leaf(["model"], "select model", {
    canonicalPath: ["config", "direct", "model"],
    sideEffect: sideEffectLocalWrite("select model"),
  }),
  branch(
    ["prompt"],
    "prompt",
    [leaf(["prompt", "clear"], "clear prompt")],
    {
      sideEffect: sideEffectLocalWrite("store prompt"),
    },
  ),
  branch(
    ["spec"],
    "THOUGHT spec",
    [leaf(["spec", "text"], "show THOUGHT spec text"), leaf(["spec", "show"], "show THOUGHT spec"), leaf(["spec", "cat"], "show THOUGHT spec")],
  ),
  branch(
    ["THOUGHT.md"],
    "THOUGHT.md",
    [
      leaf(["THOUGHT.md", "text"], "show THOUGHT.md text"),
      leaf(["THOUGHT.md", "show"], "show THOUGHT.md"),
      leaf(["THOUGHT.md", "cat"], "show THOUGHT.md"),
    ],
  ),
  branch(
    ["color-font"],
    "color-font",
    [
      leaf(["color-font", "raw"], "show raw color-font"),
      leaf(["color-font", "text"], "show color-font text"),
      leaf(["color-font", "show"], "show color-font"),
    ],
    {
      aliases: ["font"],
      sideEffect: sideEffectRead("open color-font source"),
    },
  ),
  leaf(["run"], "run one model round", {
    sideEffect: sideEffectExternalModel("send prompt and THOUGHT.md to selected model"),
  }),
  leaf(["rerun"], "rerun one model round", {
    canonicalPath: ["run"],
    sideEffect: sideEffectExternalModel("send prompt and THOUGHT.md to selected model"),
  }),
  branch(
    ["retry"],
    "retry",
    [
      leaf(["retry", "run"], "retry run", {
        canonicalPath: ["run"],
        sideEffect: sideEffectExternalModel("retry model run"),
      }),
    ],
  ),
  branch(
    ["preview"],
    "contract preview",
    [
      leaf(["preview", "retry"], "retry contract preview", {
        sideEffect: sideEffectContractRead("read contract preview"),
      }),
    ],
    {
      sideEffect: sideEffectContractRead("read contract preview"),
    },
  ),
  leaf(["return"], "return my-brain text"),
  leaf(["cancel"], "cancel my-brain wait"),
  branch(
    ["work"],
    "work history",
    [
      leaf(["work", "current"], "show current work"),
      leaf(["work", "list"], "list works"),
      leaf(["work", "clear"], "clear current work"),
      leaf(["work", "previous"], "previous work"),
      leaf(["work", "prev"], "previous work", { canonicalPath: ["work", "previous"] }),
      leaf(["work", "next"], "next work"),
      leaf(["work", "latest"], "latest work"),
      leaf(["work", "last"], "latest work", { canonicalPath: ["work", "latest"] }),
    ],
    {
      aliases: ["output"],
      sideEffect: sideEffectLocalWrite("read or update work history"),
    },
  ),
  branch(
    ["works"],
    "works",
    [leaf(["works", "clear"], "clear works history", { sideEffect: sideEffectLocalWrite("clear work history") })],
    {
      canonicalPath: ["work"],
    },
  ),
  branch(
    ["thought"],
    "thought works",
    [leaf(["thought", "list"], "list minted THOUGHTs", { sideEffect: sideEffectContractRead("read THOUGHT tokens") })],
    {
      sideEffect: sideEffectContractRead("read THOUGHT tokens"),
    },
  ),
  branch(
    ["wallet"],
    "wallet",
    [
      leaf(["wallet", "connect"], "connect wallet", { sideEffect: sideEffectWallet("connect wallet") }),
      leaf(["wallet", "disconnect"], "disconnect wallet", {
        sideEffect: sideEffectLocalWrite("disconnect wallet session"),
      }),
      leaf(["wallet", "switch"], "switch wallet network", {
        sideEffect: sideEffectWallet("switch wallet network"),
      }),
    ],
  ),
  leaf(["mint"], "mint THOUGHT", {
    sideEffect: sideEffectContractWrite("mint THOUGHT"),
  }),
  leaf(["mint-path"], "open $PATH mint", {
    sideEffect: sideEffectRead("navigate to $PATH mint"),
  }),
  branch(
    ["path"],
    "$PATH",
    [
      leaf(["path", "list"], "list wallet $PATHs", {
        sideEffect: sideEffectContractRead("read wallet $PATHs"),
      }),
    ],
    {
      sideEffect: sideEffectContractRead("read $PATH"),
    },
  ),
  leaf(["authorize"], "authorize $PATH", {
    sideEffect: sideEffectWallet("sign $PATH authorization"),
  }),
  leaf(["confirm"], "confirm THOUGHT mint", {
    sideEffect: sideEffectContractWrite("mint THOUGHT"),
  }),
  branch(
    ["provenance"],
    "provenance",
    [leaf(["provenance", "--json"], "open provenance JSON")],
    {
      sideEffect: sideEffectRead("read current provenance"),
    },
  ),
  branch(
    ["view"],
    "view",
    [
      leaf(["view", "tx"], "open transaction", {
        sideEffect: sideEffectRead("open transaction explorer"),
      }),
      leaf(["view", "THOUGHT"], "open THOUGHT detail", {
        sideEffect: sideEffectRead("open THOUGHT detail"),
      }),
    ],
  ),
  leaf(["verify"], "verify contracts", {
    sideEffect: sideEffectRead("open verification page"),
  }),
];

export const thoughtBranchHelpCommands = [
  "config",
  "config direct",
  "config local",
  "config connect",
  "config my-brain",
];
