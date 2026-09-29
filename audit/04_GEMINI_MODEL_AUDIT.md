# 04. GOOGLE GEMINI MODELLARI VA AI ARXITEKTURA AUDITI

Ushbu hujjatda Talaba AI loyihasida uchraydigan barcha sun'iy intellekt modellari, ularning rasmiy holati, SDK mosligi va fallback zanjirlari bo'yicha to'liq tahlil keltiriladi.

---

## 1. Kod Bazasida Topilgan Barcha Modellar Inventari

Loyiha bo'ylab quyidagi Google Gemini va OpenRouter modellari identifikatorlari aniqlandi:

| Model identifikatori | Qaysi fayllarda ishlatiladi | Vazifasi va Modalligi | Rasmiy Holati (Google AI) |
|---|---|---|---|
| `gemini-3.8-flash` | `app/api/ai-chat/route.ts`, `app/api/ai-chat/live-session/route.ts`, `scripts/test-stage2.ts` | Matn, Rasm, Hujjat, Kod, Murakkab fikrlash | **Rasmiy (Chiqarilgan: 2026-09-02)** |
| `gemini-3.7-flash` | `app/api/ai-chat/live-session/route.ts` | Multimodal agentik model | Rasmiy |
| `gemini-3.6-flash` | `app/api/analyze/route.ts`, `app/api/write-referat/route.ts`, `app/talaba-tools/ppt/actions.ts` | Bilet OCR, Slaydlar, Referat | Rasmiy |
| `gemini-3.5-flash` | `app/api/ai-chat/route.ts`, `app/api/analyze/route.ts`, `ppt/actions.ts` | Fallback matn va tahlil | Rasmiy |
| `gemini-3.5-flash-lite` | `app/api/ai-chat/route.ts`, `app/api/analyze/route.ts`, `ppt/actions.ts` | Yengil, arzon, tezkor javob | Rasmiy |
| `gemini-3.1-flash-lite` | `app/api/ai-chat/route.ts`, `app/api/analyze/route.ts`, `ppt/actions.ts` | Yuqori tezlikdagi fallback | Rasmiy |
| `gemini-3.1-flash-live-preview` | `scripts/test-stage3.ts` | Jonli WebRTC/WebSocket audio | Rasmiy (Preview) |
| `gemini-2.5-flash-native-audio-latest` | `app/api/ai-chat/live-token/route.ts` | Gemini Live efemer token modeli | Rasmiy |
| `gemini-2.5-flash-preview-tts` | `scripts/test-stage2.ts`, `scripts/test-tts-check.ts` | Matndan ovoz sintezi (TTS) | Rasmiy (Preview) |
| `gemini-2.5-flash` | `app/api/analyze/route.ts`, `ppt/actions.ts` | Barqaror umumiy model | Rasmiy |
| `gemini-2.5-flash-lite` | `app/api/analyze/route.ts`, `ppt/actions.ts` | Kichik resursli fallback | Rasmiy |
| `gemini-2.5-pro` | `app/talaba-tools/ppt/actions.ts`, `scripts/test-grounding.ts` | Murakkab tahlil | Rasmiy |
| `gemini-flash-latest` | `app/api/analyze/route.ts`, `ppt/actions.ts` | Dinamik so'nggi flash aliasi | Rasmiy |
| `gemini-2.0-flash` | `app/api/analyze/route.ts` | Eski barqaror flash | Rasmiy (Legacy) |

### OpenRouter zaxira modellari (`app/talaba-tools/ppt/actions.ts`):
* `deepseek/deepseek-v4-flash:free`
* `google/gemma-4-31b:free`
* `google/gemma-4-26b-a4b:free`
* `openai/gpt-oss-120b:free`

---

## 2. `gemini-3.8-flash` Modeli Bo'yicha Maxsus Tekshiruv

