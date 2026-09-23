import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { incrementAiChatMessages, guardCheck } from "@/lib/limit-checker";
import { checkRateLimit } from "@/lib/rate-limiter";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEXT_MODELS = [
  process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
];

const SYSTEM_PROMPTS: Record<string, string> = {
  general: `Siz Talaba AI ning oliy darajadagi AI O'quv Mentorisiz (Talaba AI Study Mentor).
Asosiy vazifangiz: Talabalarga darslar, fanlar, imtihonlar va vazifalarni chuqur, tushunarli va qiziqarli o'rgatish.
- Foydalanuvchi qaysi tilda yozsa (asosan o'zbek tilida), aniq, samimiy va professional tilda javob bering.
- Javoblarni chiroyli formatda (markdown, qisqa bandlar, kerak bo'lsa misollar) taqdim eting.
- Murakkab mavzularni oddiy analogiyalar orqali tushuntiring.
- Bilmagan narsangizni aslo to'qib chiqarmang.`,

  socratic: `Siz Sokratik O'qituvchisiz (Socratic Mentor).
MUHIM QOIDA: Talaba biror savol yoki mavzu berganida, DARHOL YAKUNIY JAVOBNI BERMANG!
Buning o'rniga:
1. Talabani mustaqil o'ylashga undaydigan yo'naltiruvchi savol bering.
2. Talaba javob bersa: to'g'ri tomonlarini maqtang, xatosini nozik ko'rsating va navbatdagi qadamga yo'naltiring.
3. Kerak bo'lsa kichik maslahat (hint) bering.
4. Faqat talaba "javobni ayt", "yechimni ber" deb qat'iy so'rasagina to'liq javob va tushuntirishni oching.
Maqsad — talabaning o'zi yechimga yetib borishini ta'minlash.`,

  code: `Siz Senior Dasturchi va Kod Murabbiysisiz (Code Explainer).
Talaba kod yoki dasturlash savolini yuborganda quyidagi aniq struktura bilan javob bering:
1. 🔍 XATO VA KAMCHILIKLAR: Sintaksis, mantiqiy yoki potensial xatolarni aniq ko'rsating.
2. 💡 QADAMMA-QADAM TAHLIL: Kod qanday ishlashi va nima uchun bunday xatolik yuz berganini qisqa tushuntiring.
3. 🛠 TO'G'RILANGAN KOD: Xatosi tuzatilgan, toza va optimal kod variantini bering.
4. 🚀 YAXSHILASH TAVSIYALARI: Best practice va samaradorlikni oshirish usullari.`,

  math: `Siz Matematika va Aniq Fanlar Murabbiysisiz (Step-by-Step Math Solver).
Talaba masala yoki formulani yuborganda:
1. 1-qadam, 2-qadam, 3-qadam formatida yeching.
2. Har bir qadamda FAQAT formulani emas, balki "NEGA bu amal bajarildi?" degan sababini tushuntiring.
3. Yakuniy javobni aniq va ajratib ko'rsating.
4. Talaba mustaqil tekshirib ko'rishi uchun qisqa tekshirish (verification) usulini ilova qiling.`,

  ielts: `You are a certified IELTS Speaking & Writing Examiner and Academic Mentor.
Provide academic, structured, and constructive guidance following the official IELTS band descriptors:
- Fluency & Coherence
- Lexical Resource (rich academic vocabulary, collocations)
- Grammatical Range & Accuracy
- Pronunciation (phonetics and intonation advice when discussing speaking)
Provide sample high-band responses (Band 7.5-8.5), highlight common candidate mistakes, and give exact improvements.`,

  interview: `Siz Karyera va Suhbat Ekspertisiz (HR & Technical Interview Coach).
Talabani ish, amaliyot yoki grant suhbatlariga tayyorlaysiz:
- STAR metodologiyasidan (Situation, Task, Action, Result) foydalanishni o'rgating.
- Talabaning javoblarini tahlil qiling: samimiylik, ishonch, ravonlik va professionalizm darajasini baholang.
- Kuchli javob namunalarini va HR mutaxassislari e'tibor beradigan nozik jihatlarni tushuntiring.`,

  research: `Siz Ilmiy Tadqiqot va Akademik Tahlil Mentorisiz (Academic Research Mentor).
Talabalarga ilmiy maqolalar, kurs ishlari, tezislar, adabiyotlar tahlili va ilmiy metodologiya bo'yicha yo'l-yo'riq ko'rsating:
- Ma'lumotlarni chuqur ilmiy mantiq bilan tizimlashtiring.
- Manbalar bilan ishlash, gipoteza shakllantirish va ilmiy asoslashga e'tibor bering.`,
};

