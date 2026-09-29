# 07. TAVSIYA ETILADIGAN AI ARXITEKTURASI (AI ARCHITECTURE MASTER PLAN)

Ushbu hujjat Talaba AI platformasini zamonaviy, tezkor, arzon va yuqori ishonchlilikka ega AI ekotizimiga aylantirish bo'yicha arxitektura rejasini taqdim etadi.

---

## 1. Yagona AI Boshqaruv Quvuri (AI Routing Pipeline)

```
                            FOYDALANUVCHI SO'ROVI
                                      │
                                      ▼
                           [ Telegram Auth & Rate Limit ]
                                      │
                                      ▼
                           [ Intent & Task Router ]
                                      │
         ┌──────────────┬─────────────┼──────────────┬──────────────┐
         ▼              ▼             ▼              ▼              ▼
    [ AI Chat ]    [ Vision OCR ] [ PPT/Referat ] [ Document ]   [ Voice/Live ]
    (Streaming)     (Bilet Scan)   (Structured)   (Long-Context)   (WebRTC)
         │              │             │              │              │
         ▼              ▼             ▼              ▼              ▼
    3.8-Flash      3.8-Flash     3.6-Flash      3.8-Flash      Live-Preview
         │              │             │              │              │
         └──────────────┴─────────────┼──────────────┴──────────────┘
                                      │
                                      ▼
                        [ 3 Bosqichli Zaxira (Fallback) ]
                         1. Birlamchi Model (Gemini 3.8/3.6)
                         2. Tezkor Arzon Zaxira (3.5-Flash-Lite)
                         3. OpenRouter Failsafe (DeepSeek/Gemma)
                                      │
                                      ▼
                          [ Xavfsizlik Sanitizatsiyasi ]
                         (XSS filter, KaTeX va DOMPurify)
                                      │
                                      ▼
                               FOYDALANUVCHI
```

---

## 2. Vazifalar Bo'yicha Modellar Matritsasi (Task-to-Model Matrix)

Google Gemini rasmiy 2026 imkoniyatlari asosida taqsimot:

| Vazifa (Feature) | Birlamchi Model | Zaxira Model | Chiqish formati | Nega aynan shu model? |
|---|---|---|---|---|
| **AI Chat & Mentor** | `gemini-3.8-flash` | `gemini-3.5-flash-lite` | Server-Sent Events (Streaming) | 1M kontekst, yuqori mulohaza sifati |
| **Sokratik O'qituvchi** | `gemini-3.8-flash` | `gemini-3.5-flash-lite` | Streaming | Talabani yo'naltiruvchi savollar berish qobiliyati |
| **Kod Tushuntirish** | `gemini-3.8-flash` | `gemini-3.6-flash` | Streaming (Syntax Highlight) | Dasturiy ta'minot injiniringiga ixtisoslashgan |
| **Matematika (Math)** | `gemini-3.8-flash` | `gemini-3.6-flash` | Streaming (LaTeX/KaTeX) | Qadamma-qadam formulalarni to'g'ri ishlash |
| **Bilet Scan (Vision)** | `gemini-3.8-flash` | `gemini-3.6-flash` | Matn + DOCX | Multimodal OCR, qo'lyozma va qiya rasmlarni o'qish |
| **Katta Kitob / PDF** | `gemini-3.8-flash` | `gemini-3.6-flash` | Streaming | 1M tokenlik kontekst (vektor bazasiz butun darslik sig'adi) |
| **PPT Reja Generatsiya** | `gemini-3.6-flash` | `gemini-3.5-flash-lite` | Structured JSON (`responseSchema`) | JSON sxemaga qat'iy rioya qilishi |
| **Referat Yozish** | `gemini-3.8-flash` | `gemini-3.6-flash` | Parallel Matn (DOCX) | Boblarni akademik tilda boyitish |
| **Flash Review Skripti**| `gemini-3.5-flash-lite` | `gemini-3.1-flash-lite`| Qisqa matn (200 so'z) | Juda arzon va tez (0.5 soniya) |
| **Flash Review Audio** | `gemini-2.5-flash-preview-tts` | — | WAV Audio buffer | To'g'ridan-to'g'ri audio sintez |
| **Gemini Live Ovoz** | `gemini-3.1-flash-live-preview`| `gemini-2.5-flash-native-audio-latest` | Real-time PCM WebRTC | Ikki tomonlama tabiiy audio muloqot |

---

## 3. Real Streaming Implementatsiyasi (SSE Arxitekturasi)

Hozirgi to'liq kutish o'rniga Server-Sent Events (SSE) mexanizmi joriy etiladi:

### Backend (`app/api/ai-chat/route.ts`):
```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey });
const stream = await ai.models.generateContentStream({
  model: "gemini-3.8-flash",
  contents: formattedMessages,
  config: { systemInstruction, tools: webSearch ? [{ googleSearch: {} }] : undefined }
});

const responseStream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      }
    }
    controller.close();
  }
});

return new Response(responseStream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  }
});
```

### Frontend (`app/ai-chat/page.tsx`):
* `fetch()` o'rniga `ReadableStreamDefaultReader` bilan kelgan har bir token darhol xabar matniga qo'shiladi.
* **Foydalanuvchi effekti:** Kutish vaqti 30 soniyadan **0.5 soniyaga** tushadi (birinchi so'z darhol ko'rinadi).

---

## 4. Qat'iy Strukturaviy JSON (Structured Outputs via `responseSchema`)

Hozirgi mo'rt regex parslari o'rniga Gemini SDK ning ichki `responseSchema` xususiyati qo'llaniladi.
* **Foydasi:** Model hech qachon matn yoki noto'g'ri JSON qaytarmaydi; 100% holatda to'g'ri schema kafolatlanadi.
* Quiz va PPT generatorlarida regex xatolar butunlay yo'qoladi.
