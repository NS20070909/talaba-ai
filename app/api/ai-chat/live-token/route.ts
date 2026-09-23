import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } from "@google/genai";
import { NextResponse } from "next/server";
import { canUseLive } from "@/lib/limit-checker";
import { createLiveSession } from "@/lib/live-session-tracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const LIVE_MODEL = "gemini-2.5-flash-native-audio-latest";

const PERSONAS: Record<string, { name: string; voiceName: string; tone: string }> = {
  olim: {
    name: "Olim",
    voiceName: "Puck",
    tone: "Sen Talaba AI ning Olim Ustoz ismli akademik, muloyim va sokin o'quv mentorisan. Sof va tabiiy o'zbek tilida gaplash. Javoblaring qisqa, tabiiy va tushunarli bo'lsin. Talabaga kerak bo'lganda Sokrat usulida savollar ber. Ohanging bosiq, ishonchli va ustozona bo'lsin. Keraksiz uzun monolog qilma. Tabiiy suhbatni saqla.",
  },
  zilola: {
    name: "Zilola",
    voiceName: "Aoede",
    tone: "Sen Talaba AI ning Zilola ismli do'stona, energik va samimiy o'quv mentorisan. Sof va tabiiy o'zbek tilida gaplash. Javoblaring qisqa, jonli va tushunarli bo'lsin. Telegramdagi tabiiy ovozli suhbatga o'xshash ohangdan foydalan. Me'yorida tabiiy suhbat iboralaridan foydalan: 'hmm', 'tushunarli', 'ha', 'zo'r', 'a-ha'. Ularni ortiqcha takrorlama. Uzun leksiyalar o'qima. Talabaga mos, iliq va tabiiy suhbat olib bor.",
  },
};

