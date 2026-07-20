export type ThoughtV2TextPair = {
  promptLine: string;
  agentLine: string;
};

type ThoughtV2TextFixtureDefinition = ThoughtV2TextPair & {
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
  promptLine: "Quiet signal 你好",
  agentLine: "quiet Agent مرحبا",
};

export const thoughtV2TextCorpuses: ThoughtV2TextCorpus[] = [
  {
    id: "mixed-baseline",
    name: "mixed baseline",
    fixtures: [
      {
        id: "mixed-script-default",
        name: "work 01 mixed signal",
        promptLine: "Quiet signal 你好",
        agentLine: "quiet signal مرحبا",
      },
      {
        id: "ascii-minimal",
        name: "work 02 small ritual",
        promptLine: "small ritual",
        agentLine: "small ritual",
      },
      {
        id: "cjk",
        name: "work 03 cjk",
        promptLine: "安静的信号",
        agentLine: "静かな合図",
      },
      {
        id: "arabic-hebrew",
        name: "work 04 rtl",
        promptLine: "صوت هادئ",
        agentLine: "אות שקט",
      },
      {
        id: "indic-thai",
        name: "work 05 indic thai",
        promptLine: "धीमा संकेत",
        agentLine: "สัญญาณสงบ",
      },
      {
        id: "punctuation",
        name: "work 06 punctuation",
        promptLine: "signal: quiet, then clear",
        agentLine: "quiet, then clear",
      },
    ],
  },
  {
    id: "long-agent",
    name: "long agent lines",
    fixtures: [
      {
        id: "agent-carousel-basic",
        name: "work 07 long agent basic",
        promptLine: "long agent check",
        agentLine: "a long Agent line should carousel across the canvas without squeezing",
      },
      {
        id: "agent-end-start",
        name: "work 08 end start gap",
        promptLine: "gap check",
        agentLine: "the start is here and where is the end, here is the end?",
      },
      {
        id: "agent-observation",
        name: "work 09 observation line",
        promptLine: "watch the answer",
        agentLine: "observe the Agent response crossing the field without shrinking the type",
      },
      {
        id: "agent-memory-route",
        name: "work 10 memory route",
        promptLine: "memory route",
        agentLine: "Agent memory passes through 北京 東京 서울 without losing rhythm",
      },
      {
        id: "agent-quiet-window",
        name: "work 11 quiet window",
        promptLine: "quiet window",
        agentLine: "Agent channel carries مرحبا across a long quiet window",
      },
      {
        id: "agent-edge-repeat",
        name: "work 12 repeated edge",
        promptLine: "edge repeat",
        agentLine: "edge spacing should keep the end away from the start on every loop",
      },
    ],
  },
  {
    id: "long-prompt",
    name: "long prompt lines",
    fixtures: [
      {
        id: "prompt-carousel-basic",
        name: "work 13 long prompt basic",
        promptLine:
          "trace the quiet signal across the archive before it becomes another visible proof of attention carried through the window and back",
        agentLine: "quiet archive",
      },
      {
        id: "prompt-full-request",
        name: "work 14 full request",
        promptLine:
          "when the prompt keeps moving the canvas should reveal the full sentence without squeezing the letters into a narrow static line",
        agentLine: "full request",
      },
      {
        id: "prompt-first-last",
        name: "work 15 first last",
        promptLine:
          "follow the small request from the first mark to the last answer and keep every word visible while the field stays still",
        agentLine: "first to last",
      },
      {
        id: "prompt-mixed-language",
        name: "work 16 mixed language prompt",
        promptLine:
          "quiet prompt 你好 moves with مرحبا and keeps the same measured path across the lower edge",
        agentLine: "mixed prompt",
      },
      {
        id: "prompt-proof-window",
        name: "work 17 proof window",
        promptLine:
          "a proof window should carry the original request long enough for anyone to read the complete signal",
        agentLine: "proof window",
      },
      {
        id: "prompt-no-compression",
        name: "work 18 no compression",
        promptLine:
          "do not compress this prompt into a tiny line because the animation should preserve the written rhythm",
        agentLine: "no compression",
      },
    ],
  },
  {
    id: "dual-carousel",
    name: "dual carousel stress",
    fixtures: [
      {
        id: "dual-clean-spacing",
        name: "work 19 dual clean spacing",
        promptLine:
          "the prompt also travels so both text fields need independent clean spacing between repeated copies",
        agentLine: "the Agent answer is long and the prompt is also long so both lines should carousel cleanly",
      },
      {
        id: "dual-multilingual",
        name: "work 20 dual multilingual",
        promptLine:
          "multilingual prompt 你好 مرحبا नमस्ते should stay readable while the agent answer moves above",
        agentLine: "multilingual Agent line crosses العربية 中文 Hindi without a static fallback",
      },
      {
        id: "dual-marketplace",
        name: "work 21 marketplace preview",
        promptLine:
          "marketplace previews should still expose the whole visible prompt when the text is longer than the canvas",
        agentLine: "marketplace thumbnails need enough time and space to show a complete Agent line",
      },
      {
        id: "dual-saved-svg",
        name: "work 22 saved svg",
        promptLine:
          "saving this work as svg should preserve the prompt animation and the exact injected text payload",
        agentLine: "saved SVG artifact preserves the Agent line animation and text payload",
      },
      {
        id: "dual-bottom-top",
        name: "work 23 bottom top",
        promptLine:
          "bottom prompt motion and central agent motion should remain visually separate throughout the loop",
        agentLine: "center band motion should not collide with the lower prompt line during repeat",
      },
      {
        id: "dual-human-check",
        name: "work 24 human check",
        promptLine:
          "a human should be able to watch the loop once and understand where each line begins and ends",
        agentLine: "a human check should see the beginning and end of the Agent line without overlap",
      },
    ],
  },
  {
    id: "global-scripts",
    name: "global scripts",
    fixtures: [
      {
        id: "script-greek",
        name: "work 25 greek",
        promptLine: "ήσυχο σήμα",
        agentLine: "ήρεμη απάντηση",
      },
      {
        id: "script-cyrillic",
        name: "work 26 cyrillic",
        promptLine: "тихий сигнал",
        agentLine: "спокойный ответ",
      },
      {
        id: "script-korean",
        name: "work 27 korean",
        promptLine: "조용한 신호",
        agentLine: "고요한 응답",
      },
      {
        id: "script-armenian",
        name: "work 28 armenian",
        promptLine: "լուռ ազդանշան",
        agentLine: "հանգիստ պատասխան",
      },
      {
        id: "script-georgian",
        name: "work 29 georgian",
        promptLine: "მშვიდი სიგნალი",
        agentLine: "წყნარი პასუხი",
      },
      {
        id: "script-ethiopic",
        name: "work 30 ethiopic",
        promptLine: "ጸጥ ያለ ምልክት",
        agentLine: "የተረጋጋ መልስ",
      },
      {
        id: "script-khmer",
        name: "work 31 khmer",
        promptLine: "សញ្ញាស្ងប់",
        agentLine: "ចម្លើយស្ងប់",
      },
      {
        id: "script-lao",
        name: "work 32 lao",
        promptLine: "ສັນຍານງຽບ",
        agentLine: "ຄໍາຕອບສະຫງົບ",
      },
      {
        id: "script-tibetan",
        name: "work 33 tibetan",
        promptLine: "ཞི་བའི་བརྡ",
        agentLine: "ཞི་བའི་ལན",
      },
      {
        id: "script-tamil",
        name: "work 34 tamil",
        promptLine: "அமைதியான குறி",
        agentLine: "அமைதியான பதில்",
      },
      {
        id: "script-bengali",
        name: "work 35 bengali",
        promptLine: "নীরব সংকেত",
        agentLine: "শান্ত উত্তর",
      },
      {
        id: "script-vietnamese",
        name: "work 36 vietnamese",
        promptLine: "tín hiệu yên lặng",
        agentLine: "phản hồi êm",
      },
      {
        id: "script-myanmar",
        name: "work 37 myanmar",
        promptLine: "တိတ်ဆိတ်သော အချက်ပြ",
        agentLine: "ငြိမ်သက်သော အဖြေ",
      },
      {
        id: "script-sinhala",
        name: "work 38 sinhala",
        promptLine: "නිහඬ සංඥාව",
        agentLine: "සන්සුන් පිළිතුර",
      },
      {
        id: "script-cherokee",
        name: "work 39 cherokee",
        promptLine: "ᎤᏅᏥᏓ ᎤᏃᏴᎬ",
        agentLine: "ᎤᏓᏅᏘ ᎤᏁᏨ",
      },
      {
        id: "script-inuktitut",
        name: "work 40 inuktitut",
        promptLine: "ᓂᐱᖃᙱᑦᑐᖅ ᓇᓗᓇᐃᒃᑯᑕᖅ",
        agentLine: "ᓇᑲᑦᑐᖅ ᑭᐅᔾᔪᑎ",
      },
      {
        id: "script-turkish",
        name: "work 41 turkish",
        promptLine: "sessiz işaret",
        agentLine: "sakin yanıt",
      },
      {
        id: "script-polish",
        name: "work 42 polish",
        promptLine: "cichy sygnał",
        agentLine: "spokojna odpowiedź",
      },
    ],
  },
  {
    id: "minimal",
    name: "minimal works",
    fixtures: [
      {
        id: "minimal-ab",
        name: "work 43 minimal ab",
        promptLine: "a",
        agentLine: "b",
      },
    ],
  },
  {
    id: "binary-density-ramp",
    name: "binary density ramp",
    fixtures: [
      {
        id: "density-004-bytes",
        name: "work 44 density 004 bytes",
        promptLine: "aa",
        agentLine: "bb",
      },
      {
        id: "density-008-bytes",
        name: "work 45 density 008 bytes",
        promptLine: "aaaa",
        agentLine: "bbbb",
      },
      {
        id: "density-016-bytes",
        name: "work 46 density 016 bytes",
        promptLine: "aaaaaaaa",
        agentLine: "bbbbbbbb",
      },
      {
        id: "density-032-bytes",
        name: "work 47 density 032 bytes",
        promptLine: "aaaaaaaaaaaaaaaa",
        agentLine: "bbbbbbbbbbbbbbbb",
      },
      {
        id: "density-064-bytes",
        name: "work 48 density 064 bytes",
        promptLine: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        agentLine: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        id: "density-128-bytes",
        name: "work 49 density 128 bytes",
        promptLine: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        agentLine: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        id: "density-256-bytes",
        name: "work 50 density 256 bytes",
        promptLine:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        agentLine:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
    ],
  },
];

export const thoughtV2TextFixtures: ThoughtV2TextFixture[] = thoughtV2TextCorpuses.flatMap((corpus) =>
  corpus.fixtures.map((fixture) => ({
    ...fixture,
    corpusId: corpus.id,
    corpusName: corpus.name,
  })),
);
