export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { generateOutline } from "@/app/talaba-tools/ppt/actions";
import { sendFileToTelegram } from "@/app/api/telegram/route";
import { canUsePPT, incrementPPT } from "@/lib/limit-checker";
import fs from "fs";
import path from "path";
import axios from "axios";

// PEXELS IMAGE
async function getPexelsImage(
  query: string
) {
  try {
    const response =
      await axios.get(
        "https://api.pexels.com/v1/search",
        {
          params: {
            query,
            per_page: 1,
            orientation:
              "landscape",
          },
          headers: {
            Authorization:
              process.env
                .PEXELS_API_KEY!,
          },
        }
      );

    return (
      response.data
        ?.photos?.[0]
        ?.src
        ?.large2x || null
    );
  } catch (
    error
  ) {
    console.log(
      "Pexels error:",
      error
    );

    return null;
  }
}

// THEMES
const themes = [
  {
    bg: "071120",
    text: "FFFFFF",
    sub: "CBD5E1",
    accent: "00D9FF",
  },
  {
    bg: "1E1B4B",
    text: "FFFFFF",
    sub: "DDD6FE",
    accent: "A855F7",
  },
  {
    bg: "172554",
    text: "FFFFFF",
    sub: "DBEAFE",
    accent: "3B82F6",
  },
  {
    bg: "111827",
    text: "FFFFFF",
    sub: "E5E7EB",
    accent: "F59E0B",
  },
  {
    bg: "0F172A",
    text: "FFFFFF",
    sub: "CBD5E1",
    accent: "22C55E",
  },
];

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const telegramUserId =
      body.telegram_user_id;

    const sendToTelegram =
      body.send_to_telegram;

    const telegramId = Number(telegramUserId);
    if (telegramId && !isNaN(telegramId)) {
      const limitCheck = await canUsePPT(telegramId);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: "LIMIT_REACHED",
            message: "Sizning kunlik PPT limiti tugagan.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const result =
  await generateOutline({
    topic:
      body.topic,
    slides:
      body.slides,
    language:
      body.language,
    style:
      body.style,
  });

if (!result.success) {
  return NextResponse.json(
    {
      success: false,
      error: "AI failed",
    },
    { status: 500 }
  );
}

const outline =
  result.outline;
    const pptx =
      new PptxGenJS();
      // SINGLE THEME FOR WHOLE PRESENTATION
const presentationTheme =
  themes[
    Math.floor(
      Math.random() *
        themes.length
    )
  ];

// PRELOAD ALL IMAGES IN PARALLEL
const imageUrls =
  await Promise.all(
    outline.map(
      async (
        item: any
      ) => {
        const isIslamicTopic =
          body.topic
            ?.toLowerCase()
            ?.includes(
              "islom"
            ) ||
          body.topic
            ?.toLowerCase()
            ?.includes(
              "islam"
            ) ||
          body.topic
            ?.toLowerCase()
            ?.includes(
              "muhammad"
            ) ||
          body.topic
            ?.toLowerCase()
            ?.includes(
              "payg'ambar"
            ) ||
          body.topic
            ?.toLowerCase()
            ?.includes(
              "xalifalik"
            );

        const imageQuery =
          isIslamicTopic
            ? `
${item.imageQuery || body.topic},
ultra realistic cinematic islamic architecture,
golden lighting,
premium presentation background,
4k,
respectful islamic art,
NO prophet face,
NO visible face,
spiritual lighting,
historical islamic atmosphere
`
            : `
${item.imageQuery || body.topic},
ultra realistic cinematic,
premium presentation background,
dramatic lighting,
4k,
professional presentation style
`;

        return await getPexelsImage(
          imageQuery
        );
      }
    )
  );

    pptx.layout =
      "LAYOUT_WIDE";

    pptx.author =
      "Talaba AI";

    pptx.company =
      "Talaba AI";

    pptx.subject =
      body.topic;

    pptx.title =
      body.topic;
          for (
  const [
    index,
    item,
  ] of outline.entries()
) {
      const slide =
        pptx.addSlide();

     const theme =
  presentationTheme;
        const slideContent =
  item.contentBlocks
    ?.map(
      (block: any) => {
  // oddiy text
  if (
    typeof block.content ===
    "string"
  ) {
    return block.content
      .trim();
  }

  // bullet array
  if (
    Array.isArray(
      block.content
    ) &&
    block.content.length
  ) {
    const bullets =
      block.content
        .map(
          (
            value: any
          ) => {
            if (
              typeof value ===
              "string"
            ) {
              return value.trim();
            }

            return (
              value
                ?.content ||
              value?.text ||
              ""
            ).trim();
          }
        )
        .filter(
          Boolean
        );

    if (
      bullets.length
    ) {
      return (
        "• " +
        bullets.join(
          "\n• "
        )
      );
    }

    return "";
  }

  // object bo‘lsa
  if (
    typeof block.content ===
    "object"
  ) {
    return (
      block.content
        ?.content ||
      block.content
        ?.text ||
      ""
    ).trim();
  }

  return "";
}    
    )
    ?.join("\n\n")
    ?.trim() ||

  item.content
    ?.trim() ||

  item.subtitle
    ?.trim() ||

  item.bullets
    ?.map(
      (
        bullet: string
      ) =>
        `• ${bullet}`
    )
    .join("\n") ||

  `🌍 ${body.topic}

📌 Muhim tushunchalar

📊 Asosiy faktlar

🚀 Xulosa va qarashlar`;

      const isIslamicTopic =
  body.topic
    ?.toLowerCase()
    ?.includes(
      "islom"
    ) ||
  body.topic
    ?.toLowerCase()
    ?.includes(
      "islam"
    ) ||
  body.topic
    ?.toLowerCase()
    ?.includes(
      "muhammad"
    ) ||
  body.topic
    ?.toLowerCase()
    ?.includes(
      "payg'ambar"
    ) ||
  body.topic
    ?.toLowerCase()
    ?.includes(
      "xalifalik"
    );

const imageQuery =
  isIslamicTopic
    ? `
${item.imageQuery || body.topic},
ultra realistic cinematic islamic architecture,
golden lighting,
premium presentation background,
4k,
respectful islamic art,
NO prophet face,
NO visible face,
spiritual lighting,
historical islamic atmosphere
`
    : `
${item.imageQuery || body.topic},
ultra realistic cinematic,
premium presentation background,
dramatic lighting,
4k,
professional presentation style
`;

const imageUrl =
  imageUrls[
    index
  ];
      if (
  imageUrl
) {
  slide.addImage({
    path:
      imageUrl,
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
  });

  slide.addShape(
    pptx.ShapeType
      .rect,
    {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: {
        color:
          "000000",
        transparency:
          65
      },
      line: {
        color:
          "000000",
        transparency:
          100,
      },
    }
  );
} else {
  slide.background =
    {
      color:
        theme.bg,
    };
}

      // TOP ACCENT
slide.addShape(
  pptx.ShapeType.rect,
  {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.08,
    fill: {
      color:
        theme.accent,
    },
    line: {
      color:
        theme.accent,
    },
  }
);

// HERO COVER
if (
  item.layoutType ===
  "hero-cover"
) {
  slide.addText(
    item.title ||
      "",
    {
      x: 0.9,
      y: 2.2,
      w: 8,
      h: 1.2,
      fontFace:
        "Aptos",
      fontSize: 28,
      bold: true,
      color:
        "FFFFFF",
      fit:
        "shrink",
    }
  );

  slide.addText(
    slideContent,
    {
      x: 0.9,
      y: 3.5,
      w: 6.5,
      h: 1.5,
      fontFace:
        "Aptos",
      fontSize: 16,
      color:
        "E2E8F0",
      fit:
        "shrink",
    }
  );
}

    // IMAGE LEFT
else if (
  item.layoutType ===
  "image-left"
) {
  if (
    imageUrl
  ) {
    slide.addImage({
      path:
        imageUrl,
      x: 0.8,
      y: 1,
      w: 4.8,
      h: 4.8,
    });
  }

  // DARK GLASS CARD
  slide.addShape(
    pptx.ShapeType
      .roundRect,
    {
      x: 5.8,
      y: 0.65,
      w: 5.8,
      h: 4.8,
      rectRadius:
        0.12,
      fill: {
        color:
          "000000",
        transparency:
          45,
      },
      line: {
        color:
          "FFFFFF",
        transparency:
          100,
      },
    }
  );

  // TITLE
  slide.addText(
    item.title ||
      "",
    {
      x: 6.2,
      y: 0.9,
      w: 5.5,
      h: 1,
      fontFace:
        "Aptos",
      fontSize: 24,
      bold: true,
      color:
        theme.text,
      fit:
        "shrink",
    }
  );

  // CONTENT
  slide.addText(
    slideContent,
    {
      x: 6.2,
      y: 2,
      w: 5.4,
      h: 3.5,
      fontFace:
        "Aptos",
      fontSize: 15,
      color:
        theme.sub,
      fit:
        "shrink",
    }
  );

  // SMART EMOJI
  const topic =
    body.topic?.toLowerCase() ||
    "";

  let icons = [
    "🚀",
    "📈",
    "💡",
    "🌍",
  ];

  if (
    topic.includes(
      "islom"
    ) ||
    topic.includes(
      "islam"
    ) ||
    topic.includes(
      "payg'ambar"
    ) ||
    topic.includes(
      "muslim"
    )
  ) {
    icons = [
      "🕌",
      "📖",
      "🤝",
      "⚖️",
    ];
  }

  else if (
    topic.includes(
      "cyber"
    ) ||
    topic.includes(
      "security"
    ) ||
    topic.includes(
      "xavfsizlik"
    )
  ) {
    icons = [
      "🛡️",
      "🔐",
      "💻",
      "🚀",
    ];
  }

  else if (
    topic.includes(
      "history"
    ) ||
    topic.includes(
      "tarix"
    )
  ) {
    icons = [
      "🏛️",
      "📜",
      "⚔️",
      "🌍",
    ];
  }

  else if (
    topic.includes(
      "science"
    ) ||
    topic.includes(
      "kimyo"
    ) ||
    topic.includes(
      "fizika"
    ) ||
    topic.includes(
      "biology"
    )
  ) {
    icons = [
      "🧪",
      "⚛️",
      "🔬",
      "⚡",
    ];
  }

  else if (
    topic.includes(
      "business"
    ) ||
    topic.includes(
      "marketing"
    ) ||
    topic.includes(
      "biznes"
    )
  ) {
    icons = [
      "📈",
      "💰",
      "🌍",
      "🚀",
    ];
  }

  else if (
    topic.includes(
      "ai"
    ) ||
    topic.includes(
      "suniy"
    ) ||
    topic.includes(
      "artificial"
    )
  ) {
    icons = [
      "🤖",
      "🚀",
      "💡",
      "⚡",
    ];
  }

  // EMOJI
  slide.addText(
    icons[
      Math.floor(
        Math.random() *
          icons.length
      )
    ],
    {
      x: 11.2,
      y: 0.75,
      w: 0.5,
      h: 0.5,
      fontSize: 22,
      fontFace:
        "Segoe UI Emoji",
    }
  );
}

     // CONTENT
else if (
  item.layoutType ===
"premium-content"||

  item.layoutType ===
    "split-insight" ||

  item.layoutType ===
    "feature-grid" ||

  item.layoutType ===
    "vertical-timeline" ||

  item.layoutType ===
    "statistics-highlight"
) {
        slide.addText(
          item.title ||
            "",
          {
            x: 0.8,
            y: 0.7,
            w: 11.5,
            h: 0.8,
            fontFace:
              "Aptos",
            fontSize: 24,
            bold: true,
            color:
              theme.text,
            align:
              "center",
          }
        );

        slide.addShape(
          pptx.ShapeType
            .roundRect,
          {
            x: 0.8,
            y: 1.8,
            w: 11.6,
            h: 3.8,
            rectRadius:
              0.12,
            fill: {
              color:
                "111827",
              transparency: 8,
            },
            line: {
              color:
                theme.accent,
            },
          }
        );

        slide.addText(
          slideContent,
          {
            x: 1.1,
            y: 2.1,
            w: 6.5,
            h: 3,
            fontFace:
              "Aptos",
            fontSize: 15,
            color:
              theme.sub,
            fit:
              "shrink",
          }
        );
// FACT CARD
if (
  item.fact
) {
  slide.addShape(
    pptx.ShapeType
      .roundRect,
    {
     x: 8.0,
y: 4.45,
w: 3.5,
h: 0.95,
      rectRadius:
        0.08,
      fill: {
        color:
          theme.accent,
        transparency:
          18,
      },
      line: {
        color:
          theme.accent,
      },
    }
  );

  slide.addText(
    `📊 ${item.fact}`,
    {
     x: 8.15,
y: 4.63,
w: 3.15,
h: 0.78,
fontSize: 10,

      bold: true,
      color:
        "FFFFFF",
      fit:
        "shrink",
    }
  );
}

// STATISTICS HIGHLIGHT
if (
  item.layoutType ===
  "statistics-highlight" &&
  item.layoutType !==
    "vertical-timeline"
) {
  const statBlock =
    item.contentBlocks?.find(
      (
        block: any
      ) =>
        block.type ===
        "stat"
    );

  const statValue =
    statBlock?.value ||
    "78%";

  const statLabel =
    statBlock?.label ||
    "Key Metric";

  // CARD
  slide.addShape(
    pptx.ShapeType
      .roundRect,
    {
      x: 8.2,
y: 1.8,
w: 2.6,
h: 1.5,
      rectRadius:
        0.12,
      fill: {
        color:
          theme.accent,
        transparency:
          85,
      },
      line: {
        color:
          theme.accent,
      },
    }
  );

  // BIG NUMBER
  slide.addText(
    statValue,
    {
      x: 8.35,
y: 2.05,
w: 2.2,
h: 0.7,
      fontFace:
        "Aptos",
      fontSize: 35,
      bold: true,
      color:
        theme.accent,
      align:
        "center",
      fit:
        "shrink",
    }
  );

  // LABEL
  slide.addText(
    statLabel,
    {
      x: 8.25,
y: 2.75,
w: 2.4,
      fontFace:
        "Aptos",
      fontSize: 15,
      bold: true,
      color:
        theme.text,
      align:
        "center",
    }
  );
}

// AUTO CHART
if (
  item.chart &&
  item.layoutType !==
    "vertical-timeline"
) {
  slide.addChart(
    item.chart?.type ||
      "bar",

    [
      {
        name:
          item.chart
            ?.title ||
          "Data",

        labels:
          item.chart
            ?.labels ||
          [],

        values:
          item.chart
            ?.values ||
          [],
      },
    ],

    {
     x: 8.2,
y: 3.6,
w: 2.8,
h: 1.3,

      showLegend:
        false,

      showTitle:
  false,

      title:
        item.chart
          ?.title ||
        "Statistics",

      catAxisLabelFontSize:
        10,

      valAxisLabelFontSize:
        10,

      chartColors: [
        theme.accent,
      ],
    }
  );
}
// REAL TIMELINE
if (
  item.layoutType ===
  "vertical-timeline"
) {
  slide.addShape(
    pptx.ShapeType.line,
    {
      x: 9.6,
      y: 2,
      w: 0,
      h: 2.4,
      line: {
        color:
          theme.accent,
        width: 2.5,
      },
    }
  );

  [2, 3, 4].forEach(
    (
      y,
      index
    ) => {
      slide.addShape(
        pptx.ShapeType
          .ellipse,
        {
          x: 9.48,
          y,
          w: 0.22,
          h: 0.22,
          fill: {
            color:
              theme.accent,
          },
          line: {
            color:
              theme.accent,
          },
        }
      );

      slide.addText(
        `${
          index + 1
        }`,
        {
          x: 9.9,
          y:
            y -
            0.03,
          w: 0.3,
          h: 0.2,
          fontSize:
            11,
          bold: true,
          color:
            "FFFFFF",
        }
      );
    }
  );
}

// FLOW LINE
slide.addShape(
  pptx.ShapeType.line,
  {
    x: 9.5,
    y: 3.3,
    w: 0,
    h: 0.8,
    line: {
      color:
        theme.accent,
      width: 2,
    },
  }
);

// NODES
[9.2, 10.1, 11].forEach(
  (x) => {
    slide.addShape(
      pptx.ShapeType
        .ellipse,
      {
        x,
        y: 2.9,
       w: 0.12,
h: 0.12,
        fill: {
          color:
            theme.accent,
        },
        line: {
          color:
            theme.accent,
        },
      }
    );
  }
);
if (imageUrl) {
  slide.addImage({
    path:
      imageUrl,
    x: 10.15,
y: 1.45,
w: 1.1,
h: 0.9,
  });
}
   }
      // IMAGE RIGHT
else if (
  item.layoutType ===
  "image-right"
) {
    slide.addShape(
  pptx.ShapeType
    .roundRect,
  {
    x: 0.55,
    y: 0.55,
    w: 6.3,
    h: 4.8,
    rectRadius:
      0.12,
    fill: {
      color:
        "000000",
      transparency:
        45,
    },
    line: {
      color:
        "FFFFFF",
      transparency:
        100,
    },
  }
);
slide.addText(
  item.title ||
    "",
  {
    x: 0.8,
    y: 0.8,
    w: 5.8,
    h: 0.8,
    fontFace:
      "Aptos",
    fontSize: 24,
    bold: true,
    color:
      theme.text,
    fit:
      "shrink",
  }
);
slide.addText(
  slideContent,
    {
      x: 0.8,
      y: 2,
      w: 5.4,
      h: 3.5,
      fontFace:
        "Aptos",
      fontSize: 15,
      color:
        theme.sub,
      fit:
        "shrink",
    }
  );

  if (
    imageUrl
  ) {
    slide.addImage({
      path:
        imageUrl,
      x: 7.2,
      y: 1,
      w: 4.8,
      h: 4.8,
    });
  }
// SMART ICON SYSTEM
const topic =
  (
    body.topic ||
    ""
  ).toLowerCase();

const iconMap = [
  {
    keywords: [
      "islom",
      "islam",
      "muslim",
      "payg'ambar",
      "muhammad",
      "quron",
      "masjid",
      "xalifalik",
      "hijrat",
    ],
    icons: [
      "☪",
      "🕌",
      "✦",
      "📖",
    ],
  },

  {
    keywords: [
      "cyber",
      "security",
      "xavfsizlik",
      "hacking",
      "network",
      "server",
      "programming",
      "code",
      "dasturlash",
      "ai",
      "suniy",
      "artificial",
      "robot",
    ],
    icons: [
      "💻",
      "⚡",
      "🔐",
      "🚀",
    ],
  },

  {
    keywords: [
      "tarix",
      "history",
      "imperiya",
      "war",
      "urush",
      "empire",
      "civilization",
      "ancient",
    ],
    icons: [
      "🏛",
      "⚔",
      "📜",
      "🌍",
    ],
  },

  {
    keywords: [
      "science",
      "kimyo",
      "fizika",
      "biology",
      "matematika",
      "math",
      "physics",
      "chemistry",
      "medicine",
      "medical",
    ],
    icons: [
      "🧪",
      "⚛",
      "🔬",
      "📊",
    ],
  },

  {
    keywords: [
      "business",
      "marketing",
      "biznes",
      "startup",
      "economy",
      "finance",
      "money",
    ],
    icons: [
      "📈",
      "💰",
      "🚀",
      "🌍",
    ],
  },

  {
    keywords: [
      "education",
      "talim",
      "student",
      "universitet",
      "school",
      "study",
    ],
    icons: [
      "🎓",
      "📚",
      "💡",
      "✍️",
    ],
  },

  {
    keywords: [
      "sport",
      "football",
      "soccer",
      "basketball",
      "gym",
      "fitness",
    ],
    icons: [
      "⚽",
      "🏆",
      "🔥",
      "💪",
    ],
  },
];

// DEFAULT PREMIUM ICONS
let icons = [
  "🚀",
  "💡",
  "🌍",
  "✨",
];

// FIND MATCH
for (
  const category of iconMap
) {
  if (
    category.keywords.some(
      (keyword) =>
        topic.includes(
          keyword
        )
    )
  ) {
    icons =
      category.icons;
    break;
  }
}

  slide.addText(
    icons[
      Math.floor(
        Math.random() *
          icons.length
      )
    ],
    {
      x: 11.2,
      y: 0.75,
      w: 0.5,
      h: 0.5,
      fontSize: 22,
fontFace:
  "Arial",
    }
  );
}

// FALLBACK
else {
  slide.addShape(
    pptx.ShapeType
      .roundRect,
    {
      x: 1,
      y: 1.6,
      w: 11.2,
      h: 4.2,
      rectRadius:
        0.12,
      fill: {
        color:
          "111827",
        transparency:
          20,
      },
      line: {
        color:
          theme.accent,
      },
    }
  );

  slide.addText(
    item.title ||
      body.topic,
    {
      x: 1.2,
      y: 1.9,
      w: 10,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color:
        theme.text,
      align:
        "center",
    }
  );

  slide.addText(
    slideContent,
    {
      x: 1.5,
      y: 2.8,
      w: 9.5,
      h: 2.2,
      fontSize:
        16,
      color:
        theme.sub,
      fit:
        "shrink",
      valign:
        "middle",
      align:
        "left",
    }
  );

  if (
    imageUrl
  ) {
    slide.addImage({
      path:
        imageUrl,
      x: 9.5,
      y: 2,
      w: 2,
      h: 2,
    });
  }
}

      // SLIDE NUMBER
      slide.addText(
  `${index + 1}`,
        {
          x: 12,
          y: 6.8,
          w: 0.4,
          h: 0.2,
          fontSize:
            10,
          color:
            "94A3B8",
        }
      );
    }
        const safeName =
      body.topic.replace(
        /[^a-zA-Z0-9]/g,
        "_"
      );

    const fileName =
      `${safeName}.pptx`;

    const filePath =
      path.join(
        process.cwd(),
        "public",
        fileName
      );

    await pptx.writeFile({
      fileName:
        filePath,
    });

    if (telegramId && !isNaN(telegramId)) {
      await incrementPPT(telegramId);
    }

    // TELEGRAM
    if (
      sendToTelegram &&
      telegramUserId
    ) {
      const fileBuffer =
        fs.readFileSync(
          filePath
        );

      await sendFileToTelegram(
        Number(
          telegramUserId
        ),
        fileBuffer,
        fileName
      );

      return NextResponse.json({
        success: true,
      });
    }

    // DOWNLOAD
    return NextResponse.json({
      success: true,
      downloadUrl:
        `/${fileName}`,
    });
  } catch (
    error
  ) {
    console.error(
      "PPT ERROR:",
      error
    );
    

    return NextResponse.json(
      {
        success: false,
        error:
          "Failed to generate PPT",
      },
      {
        status: 500,
      }
    );
  }
}