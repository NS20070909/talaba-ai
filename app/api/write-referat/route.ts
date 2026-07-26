import { NextRequest, NextResponse } from "next/server";
import { guardCheck, canUseReferat, incrementReferat } from "@/lib/limit-checker";
import { getUser } from "@/lib/storage";
import { PLAN_LIMITS } from "@/lib/limits";
import { Document, Paragraph, TextRun, ImageRun, Packer, AlignmentType, Table, TableRow, TableCell, WidthType } from "docx";
import { runGeminiWithFallback } from "@/lib/ai-fallback-runner";

const MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
];

export interface CoverData {
  university: string;
  faculty?: string;
  department?: string;
  topic: string;
  subject: string;
  group?: string;
  studentName?: string;
  teacherName?: string;
  city?: string;
  year?: string;
}

async function fetchPexelsImage(keyword: string, captionText: string): Promise<{ base64: string; caption: string } | null> {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey || !keyword.trim()) return null;

    // Semantic English domain query mapping for Pexels relevance
    const lower = keyword.toLowerCase();
    let queryBoost = "";
    if (lower.includes("kiber") || lower.includes("cyber") || lower.includes("xavfsiz")) {
      queryBoost = "cybersecurity server network technology";
    } else if (lower.includes("tarix") || lower.includes("history")) {
      queryBoost = "history architecture museum heritage";
    } else if (lower.includes("iqtisod") || lower.includes("econ")) {
      queryBoost = "economy business finance analytics";
    } else if (lower.includes("matematik") || lower.includes("math")) {
      queryBoost = "mathematics science formula geometry";
    } else if (lower.includes("ekolog") || lower.includes("envir")) {
      queryBoost = "ecology ecosystem nature forest";
    } else if (lower.includes("intellekt") || lower.includes("ai") || lower.includes("robot")) {
      queryBoost = "artificial intelligence technology network";
    } else if (lower.includes("falsafa") || lower.includes("philo")) {
      queryBoost = "philosophy library ancient books statue";
    }

    const cleanKeyword = keyword
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 3)
      .join(" ");

    const query = queryBoost || cleanKeyword || keyword.substring(0, 20);

    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(4000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.photos || data.photos.length === 0) return null;

    const photo = data.photos[0];
    const imgUrl = photo.src?.medium || photo.src?.large || photo.src?.original;
    if (!imgUrl) return null;

    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(4000) });
    if (!imgRes.ok) return null;

    const arrayBuffer = await imgRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer || buffer.length === 0) return null;

    return { base64: buffer.toString("base64"), caption: captionText };
  } catch (err) {
    console.warn("[write-referat] Pexels image fetch skipped:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Markdown table parser → docx Table element (fault-tolerant)
// ---------------------------------------------------------------------------
function parseMdTableToDocxTable(lines: string[]): Table | null {
  try {
    const dataLines = lines.filter(l => !/^\|[-\s:|]+\|$/.test(l.trim()));
    if (dataLines.length < 2) return null;

    const rows = dataLines.map(line =>
      line.split("|")
        .slice(1, -1)
        .map(c => c.trim())
    ).filter(r => r.length > 0);

    if (rows.length === 0 || rows[0].length === 0) return null;

    const [headerRow, ...dataRows] = rows;
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: headerRow.map(cell =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Times New Roman", size: 24, bold: true })] })],
            })
          ),
        }),
        ...dataRows.map(row =>
          new TableRow({
            children: row.map(cell =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: cell, font: "Times New Roman", size: 24 })] })],
              })
            ),
          })
        ),
      ],
    });
  } catch {
    return null;
  }
}

