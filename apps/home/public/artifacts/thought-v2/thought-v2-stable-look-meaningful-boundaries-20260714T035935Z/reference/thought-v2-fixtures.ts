export type ThoughtV2TextPair = {
  promptLine: string;
  agentLine: string;
};

export type ThoughtV2TextFixtureDefinition = ThoughtV2TextPair & {
  id: string;
  name: string;
};

export type ThoughtV2TextCorpus = {
  id: string;
  name: string;
  fixtures: ThoughtV2TextFixtureDefinition[];
};

export type ThoughtV2TextFixture = ThoughtV2TextFixtureDefinition & {
  corpusId: string;
  corpusName: string;
};

export const thoughtV2DefaultText: ThoughtV2TextPair = {
  "promptLine": "Quiet signal 你好",
  "agentLine": "quiet Agent مرحبا"
};

export const thoughtV2TextCorpuses: ThoughtV2TextCorpus[] = [
  {
    "id": "mixed-baseline",
    "name": "mixed baseline",
    "fixtures": [
      {
        "id": "mixed-script-default",
        "name": "work 01 mixed signal",
        "promptLine": "Quiet signal 你好",
        "agentLine": "quiet signal مرحبا"
      },
      {
        "id": "ascii-minimal",
        "name": "work 02 small ritual",
        "promptLine": "small ritual",
        "agentLine": "small ritual"
      },
      {
        "id": "cjk",
        "name": "work 03 cjk",
        "promptLine": "安静的信号",
        "agentLine": "静かな合図"
      },
      {
        "id": "arabic-hebrew",
        "name": "work 04 rtl",
        "promptLine": "صوت هادئ",
        "agentLine": "אות שקט"
      },
      {
        "id": "indic-thai",
        "name": "work 05 indic thai",
        "promptLine": "धीमा संकेत",
        "agentLine": "สัญญาณสงบ"
      },
      {
        "id": "punctuation",
        "name": "work 06 punctuation",
        "promptLine": "signal: quiet, then clear",
        "agentLine": "quiet, then clear"
      }
    ]
  },
  {
    "id": "wide-agent-lines",
    "name": "wide agent lines",
    "fixtures": [
      {
        "id": "agent-width-basic",
        "name": "work 07 wide agent basic",
        "promptLine": "long agent check",
        "agentLine": "the clear answer travels"
      },
      {
        "id": "agent-end-start",
        "name": "work 08 end start gap",
        "promptLine": "gap check",
        "agentLine": "start and end stay apart"
      },
      {
        "id": "agent-observation",
        "name": "work 09 observation line",
        "promptLine": "watch the answer",
        "agentLine": "observe the field"
      },
      {
        "id": "agent-memory-route",
        "name": "work 10 memory route",
        "promptLine": "memory route",
        "agentLine": "memory crosses 北京"
      },
      {
        "id": "agent-quiet-window",
        "name": "work 11 quiet window",
        "promptLine": "quiet window",
        "agentLine": "quiet carries مرحبا"
      },
      {
        "id": "agent-edge-repeat",
        "name": "work 12 repeated edge",
        "promptLine": "edge repeat",
        "agentLine": "edge keeps its distance"
      }
    ]
  },
  {
    "id": "wide-prompt-lines",
    "name": "wide prompt lines",
    "fixtures": [
      {
        "id": "prompt-width-basic",
        "name": "work 13 wide prompt basic",
        "promptLine": "trace the signal across the archive before it becomes visible",
        "agentLine": "quiet archive"
      },
      {
        "id": "prompt-full-request",
        "name": "work 14 full request",
        "promptLine": "the prompt crosses the canvas without losing its written rhythm",
        "agentLine": "full request"
      },
      {
        "id": "prompt-first-last",
        "name": "work 15 first last",
        "promptLine": "follow the small request from first mark to final answer",
        "agentLine": "first to last"
      },
      {
        "id": "prompt-mixed-language",
        "name": "work 16 mixed language prompt",
        "promptLine": "quiet prompt 你好 meets مرحبا across the field",
        "agentLine": "mixed prompt"
      },
      {
        "id": "prompt-proof-window",
        "name": "work 17 proof window",
        "promptLine": "a proof window carries the request long enough to read",
        "agentLine": "proof window"
      },
      {
        "id": "prompt-no-compression",
        "name": "work 18 no compression",
        "promptLine": "keep this prompt readable across the static field",
        "agentLine": "no compression"
      }
    ]
  },
  {
    "id": "dual-width-stress",
    "name": "dual width stress",
    "fixtures": [
      {
        "id": "dual-clean-spacing",
        "name": "work 19 dual clean spacing",
        "promptLine": "both lines keep their own measured space inside the field",
        "agentLine": "one Agent line remains"
      },
      {
        "id": "dual-multilingual",
        "name": "work 20 dual multilingual",
        "promptLine": "multilingual prompt 你好 مرحبا stays readable",
        "agentLine": "the Agent returns 中文"
      },
      {
        "id": "dual-marketplace",
        "name": "work 21 marketplace preview",
        "promptLine": "marketplace previews expose the visible prompt clearly",
        "agentLine": "thumbnails show answer"
      },
      {
        "id": "dual-saved-svg",
        "name": "work 22 saved svg",
        "promptLine": "saved SVG preserves the exact visible prompt",
        "agentLine": "saved SVG keeps response"
      },
      {
        "id": "dual-bottom-top",
        "name": "work 23 bottom top",
        "promptLine": "bottom prompt and central answer stay separate",
        "agentLine": "center stays separate"
      },
      {
        "id": "dual-human-check",
        "name": "work 24 human check",
        "promptLine": "a human reads both lines from start to finish",
        "agentLine": "the answer remains clear"
      }
    ]
  },
  {
    "id": "global-scripts",
    "name": "global scripts",
    "fixtures": [
      {
        "id": "script-greek",
        "name": "work 25 greek",
        "promptLine": "ήσυχο σήμα",
        "agentLine": "ήρεμη απάντηση"
      },
      {
        "id": "script-cyrillic",
        "name": "work 26 cyrillic",
        "promptLine": "тихий сигнал",
        "agentLine": "спокойный ответ"
      },
      {
        "id": "script-korean",
        "name": "work 27 korean",
        "promptLine": "조용한 신호",
        "agentLine": "고요한 응답"
      },
      {
        "id": "script-armenian",
        "name": "work 28 armenian",
        "promptLine": "լուռ ազդանշան",
        "agentLine": "հանգիստ պատասխան"
      },
      {
        "id": "script-georgian",
        "name": "work 29 georgian",
        "promptLine": "მშვიდი სიგნალი",
        "agentLine": "წყნარი პასუხი"
      },
      {
        "id": "script-ethiopic",
        "name": "work 30 ethiopic",
        "promptLine": "ጸጥ ያለ ምልክት",
        "agentLine": "የተረጋጋ መልስ"
      },
      {
        "id": "script-khmer",
        "name": "work 31 khmer",
        "promptLine": "សញ្ញាស្ងប់",
        "agentLine": "ចម្លើយស្ងប់"
      },
      {
        "id": "script-lao",
        "name": "work 32 lao",
        "promptLine": "ສັນຍານງຽບ",
        "agentLine": "ຄໍາຕອບສະຫງົບ"
      },
      {
        "id": "script-tibetan",
        "name": "work 33 tibetan",
        "promptLine": "ཞི་བའི་བརྡ",
        "agentLine": "ཞི་བའི་ལན"
      },
      {
        "id": "script-tamil",
        "name": "work 34 tamil",
        "promptLine": "அமைதியான குறி",
        "agentLine": "அமைதியான பதில்"
      },
      {
        "id": "script-bengali",
        "name": "work 35 bengali",
        "promptLine": "নীরব সংকেত",
        "agentLine": "শান্ত উত্তর"
      },
      {
        "id": "script-vietnamese",
        "name": "work 36 vietnamese",
        "promptLine": "tín hiệu yên lặng",
        "agentLine": "phản hồi êm"
      },
      {
        "id": "script-myanmar",
        "name": "work 37 myanmar",
        "promptLine": "တိတ်ဆိတ်သော အချက်ပြ",
        "agentLine": "ငြိမ်သက်သော အဖြေ"
      },
      {
        "id": "script-sinhala",
        "name": "work 38 sinhala",
        "promptLine": "නිහඬ සංඥාව",
        "agentLine": "සන්සුන් පිළිතුර"
      },
      {
        "id": "script-cherokee",
        "name": "work 39 cherokee",
        "promptLine": "ᎤᏅᏥᏓ ᎤᏃᏴᎬ",
        "agentLine": "ᎤᏓᏅᏘ ᎤᏁᏨ"
      },
      {
        "id": "script-inuktitut",
        "name": "work 40 inuktitut",
        "promptLine": "ᓂᐱᖃᙱᑦᑐᖅ ᓇᓗᓇᐃᒃᑯᑕᖅ",
        "agentLine": "ᓇᑲᑦᑐᖅ ᑭᐅᔾᔪᑎ"
      },
      {
        "id": "script-turkish",
        "name": "work 41 turkish",
        "promptLine": "sessiz işaret",
        "agentLine": "sakin yanıt"
      },
      {
        "id": "script-polish",
        "name": "work 42 polish",
        "promptLine": "cichy sygnał",
        "agentLine": "spokojna odpowiedź"
      }
    ]
  },
  {
    "id": "minimal",
    "name": "minimal works",
    "fixtures": [
      {
        "id": "minimal-ab",
        "name": "work 43 minimal ab",
        "promptLine": "a",
        "agentLine": "b"
      }
    ]
  },
  {
    "id": "visible-line-limits",
    "name": "visible line limits",
    "fixtures": [
      {
        "id": "ascii-display-unit-limits",
        "name": "work 44 ascii display limits",
        "promptLine": "pppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppp",
        "agentLine": "AAAAAAAAAAAAAAAAAAAAAAAAAAA"
      },
      {
        "id": "wide-display-unit-limits",
        "name": "work 45 wide display limits",
        "promptLine": "你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你",
        "agentLine": "好好好好好好好好好好好好好好好好"
      },
      {
        "id": "mixed-display-unit-limit",
        "name": "work 46 mixed display limit",
        "promptLine": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 你你你你你你你你你你你你你你你你你你你你你",
        "agentLine": "AAAAAAAAAAAAAAAAAAA 好好好好"
      }
    ]
  },
  {
    "id": "binary-density-ramp",
    "name": "binary density ramp",
    "fixtures": [
      {
        "id": "density-004-bytes",
        "name": "work 47 density 004 bytes",
        "promptLine": "aa",
        "agentLine": "bb"
      },
      {
        "id": "density-008-bytes",
        "name": "work 48 density 008 bytes",
        "promptLine": "aaaa",
        "agentLine": "bbbb"
      },
      {
        "id": "density-016-bytes",
        "name": "work 49 density 016 bytes",
        "promptLine": "aaaaaaaa",
        "agentLine": "bbbbbbbb"
      },
      {
        "id": "density-032-bytes",
        "name": "work 50 density 032 bytes",
        "promptLine": "aaaaaaaaaaaaaaaa",
        "agentLine": "bbbbbbbbbbbbbbbb"
      },
      {
        "id": "density-064-bytes",
        "name": "work 51 density 064 bytes",
        "promptLine": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "agentLine": "bbbbbbbbbbbbbbbbbbbbbbbbbbb"
      },
      {
        "id": "density-096-bytes",
        "name": "work 52 density 096 bytes",
        "promptLine": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "agentLine": "bbbbbbbbbbbbbbbbbbbbbbbb"
      },
      {
        "id": "density-174-cjk-bytes",
        "name": "work 53 density 174 cjk bytes",
        "promptLine": "你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你你",
        "agentLine": "好好好好好好好好好好好好好好好"
      }
    ]
  },
  {
    "id": "emoji",
    "name": "emoji works",
    "fixtures": [
      {
        "id": "emoji-signal",
        "name": "work 54 emoji signal",
        "promptLine": "launch the signal 🚀",
        "agentLine": "signal received 🌙"
      },
      {
        "id": "emoji-only",
        "name": "work 55 emoji only",
        "promptLine": "😀 🚀 🌙",
        "agentLine": "🔥 💡 🎯"
      },
      {
        "id": "emoji-global-scripts",
        "name": "work 56 emoji global scripts",
        "promptLine": "你好 🌙 مرحبا",
        "agentLine": "静かな信号 🚀"
      },
      {
        "id": "emoji-sequence",
        "name": "work 57 emoji sequence",
        "promptLine": "🌙 🔥 💡 🎯 🚀",
        "agentLine": "🚀 🎯 💡 🔥 🌙"
      }
    ]
  },
  {
    "id": "exact-64-byte-limits",
    "name": "exact 64 byte limits",
    "fixtures": [
      {
        "id": "max-two-byte-unicode",
        "name": "work 58 max two byte unicode",
        "promptLine": "кудаведётэтоттихийцифровойсигнал",
        "agentLine": "ответрождаетсяизпамятииконтекста"
      },
      {
        "id": "max-three-byte-unicode",
        "name": "work 59 max three byte unicode",
        "promptLine": "这个问题穿过记忆寻找清晰温柔可靠的最终答案?",
        "agentLine": "答案来自上下文并保持事实边界与语气始终清楚."
      },
      {
        "id": "max-four-byte-emoji",
        "name": "work 60 max four byte emoji",
        "promptLine": "🌅🧭🚶🌲🌊🐚🐦🌙🔭🛰💭🧠💡🛠🚀🎯",
        "agentLine": "🔍📚💭🧠🤖🛠🔥💡🧭🌍🔗🔑🚪🌱🌳🎯"
      }
    ]
  }
];

export const thoughtV2TextFixtures: ThoughtV2TextFixture[] = thoughtV2TextCorpuses.flatMap((corpus) =>
  corpus.fixtures.map((fixture) => ({
    ...fixture,
    corpusId: corpus.id,
    corpusName: corpus.name,
  })),
);