const NATURAL_CONVERSATION_GUIDELINES = `
TABIIY VA MOSLASHUVCHAN MULOQOT QOIDALARI:
- Haddan tashqari qotib qolgan, steril yoki quruq robotik uslubda gapirmang. Insondek samimiy, jonli va kontekstga mos muloqot qiling.
- Foydalanuvchining gapirish uslubiga (tone/style) moslashing:
  * Agar foydalanuvchi jiddiy/akademik/ilmiy yozsa: aniq, professional va tuzilgan akademik tilda javob bering.
  * Agar foydalanuvchi do'stona, norasmiy yoki erkin gapirsa: samimiy, erkin va jonli muloqot qiling.
  * Agar foydalanuvchi hissiyot bilan, kundalik slang, jargon yoki yengil so'kinish/qo'pol iboralar ("blin", "fuck", "ahmoqona", "rosa qiyin-e", va h.k.) ishlatsa: kontekstni to'g'ri tushuning, keraksiz va'z o'qimang yoki o'zingizni chetga olmang, vaziyatga mos ravishda tabiiy norasmiy so'zlar va hissiy undovlarni ishlating.
- CHEKLOVLAR: Hech qachon foydalanuvchining shaxsiyatiga tegib haqorat qilmang, nafrat (hate speech), tahdid, zo'ravonlik, diskriminatsiya yoki noqonuniy kontent yaratmang. Har bir gapga majburan so'kinish qo'shmang — faqat kontekst tabiiy ravishda talab qilganda va foydalanuvchi uslubiga javoban erkin bo'ling.
- KO'P TILLILIK: Foydalanuvchi qaysi tilda (O'zbek, Rus, Ingliz, Qoraqalpoq, Tojik, Qozoq yoki aralash) gapirsa, o'sha tildagi mos tabiiy ohangda javob bering.`;

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    message.text.trim().length > 0
  );
}