const generateDocx = async (content: string, cover?: CoverData): Promise<Buffer> => {
  // Accepts both Paragraph and Table elements
  const paragraphs: (Paragraph | Table)[] = [];

  // -------------------------------------------------------------------
  // Cover Page Generation (Page 1)
  // -------------------------------------------------------------------
  if (cover) {
    // 1. Ministry & University Header
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "O'ZBEKISTON RESPUBLIKASI OLIY VA O'RTA MAHSUS TA'LIM VAZIRLIGI",
            font: "Times New Roman",
            size: 20, // 10pt
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: (cover.university || "MUHAMMAD AL-XORAZMIY NOMIDAGI TOSHKENT AXBOROT TEXNOLOGIYALARI UNIVERSITETI").toUpperCase(),
            font: "Times New Roman",
            size: 24, // 12pt
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
      })
    );

    if (cover.faculty) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cover.faculty,
              font: "Times New Roman",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60 },
        })
      );
    }

    if (cover.department) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cover.department,
              font: "Times New Roman",
              size: 24,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
        })
      );
    }

    // Gap before Title
    paragraphs.push(
      new Paragraph({
        children: [],
        spacing: { before: 720, after: 0 },
      })
    );

    // 2. REFERAT Title Block
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "REFERAT",
            font: "Times New Roman",
            size: 56, // 28pt
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Mavzu: ${cover.topic}`,
            font: "Times New Roman",
            size: 28, // 14pt
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 120 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Fan: ${cover.subject}`,
            font: "Times New Roman",
            size: 24, // 12pt
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 600 },
      })
    );

    // 3. Info Block (Right-aligned)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Bajardi: ${cover.studentName || "____________________"}`,
            font: "Times New Roman",
            size: 24,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120, after: 60 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Guruh: ${cover.group || "____________________"}`,
            font: "Times New Roman",
            size: 24,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 60, after: 60 },
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Tekshirdi: ${cover.teacherName || "____________________"}`,
            font: "Times New Roman",
            size: 24,
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 60, after: 720 },
      })
    );

    // 4. Footer Block (City – Year)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${cover.city || "Toshkent"} – ${cover.year || new Date().getFullYear()}`,
            font: "Times New Roman",
            size: 24,
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 720, after: 240 },
      })
    );
  }

  // -------------------------------------------------------------------
  // Main Document Content (Page 2 onwards)
  // -------------------------------------------------------------------
  const lines = content.split("\n");
  let isFirstContentParagraph = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Smart Image embedded line parser
    if (line.startsWith("[IMAGE:") && line.endsWith("]")) {
      try {
        const inner = line.substring(7, line.length - 1);
        const pipeIdx = inner.indexOf("|");
        if (pipeIdx > 0) {
          const caption = inner.substring(0, pipeIdx);
          const base64Data = inner.substring(pipeIdx + 1);
          const imgBuffer = Buffer.from(base64Data, "base64");

          if (imgBuffer.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imgBuffer,
                    transformation: {
                      width: 460,
                      height: 260,
                    },
                    type: "png",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 240, after: 120 },
              })
            );

            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: caption,
                    font: "Times New Roman",
                    size: 20, // 10pt
                    italics: true,
                    color: "555555",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 240 },
              })
            );
            continue;
          }
        }
      } catch (err) {
        console.warn("[generateDocx] Image parse failed:", err);
      }
    }

    // ── Markdown table block detection ──────────────────────────────────────
    if (line.trim().startsWith("|") && line.trim().endsWith("|") && (line.match(/\|/g) || []).length >= 2) {
      const tableLines: string[] = [];
      // Collect consecutive | lines (inner loop advances i)
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      // Back off one so the outer for-loop's i++ lands on the next non-table line
      i--;
      // Try to parse as a proper table
      const tableEl = parseMdTableToDocxTable(tableLines);
      if (tableEl) {
        paragraphs.push(new Paragraph({ children: [], spacing: { before: 120 } }));
        paragraphs.push(tableEl);
        paragraphs.push(new Paragraph({ children: [], spacing: { after: 240 } }));
      } else {
        // Fallback: render as plain text
        for (const tl of tableLines) {
          paragraphs.push(new Paragraph({
            children: [new TextRun({ text: tl, font: "Times New Roman", size: 24 })],
            spacing: { line: 360 },
          }));
        }
      }
      continue;
    }

    // ── Standard markdown lines ─────────────────────────────────────────────
    let textRun: TextRun;
    if (line.startsWith("## ")) {
      textRun = new TextRun({
        text: line.substring(3),
        font: "Times New Roman",
        size: 28,
        bold: true,
      });
    } else if (line.startsWith("### ")) {
      textRun = new TextRun({
        text: line.substring(4),
        font: "Times New Roman",
        size: 24,
        bold: true,
      });
    } else if (line.startsWith("# ")) {
      textRun = new TextRun({
        text: line.substring(2),
        font: "Times New Roman",
        size: 32,
        bold: true,
      });
    } else {
      textRun = new TextRun({
        text: line,
        font: "Times New Roman",
        size: 28,
      });
    }

    // If cover page was generated, the first content paragraph starts on a fresh page
    const shouldBreakPage = cover && isFirstContentParagraph;
    if (isFirstContentParagraph && line.trim().length > 0) {
      isFirstContentParagraph = false;
    }

    paragraphs.push(
      new Paragraph({
        children: [textRun],
        spacing: { line: 360 },
        alignment: AlignmentType.JUSTIFIED,
        ...(shouldBreakPage ? { pageBreakBefore: true } : {}),
      })
    );
  }

  // Document Metadata Properties
  const doc = new Document({
    creator: "Talaba AI",
    title: cover?.topic || "Referat",
    description: "Talaba AI tomonidan yaratilgan akademik referat",
    subject: cover?.subject || "Akademik referat",
    keywords: "Referat, AI, Talaba AI, Ta'lim",
    lastModifiedBy: "Talaba AI",
    sections: [
      {
        // ISectionOptions.children accepts FileChild which includes both Paragraph and Table
        children: paragraphs as any[],
      },
    ],
  });

  return Packer.toBuffer(doc);
};

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------
    // STAGE 1: Input Validation
    // -------------------------------------------------------------------
    const body = await req.json();
    const {
      topic,
      requirements,
      telegram_user_id,
      pages,
      size,
      outline,
      subject,
      language,
      include_images,
      includeImages,
      citation_style,
      citationStyle,
      university,
      faculty,
      department,
      group,
      student_name,
      studentName,
      teacher_name,
      teacherName,
      city,
    } = body;

    const shouldIncludeImages = Boolean(include_images || includeImages);
    const selectedCitationStyle = String(citation_style || citationStyle || "oddiy").toLowerCase();

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new NextResponse("Topic is required", { status: 400 });
    }

    const telegramId = Number(telegram_user_id);
    if (!telegramId || isNaN(telegramId)) {
      return new NextResponse("telegram_user_id is required", { status: 400 });
    }

    const guard = await guardCheck(telegramId);
    if (guard.blocked) {
      return new NextResponse(
        guard.result?.banned ? "🚫 Siz bloklangansiz" : "Ruxsat etilmagan",
        { status: 403 }
      );
    }

    // -------------------------------------------------------------------
    // STAGE 2: Request Normalization
    // -------------------------------------------------------------------
    const normalizedTopic = topic.trim();
    const normalizedLanguage = language || "uz";
    const normalizedSubject = subject || "Erkin mavzu";
    const requestedPagesRaw = pages || size;
    let requestedMaxPages = 7; // default to FREE

    if (requestedPagesRaw) {
      if (typeof requestedPagesRaw === "string") {
        if (requestedPagesRaw.toLowerCase() === "cheksiz") {
          requestedMaxPages = Infinity;
        } else {
          const parts = requestedPagesRaw.split("-");
          const lastPart = parts[parts.length - 1];
          const parsed = parseInt(lastPart.replace("+", ""), 10);
          if (!isNaN(parsed)) {
            requestedMaxPages = parsed;
          }
        }
      } else if (typeof requestedPagesRaw === "number") {
        requestedMaxPages = requestedPagesRaw;
      }
    }

    const user = await getUser(telegramId);
    const planName = user ? user.plan : "FREE";
    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.FREE;
    const planMinLimit = limits.referatMinPages ?? 3;
    const planMaxLimit = limits.unlimited ? 50 : (limits.referatMaxPages ?? 7);

    if (requestedPagesRaw && (requestedMaxPages > planMaxLimit || requestedMaxPages < planMinLimit)) {
      return new NextResponse(
        `Sizning tarifingizda referat sahifa soni cheklangan. Ruxsat etilgan diapazon: ${planMinLimit}-${planMaxLimit === Infinity ? "50" : planMaxLimit} bet. (Tarif: ${planName}).`,
        { status: 403 }
      );
    }

    const limitCheck = await canUseReferat(telegramId);
    if (!limitCheck.allowed) {
      return new NextResponse(
        "Sizning referat yaratish limitingiz tugagan. Keyingi oyda yana urinib ko'ring.",
        { status: 403 }
      );
    }

    // Cover Page data preparation
    const cover: CoverData = {
      university: university || "Muhammad al-Xorazmiy nomidagi Toshkent axborot texnologiyalari universiteti",
      faculty: faculty || "",
      department: department || "",
      group: group || "",
      studentName: student_name || studentName || "",
      teacherName: teacher_name || teacherName || "",
      city: city || "Toshkent",
      year: new Date().getFullYear().toString(),
      topic: normalizedTopic,
      subject: normalizedSubject,
    };

    // -------------------------------------------------------------------
    // STAGE 3: AI Generation — fault-tolerant per-section sequential generation
    // -------------------------------------------------------------------
    const apiKey = process.env.REFERAT_GEMINI_API_KEY;
    if (!apiKey) {
      return new NextResponse("REFERAT_GEMINI_API_KEY topilmadi", { status: 500 });
    }

    const outlineContext = Array.isArray(outline) && outline.length > 0
      ? `Outline: ${outline.join("; ")}`
      : "";

    const getLangNote = (lang: string) => {
      if (lang === "tg") {
        return "Tajik language. IMPORTANT: Maintain the academic and institutional context of the Republic of Uzbekistan (O'zbekiston Respublikasi, Uzbek universities, laws, and ministries). Do NOT switch to Tajikistan context.";
      }
      return lang;
    };

    const baseContext = `Topic: ${normalizedTopic}
Subject: ${normalizedSubject}
Language: ${getLangNote(normalizedLanguage)}
Expected length: ${requestedMaxPages} pages
${outlineContext}`;

    const generationStart = Date.now();
    let successCount = 0;
    let failCount = 0;

    const trySection = async (sectionPrompt: string): Promise<string> => {
      try {
        const { text } = await runGeminiWithFallback({
          apiKey,
          modelChain: MODEL_CHAIN,
          prompt: sectionPrompt,
        });
        const trimmed = text.trim();
        if (!trimmed) {
          failCount++;
          console.warn("[write-referat] Section returned empty text.");
          return "";
        }
        successCount++;
        return trimmed;
      } catch (err: any) {
        failCount++;
        console.warn(`[write-referat] Section generation failed: ${err?.message || err}`);
        return "";
      }
    };

    // Citation style instruction for Section 6
    let citationInstruction = "List 5-8 realistic academic references in standard numbered format.";
    if (selectedCitationStyle === "apa") {
      citationInstruction = "Format all 5-8 academic references strictly following APA (American Psychological Association) 7th Edition citation style.";
    } else if (selectedCitationStyle === "mla") {
      citationInstruction = "Format all 5-8 academic references strictly following MLA (Modern Language Association) 9th Edition citation style.";
    } else if (selectedCitationStyle === "gost") {
      citationInstruction = "Format all 5-8 academic references strictly following GOST 7.1-2003 bibliographic citation standard.";
    }

    // Generate all core sections concurrently for maximum performance (reduces execution time by ~80%)
    const [
      introText,
      rawCh1Text,
      rawCh2Text,
      rawCh3Text,
      conclusionText,
      referencesText,
    ] = await Promise.all([
      trySection(
        `You are an academic writer. Write the Introduction section of a referat.
${baseContext}
Write ONLY the Introduction section. Use the language specified above. Start with the heading "## Kirish" (or its translation if language is not Uzbek). Write 2-4 substantive paragraphs covering relevance, purpose, and objectives of the topic.`
      ),
      trySection(
        `You are an academic writer. Write Chapter 1 (the first main chapter) of a referat.
${baseContext}
Write ONLY Chapter 1. Use the language specified above. Start with an appropriate heading for the first main aspect of the topic. Write 3-5 detailed paragraphs covering core concepts, definitions, and foundational information.`
      ),
      trySection(
        `You are an academic writer. Write Chapter 2 (the second main chapter) of a referat.
${baseContext}
Write ONLY Chapter 2. Use the language specified above. Start with an appropriate heading for the second main aspect of the topic. Write 3-5 detailed paragraphs covering analysis, comparisons, examples, and relevant data.`
      ),
      trySection(
        `You are an academic writer. Write Chapter 3 (the third main chapter) of a referat.
${baseContext}
Write ONLY Chapter 3. Use the language specified above. Start with an appropriate heading for the third main aspect of the topic. Write 3-5 detailed paragraphs covering current problems, solutions, and future perspectives.`
      ),
      trySection(
        `You are an academic writer. Write the Conclusion section of a referat.
${baseContext}
Write ONLY the Conclusion section. Use the language specified above. Start with the heading "## Xulosa" (or its translation if language is not Uzbek). Summarize the key findings, conclusions, and recommendations in 2-3 paragraphs.`
      ),
      trySection(
        `You are an academic writer. Write the References section of a referat.
${baseContext}
Write ONLY the References section. Use the language specified above. Start with the heading "## Foydalanilgan Adabiyotlar" (or its translation if language is not Uzbek).
${citationInstruction}`
      ),
    ]);

    let ch1Text = rawCh1Text;
    let ch2Text = rawCh2Text;
    let ch3Text = rawCh3Text;

    // Section 7: Data Tables (fault-tolerant — kept outside trySection to avoid
    // inflating the successCount threshold which is only for sections 1-6)
    let tablesText = "";
    try {
      const { text: tablesRaw } = await runGeminiWithFallback({
        apiKey,
        modelChain: MODEL_CHAIN,
        prompt: `You are an academic data analyst. Generate 1-2 concise structured data tables for the referat topic "${normalizedTopic}".
${baseContext}
Write ONLY tables in proper markdown table format (using | pipes). Each table must:
- Have a bold heading above it starting with ### 
- Have a header row and at least 2 data rows
- Contain real, relevant data or comparisons related to the topic
Also write 1 brief process flow (3-5 steps with → arrows) if relevant.
If tables are genuinely not applicable, write a brief statistical comparison instead.
Keep this section concise and data-focused.`,
      });
      tablesText = tablesRaw.trim();
    } catch (err: any) {
      console.warn("[write-referat] Section 7 (tables) skipped:", err?.message || err);
    }

    const generationDurationMs = Date.now() - generationStart;
    console.log(
      `[write-referat] Generation complete. Sections: ${successCount} succeeded, ${failCount} failed. Duration: ${generationDurationMs}ms`
    );

    if (successCount < 3) {
      return new NextResponse(
        "Referat generatsiyasi muvaffaqiyatsiz tugadi. Iltimos qayta urinib ko'ring.",
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------
    // STAGE 3.5: AI Smart Images (Premium feature, max 1 image per main chapter)
    // -------------------------------------------------------------------
    if (shouldIncludeImages && planName !== "FREE") {
      const extractHeading = (text: string, fallback: string) => {
        const firstLine = text.split("\n").find((l) => l.trim().length > 0) || "";
        return firstLine.replace(/^[#\d.\-\s]+/, "").trim() || fallback;
      };

      const getKeyword = (text: string) => {
        const heading = extractHeading(text, normalizedTopic);
        return `${heading} ${normalizedTopic}`;
      };

      const [img1, img2, img3] = await Promise.allSettled([
        ch1Text ? fetchPexelsImage(getKeyword(ch1Text), `1-rasm. ${extractHeading(ch1Text, "Asosiy tushunchalar")}`) : Promise.resolve(null),
        ch2Text ? fetchPexelsImage(getKeyword(ch2Text), `2-rasm. ${extractHeading(ch2Text, "Tahlil va tadqiqot")}`) : Promise.resolve(null),
        ch3Text ? fetchPexelsImage(getKeyword(ch3Text), `3-rasm. ${extractHeading(ch3Text, "Istiqbollar va yechimlar")}`) : Promise.resolve(null),
      ]);

      if (img1.status === "fulfilled" && img1.value) {
        ch1Text += `\n\n[IMAGE:${img1.value.caption}|${img1.value.base64}]`;
      }
      if (img2.status === "fulfilled" && img2.value) {
        ch2Text += `\n\n[IMAGE:${img2.value.caption}|${img2.value.base64}]`;
      }
      if (img3.status === "fulfilled" && img3.value) {
        ch3Text += `\n\n[IMAGE:${img3.value.caption}|${img3.value.base64}]`;
      }
    }

    // -------------------------------------------------------------------
    // STAGE 4: Document Assembly — ordered, validated, normalised
    // -------------------------------------------------------------------
    const titleBlock = `# ${normalizedTopic}`;

    const hasOutline = Array.isArray(outline) && outline.length > 0;
    const tocBlock = hasOutline
      ? `## Mundarija\n${(outline as string[]).map((item, i) => `${i + 1}. ${item}`).join("\n")}`
      : "";

    const orderedSections: string[] = [
      titleBlock,
      tocBlock,
      introText,
      ch1Text,
      ch2Text,
      ch3Text,
      conclusionText,
      tablesText,
      referencesText,
    ].filter((s) => s.trim().length > 0);

    let assembledContent = orderedSections.join("\n\n");

    assembledContent = assembledContent.replace(/\n{3,}/g, "\n\n");
    assembledContent = assembledContent
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");
    assembledContent = assembledContent.replace(/^[-*=]{3,}\s*$/gm, "");
    assembledContent = assembledContent.trim();

    if (!assembledContent) {
      return new NextResponse(
        "Referat hujjati bo'sh. Iltimos qayta urinib ko'ring.",
        { status: 500 }
      );
    }

    // -------------------------------------------------------------------
    // STAGE 5: DOCX Formatter (with Cover Page & Metadata)
    // -------------------------------------------------------------------
    const docxBuffer = await generateDocx(assembledContent, cover);

    // Increment referat usage strictly once after successful generation
    await incrementReferat(telegramId);

    // -------------------------------------------------------------------
    // STAGE 6: Response
    // -------------------------------------------------------------------
    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="referat_${Date.now()}.docx"`,
      },
    });
  } catch (error: any) {
    console.error("[write-referat] Unhandled error:", error?.message || error);
    return new NextResponse("Referat yaratishda xatolik yuz berdi.", { status: 500 });
  }
}