* **Oldingi audit da'vosi:** "`gemini-3.8-flash` mavjud emas, u gallyutsinatsiya va har bir so'rovda 44 soniya vaqt yo'qotadi."
* **Mustaqil tekshiruv natijasi:** **FALSE POSITIVE (DA'VO NOTO'G'RI)**.
* **Haqiqiy holat:**
  1. Google 2026-yil 2-sentabrda `gemini-3.8-flash` va `gemini-3.8-flash-cyber` modellarini rasman taqdim etgan.
  2. Ushbu model uzoq ufqli dasturiy ta'minot injiniringi (long-horizon software engineering), avtonom agentlar va ko'p bosqichli mulohaza yuritish uchun optimallashtirilgan.
  3. Kontekst oynasi: **1,048,576 token (1M)**.
  4. Rasmiy narxi: Kirish uchun $0.75 / 1M token, chiqish uchun $3.75 / 1M token.
  5. Loyihada yangi `@google/genai` SDK (v2.6.0) o'rnatilgan bo'lib, ushbu model bilan to'liq ishlaydi.
* **44 soniyalik kechikish afsonasi:**
  * `lib/ai-fallback-runner.ts` (L94-96) dagi kod faqat 500, 503 va timeout kabi qayta urinish mumkin bo'lgan (`isTransientError`) holatlardagina 2-urinishni bajaradi. Agar model mavjud bo'lmasa (404) yoki noto'g'ri so'rov berilsa (400), u darhol bitta urinishdan keyin break qiladi va 44 soniya kutmaydi.

---

## 3. SDK Dualligi: `@google/genai` vs `@google/generative-ai`

Loyiha arxitekturasida **ikkita turli Google SDK** bir vaqtda ishlatilmoqda:
1. **Yangi rasmiy SDK (`@google/genai` v2.6.0):**
   * Ishlatilgan joylar: `app/api/ai-chat/route.ts`, `app/api/ai-chat/live-token/route.ts`, `scripts/*`.
   * Sintaksis: `new GoogleGenAI({ apiKey }).models.generateContent({ model, contents, config })`.
   * Imkoniyatlari: Google Search grounding, Gemini Live efemer tokenlar (`authTokens.create`), multimodal audio chiqish.
2. **Eski SDK (`@google/generative-ai` v0.24.1):**
   * Ishlatilgan joylar: `lib/ai-fallback-runner.ts`, `app/api/analyze/route.ts`, `app/talaba-tools/ppt/actions.ts`, `app/api/write-referat/route.ts`.
   * Sintaksis: `new GoogleGenerativeAI(apiKey).getGenerativeModel({ model }).generateContent(prompt)`.
* **Tavsiya:** Yangi loyihalarda Google eski `@google/generative-ai` kutubxonasini bosqichma-bosqich yangi yagona `@google/genai` SDK-ga o'tkazishni tavsiya qiladi. Loyihani to'liq `@google/genai` ga unifikatsiya qilish lozim.

---

## 4. Fallback Arxitekturasi Tahlili

### 4.1. Kuchli Tomonlari (`lib/ai-fallback-runner.ts`)
* `isQuotaError()` funksiyasi: 429 xatosi yuz berganda behuda kutmasdan, darhol keyingi modelga o'tadi.
* Model zanjiri ketma-ketligi: Katta modeldan kichik va yengilroq modellarga qarab saralangan.

### 4.2. Zaif Tomonlari va Tavsiyalar
* **Modellar soni haddan tashqari ko'p (8-10 ta):**
  * Masalan, `analyze` marshrutida 8 ta model bor. Agar tarmoq xatosi bo'lsa, 8 ta modelning har birini 22 soniyadan sinash 2 daqiqadan oshib ketadi (Vercel baribir 60 soniyada so'rovni o'ldiradi).
  * **Optimal zanjir:** Har bir vazifa uchun 3 tadan ko'p bo'lmagan qat'iy zanjir:
    1. Birlamchi model (masalan, `gemini-3.8-flash` yoki `gemini-3.6-flash`).
    2. Tezkor arzon zaxira (`gemini-3.5-flash-lite`).
    3. Yakuniy OpenRouter zaxirasi.