export async function POST(request: Request) {
  let isWebSearch = false;
  try {
    const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Chat kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const rawMessages: unknown[] = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages.filter(isChatMessage).slice(-16);
    const mode = typeof body.mode === "string" && SYSTEM_PROMPTS[body.mode] ? body.mode : "general";
    const webSearch = Boolean(body.webSearch);
    isWebSearch = webSearch;
    const telegramId = body.telegram_id ? Number(body.telegram_id) : undefined;

    // 1. Security Rate Limiting (Max 15 requests per 60 seconds per user/ip)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const rateLimitKey = telegramId && !isNaN(telegramId) && telegramId > 0 ? `user:${telegramId}` : `ip:${ip}`;
    const rateResult = checkRateLimit(rateLimitKey, 15, 60_000);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Juda ko'p so'rov yuborildi. Birozdan keyin qayta urinib ko'ring." },
        { status: 429 }
      );
    }

    // 2. Ban / Security Guard Check
    if (telegramId && !isNaN(telegramId) && telegramId > 0) {
      const guard = await guardCheck(telegramId);
      if (guard.blocked && guard.result?.banned) {
        return NextResponse.json(
          { error: "Profilingiz bloklangan.", banned: true },
          { status: 403 }
        );
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({ error: "Xabar yuborilmadi." }, { status: 400 });
    }

    if (messages.some((message) => message.text.length > 6_000)) {
      return NextResponse.json(
        { error: "Har bir xabar 6 000 belgidan oshmasligi kerak." },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const basePrompt = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general;
    const systemInstruction = `${basePrompt}\n\n${NATURAL_CONVERSATION_GUIDELINES}`;

    const requestConfig: Record<string, unknown> = {
      systemInstruction,
      temperature: mode === "socratic" ? 0.7 : 0.5,
      maxOutputTokens: 3_000,
    };

    if (webSearch) {
      // Enable real Google Search grounding
      requestConfig.tools = [{ googleSearch: {} }];
    }

    const attachment = body.attachment as { mimeType: string; data: string; name?: string } | undefined;

    let response: any = null;
    let usedModel = TEXT_MODELS[0];
    let lastErr: any = null;

    for (const model of TEXT_MODELS) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: messages.map((message, idx) => {
            const isLatest = idx === messages.length - 1;
            const parts: any[] = [];
            if (isLatest && message.role === "user" && attachment?.data && attachment?.mimeType) {
              parts.push({
                inlineData: {
                  mimeType: attachment.mimeType,
                  data: attachment.data,
                },
              });
            }
            parts.push({ text: message.text.trim() });
            return {
              role: message.role === "assistant" ? "model" : "user",
              parts,
            };
          }),
          config: requestConfig,
        });
        usedModel = model;
        if (response.text?.trim()) {
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[AI Chat] Model ${model} failed (${err?.status || err?.statusCode || "err"}):`, err?.message || err);
      }
    }

    if (!response || !response.text?.trim()) {
      if (webSearch) {
        return NextResponse.json(
          {
            success: false,
            error: "SEARCH_FAILED",
            message: "⚠️ Internet qidiruvida vaqtinchalik xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.",
          },
          { status: 503 },
        );
      }
      throw lastErr || new Error("Gemini bo'sh javob qaytardi.");
    }

    const text = response.text.trim();

    // Extract real web grounding sources if available
    let sources: Array<{ title: string; url: string }> = [];
    try {
      const candidate = response.candidates?.[0];
      const groundingChunks = (candidate as any)?.groundingMetadata?.groundingChunks;
      if (Array.isArray(groundingChunks)) {
        sources = groundingChunks
          .map((chunk: any) => {
            const web = chunk.web;
            if (web && web.uri) {
              return { title: web.title || web.uri, url: web.uri };
            }
            return null;
          })
          .filter(Boolean)
          .slice(0, 8) as Array<{ title: string; url: string }>;
      }
    } catch {
      // Non-fatal if metadata format differs
    }

    // Track usage asynchronously without blocking response
    if (telegramId && !isNaN(telegramId)) {
      incrementAiChatMessages(telegramId).catch((err) => {
        console.warn("[AI Chat] Failed to increment chat count:", err);
      });
    }

    return NextResponse.json({
      success: true,
      text,
      model: usedModel,
      mode,
      sources: sources.length > 0 ? sources : undefined,
      searchUsed: Boolean(webSearch),
      grounded: sources.length > 0,
    });
  } catch (error: any) {
    console.error("[AI Chat] Text generation failed:", error);

    const is503 = error?.status === 503 ||
      error?.statusCode === 503 ||
      error?.message?.includes("503") ||
      error?.message?.includes("UNAVAILABLE") ||
      error?.message?.includes("high demand");

    if (isWebSearch) {
      return NextResponse.json(
        {
          success: false,
          error: "SEARCH_FAILED",
          message: "⚠️ Internet qidiruvida vaqtinchalik xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.",
        },
        { status: 503 },
      );
    }

    if (is503) {
      return NextResponse.json(
        {
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message: "⚠️ AI hozir band. Iltimos, bir necha soniyadan keyin qayta urinib ko‘ring.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "GENERATION_FAILED",
        message: "AI hozircha javob bera olmadi. Iltimos, qayta urinib ko'ring.",
      },
      { status: 502 },
    );
  }
}

