"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { PPT_SYSTEM_PROMPT } from "./prompt";

type GenerateOutlineParams = {
  topic: string;
  slides: number;
  language: string;
  style: string;
};

const gemini =
  new GoogleGenerativeAI(
    process.env
      .GEMINI_PPT_API_KEY!
  );

const GEMINI_MODELS = [
  // FAST + kuchli
  "gemini-2.5-flash",

  // eng yaxshi fallback
  "gemini-3.5-flash",

  // ultra cheap / limit tejaydi
  "gemini-3.1-flash-lite",

  // stable
  "gemini-2-flash",

  // cheap backup
  "gemini-2.5-flash-lite",

  // legacy backup
  "gemini-1.5-flash",

  // emergency
  "gemini-1.5-flash-8b",
];

const OPENROUTER_MODELS = [
  "deepseek/deepseek-v4-flash:free",
  "google/gemma-4-31b:free",
  "google/gemma-4-26b-a4b:free",
  "openai/gpt-oss-120b:free",
];

async function tryGemini(
  prompt: string
) {
  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(
        `Trying Gemini: ${modelName}`
      );

      const model =
        gemini.getGenerativeModel(
          {
            model:
              modelName,
          }
        );

      const result: any =
  await Promise.race([
    model.generateContent(
      prompt
    ),

    new Promise(
      (_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Timeout"
              )
            ),
          10000
        )
    ),
  ]);

      const text =
        result.response.text();

      if (text) {
        console.log(
          `Success Gemini: ${modelName}`
        );

        return text;
      }
    } catch (
      error
    ) {
      console.log(
        `Failed ${modelName}`
      );
    }
  }

  return null;
}

async function tryOpenRouter(
  prompt: string
) {
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(
        `Trying OpenRouter: ${model}`
      );

      const response =
        await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method:
              "POST",
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                model,
                messages: [
                  {
                    role:
                      "system",
                    content:
                      PPT_SYSTEM_PROMPT,
                  },
                  {
                    role:
                      "user",
                    content:
                      prompt,
                  },
                ],
              }),
          }
        );

      const data =
        await response.json();

      const text =
        data?.choices?.[0]
          ?.message
          ?.content;

      if (text) {
        console.log(
          `Success OR: ${model}`
        );

        return text;
      }
    } catch (
      error
    ) {
      console.log(
        `Failed ${model}`
      );
    }
  }

  return null;
}

function cleanJSON(
  text: string
) {
  let cleaned =
    text
      .replace(
        /```json/g,
        ""
      )
      .replace(
        /```/g,
        ""
      )
      .trim();

  // JSON boshini topadi
  const start =
    cleaned.indexOf(
      "{"
    );

  // JSON oxirini topadi
  const end =
    cleaned.lastIndexOf(
      "}"
    );

  if (
    start !== -1 &&
    end !== -1
  ) {
    cleaned =
      cleaned.slice(
        start,
        end + 1
      );
  }

  // trailing comma fix
  cleaned =
    cleaned.replace(
      /,\s*}/g,
      "}"
    );

  cleaned =
    cleaned.replace(
      /,\s*]/g,
      "]"
    );

  return cleaned;
}

export async function generateOutline(
  data: GenerateOutlineParams
) {
  try {
    const prompt = `
${PPT_SYSTEM_PROMPT}

TOPIC:
${data.topic}

NUMBER OF SLIDES:
${data.slides}

LANGUAGE:
${data.language}

STYLE:
${data.style}

Create a WORLD-CLASS premium presentation.

STRICT REQUIREMENTS:

1. Use DIFFERENT layouts.

Do NOT repeat same layout too often.

Allowed layouts:

- hero-cover
- image-left
- image-right
- split-insight
- vertical-timeline
- horizontal-steps
- feature-grid
- premium-content
- statistics-highlight
- comparison

2. Layout order:

Slide 1:
hero-cover

Middle slides:
mix layouts

Final slide:
premium-content

3. Content rules:

Hero slide:
max 35 words

Split insight:
2–3 bullets only

Timeline:
3–5 concise steps

Feature grid:
4 cards max

Regular slide:
50–90 words

4. Visual quality:

Technology:
→ futuristic visuals

Science:
→ diagrams

Business:
→ charts

History:
→ timeline

Education:
→ premium academic style

5. Theme diversity:

Use themes:

- neon-cyan
- cyber-purple
- deep-blue
- emerald-tech
- premium-gold

6. Smart data rules:

Every slide MUST include:

- 1 real-world fact
- 1 useful statistic if possible

For topics that support numbers:

Business:
→ charts

Science:
→ diagrams

Cyber Security:
→ risk statistics

History:
→ timeline + historical facts

Islam / religion:
→ historical facts only
(NO fake statistics)

Education:
→ comparison or progress chart

Charts MUST be realistic and relevant.
Never invent nonsense values.
CRITICAL JSON RULE:

For ALL supported topics,
chart is MANDATORY.

If topic is:

- Business
- AI
- Technology
- Cyber Security
- Science
- Education
- Economy
- Marketing
- Statistics

You MUST return:

"chart": {
  "type": "bar",
  "title": "Topic Statistics",
  "labels": [
    "2022",
    "2023",
    "2024"
  ],
  "values": [
    20,
    40,
    70
  ]
}

Do NOT skip chart.

Missing chart = invalid output.
IMPORTANT:

Return ONLY valid JSON.
STRICT FORMAT:

{
  "slides": [
    {
      "layoutType": "hero-cover",

      "theme": {
        "name": "neon-cyan",
        "background": "#071120",
        "accent": "#00D9FF",
        "textPrimary": "#FFFFFF",
        "textSecondary": "#CBD5E1"
      },

      "title": "Future of AI",

      "contentBlocks": [
        {
          "type": "paragraph",
          "content":
            "Artificial intelligence is transforming industries."
        }
      ],

      "fact":
        "AI market expected to exceed trillions in value.",

      "statistics": {
        "label":
          "Adoption Rate",
        "value":
          "78%"
      },

      "chart": {
        "type":
          "bar",
        "title":
          "AI Growth",
        "labels": [
          "2022",
          "2023",
          "2024",
          "2025"
        ],
        "values": [
          10,
          25,
          50,
          78
        ]
      },

      "imageQuery":
        "cinematic futuristic AI city glowing neon premium realistic",

      "visualElements": {
        "overlay": true,
        "gradient":
          "dark",
        "alignment":
          "left"
      }
    }
  ]
}
`;
    let text =
      await tryGemini(
        prompt
      );

    if (!text) {
      text =
        await tryOpenRouter(
          prompt
        );
    }

    if (!text) {
      throw new Error(
        "No AI model worked"
      );
    }

    const cleaned =
      cleanJSON(
        text
      );

   let parsed;

try {
  parsed =
    JSON.parse(
      cleaned
    );
    
} catch (
  error
) {
  console.error(
    "Broken JSON:",
    cleaned
  );

  throw new Error(
    "AI returned invalid JSON"
  );
}
    return {
      success: true,
      outline:
        parsed.slides ||
        [],
    };
  } catch (
    error
  ) {
    console.error(
      "PPT ERROR:",
      error
    );

    return {
      success: false,
      outline: [],
    };
  }
}