const MODE_INSTRUCTIONS: Record<string, string> = {
  casual: `Talaba bilan erkin, samimiy va do'stona tarzda kundalik o'qish, talabalik hayoti, qiziqishlar va rejalar haqida jonli suhbatlashing. Qisqa va tabiiy gapiring.`,

  ielts: `You are a certified IELTS Speaking Examiner.
Conduct a realistic IELTS Speaking test simulation (Part 1, Part 2, or Part 3).
Speak in natural British or International English.
Ask one clear question at a time.
Listen to the student's answer, ask relevant follow-up questions or encourage them to elaborate.
Keep your oral responses concise and examiner-like.`,

  exam: `Siz qat'iy va adolatli universitet professorisiz.
Talabaning tanlagan fani bo'yicha og'zaki imtihon o'tkazasiz.
Bitta aniq nazariy yoki amaliy savol bering.
Talabaning javobini tinglang, agar to'liq bo'lmasa qo'shimcha aniqlashtiruvchi savol bering.`,

  interview: `Siz nufuzli IT/biznes kompaniyasi yoki xalqaro grant dasturining bosh HR mutaxassisisiz.
Talaba bilan rasmiy suhbat (job/grant interview) o'tkazing.
STAR metodologiyasiga asoslangan savollar bering (loyihalar, tajriba, muammolarni yechish).`,

  study: `Siz aniq fanlar va darslar bo'yicha shaxsiy repetitorsiz.
Talabaning savollariga javob bering, formulalar va qoidalarni ovoz orqali tushunarli bayon qiling.`,
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Chat kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const personaKey = body.persona === "zilola" ? "zilola" : "olim";
    const modeKey = body.mode && MODE_INSTRUCTIONS[body.mode] ? body.mode : "casual";

    // 1. Strict telegram_id validation (Required for security & quota tracking)
    const telegramId = Number(body.telegram_id);
    if (!telegramId || isNaN(telegramId) || telegramId <= 0) {
      return NextResponse.json(
        { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
        { status: 401 },
      );
    }

    // 2. Server-side Quota Check
    const liveCheck = await canUseLive(telegramId);
    if (liveCheck.banned) {
      return NextResponse.json(
        { error: "Profilingiz bloklangan.", banned: true },
        { status: 403 },
      );
    }
    if (!liveCheck.allowed || liveCheck.remainingSeconds <= 0) {
      return NextResponse.json(
        {
          error: `Bugungi Jonli Ovozli suhbat limitingiz (${liveCheck.limitMinutes} daqiqa) tugagan. Ertaga yangilanadi yoki Premium tarifga o'ting.`,
          limitReached: true,
          remainingSeconds: 0,
          limitMinutes: liveCheck.limitMinutes,
        },
        { status: 403 },
      );
    }
    const remainingSeconds = liveCheck.remainingSeconds;

    // 3. Register server-tracked session to prevent double counting
    const { sessionId } = await createLiveSession(telegramId);

    const selectedPersona = PERSONAS[personaKey];
    const modePrompt = MODE_INSTRUCTIONS[modeKey];

    const MALE_VOICE_NAMES = ["Puck", "Charon", "Fenrir", "Orus", "Algenib", "Achird"];
    const FEMALE_VOICE_NAMES = ["Aoede", "Kore", "Leda", "Zephyr", "Callirrhoe", "Autonoe"];

    const requestedVoice = typeof body.voice === "string" ? body.voice.trim() : typeof body.voiceName === "string" ? body.voiceName.trim() : "";

    let chosenVoice: string;
    if (personaKey === "zilola") {
      // Zilola is strictly female: accept only verified female voices
      if (FEMALE_VOICE_NAMES.includes(requestedVoice)) {
        chosenVoice = requestedVoice;
      } else {
        if (requestedVoice && MALE_VOICE_NAMES.includes(requestedVoice)) {
          console.warn(`[Live Token] Rejected male voice '${requestedVoice}' for female persona 'zilola'. Falling back to 'Aoede'.`);
        }
        chosenVoice = "Aoede";
      }
    } else {
      // Olim is strictly male: accept only verified male voices
      if (MALE_VOICE_NAMES.includes(requestedVoice)) {
        chosenVoice = requestedVoice;
      } else {
        if (requestedVoice && FEMALE_VOICE_NAMES.includes(requestedVoice)) {
          console.warn(`[Live Token] Rejected female voice '${requestedVoice}' for male persona 'olim'. Falling back to 'Puck'.`);
        }
        chosenVoice = "Puck";
      }
    }

    const systemInstruction = `${selectedPersona.tone}
${modePrompt}

TIL VA TABIIY MULOQOT QOIDALARI:
- Siz ko'p tilli (multilingual) mentorsiz. Foydalanuvchi qaysi tilda gapirsa, o'sha tilni avtomatik aniqlang va aynan shu tilda javob bering (O'zbek, Rus, Ingliz, Qozoq, Tojik).
- Agar suhbat davomida foydalanuvchi boshqa tilga o'tsa, siz ham darhol yangi tilga moslashing.
- Agar aralash gapirsa, fikrning asosiy mazmun tilida javob bering.
- IELTS rejimi bundan mustasno: IELTS rejimida foydalanuvchi qaysi tilda gapirishidan qat'i nazar, siz qat'iy ingliz tilida muloqot qilasiz.
- TABIIY VA MOSLASHUVCHAN MULOQOT: Quruq, haddan tashqari rasmiy yoki steril robotdek gapirmang. Jonli, samimiy insondek muloqot qiling.
- Foydalanuvchi uslubiga moslashing: agar talaba rasmiy/akademik gapirsa — professional uslubda javob bering; agar erkin, do'stona, norasmiy gapirsa yoki kundalik slang/hissiy iboralar ("blin", "fuck", "rosa qiyin ekan", "ahmoqona", va h.k.) ishlatsa — kontekstni to'g'ri his qilib, o'zingizni chetga olmasdan samimiy, vaziyatga mos norasmiy so'zlar bilan javob bering.
- CHEKLOVLAR: Foydalanuvchining shaxsiyatiga tegib haqorat qilmang, nafrat (hate speech), tahdid, zo'ravonlik yoki noqonuniy kontentga o'tmang. Har bir gapda majburan so'kinmang — faqat kontekst tabiiy ravishda talab qilganda va foydalanuvchi uslubiga javoban erkin bo'ling.
- Ovozli suhbatda gaplar qisqa, tushunarli va dialog formatida bo'lsin (uzoq monolog qilmang).
- Foydalanuvchi bilan jonli suhbat qiling, so'z navbatini unga bering.
- Foydalanuvchining fikri tugashini sabr bilan kuting. Foydalanuvchi gaplar orasida tabiiy ravishda (0.5 - 1 soniya) to'xtab yoki nafas olib o'ylasa, shoshilib so'zini bo'lmang va darhol javob berishga kirishmang. U o'z fikrini to'liq ifodalab bo'lganidan so'nggina samimiy va lo'nda javob qaytaring.
- Allow the user to finish their thought completely before responding. Do not interrupt during natural pauses between sentences.`;

    const now = Date.now();
    const ai = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });

    // Constrain session duration to user's remaining daily allowance (up to 30 min per session)
    const sessionMaxMs = Math.min(30 * 60, remainingSeconds) * 1000;

    const realtimeInputConfig = {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        prefixPaddingMs: 200,
        silenceDurationMs: 1200,
      },
    };

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        expireTime: new Date(now + sessionMaxMs).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: systemInstruction,
            realtimeInputConfig,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: chosenVoice,
                },
              },
            },
          },
        },
      },
    });

    if (!token.name) {
      throw new Error("Gemini Live token qaytarmadi.");
    }

    return NextResponse.json({
      token: token.name,
      sessionId,
      model: LIVE_MODEL,
      persona: personaKey,
      voiceName: chosenVoice,
      mode: modeKey,
      systemInstruction,
      realtimeInputConfig,
      remainingSeconds,
    });
  } catch (error: any) {
    console.error("[AI Chat] Live token creation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Ovozli suhbatni ishga tushirib bo'lmadi." },
      { status: 502 },
    );
  }
}
