# 13. TALABA AI — MASTER DEVELOPMENT PLAN (ASOSIY RIVOJLANTIRISH VA AMALGA OSHIRISH REJASI)

> **Ushbu hujjatning maqsadi:** Ushbu Master Plan to'g'ridan-to'g'ri AI Coding Agentlariga (Antigravity, Cursor, Windsurf) yoki dasturchilar jamoasiga vazifalarni aniq, bosqichma-bosqich, fayllar kesimida topshirish va amalga oshirish uchun texnik spetsifikatsiya (Technical Blueprint) hisoblanadi.

---

## 1. CURRENT STATE vs TARGET STATE

### 1.1. Hozirgi Holat (Current State)
* **Xavfsizlik:** Zaif. Barcha API marshrutlarida Telegram ID ochiq holda klienti tomonidan yuboriladi; admin va broadcast API-lari qattiq kodlangan `OWNER_ID` tekshiruviga tayanadi; Webhook-da secret token yo'q; Supabase Service Role kaliti barcha RLS-larni chetlab o'tadi.
* **Foydalanuvchi Tajribasi (UX):** Sekin. AI Chat to'liq javob kutilguncha 30-45 soniya o'tiradi (streaming yo'q); mobil kameradan olingan katta hajmli rasmlar Bilet Scanda `413 Payload Too Large` xatosi beradi; PPT da reja kartasi bo'sh chiqadi va `alert()` brauzer modallari ochiladi.
* **Sun'iy Intellekt:** Parchalangan. Har bir marshrutda mustaqil va takroriy model zanjirlari; qat'iy JSON sxemalari o'rniga nozik regex qidiruvlari; darsliklar bilan to'g'ridan-to'g'ri uzoq kontekstli suhbat yo'q.
* **Ekotizim:** 5 ta modul bir-biridan uzilgan holda ishlaydi.

### 1.2. Kerakli Holat (Target State)
* **Xavfsizlik:** Qat'iy. Barcha kiruvchi so'rovlar Telegram `initData` orqali serverda HMAC-SHA256 bilan tasdiqlanadi; admin yo'nalishlari maxfiy bearer token bilan himoyalanadi; Webhook Telegram siri bilan o'raladi.
* **Foydalanuvchi Tajribasi (UX):** Yashin tezligida. AI Chat birinchi tokenini 0.5 soniyada uzatadi (SSE streaming); Bilet Scan rasmni mijozda 1200px ga siqib keyin yuboradi; barcha ogohlantirishlar zamonaviy toast va progress indikatorlar bilan kechadi.
* **Sun'iy Intellekt:** Yagona Model Router orqali optimallashgan. Gemini 3.8 Flash (1M kontekst) butun darsliklarni tahlil qiladi; strukturali ma'lumotlar `responseSchema` orqali 100% to'g'ri chiqadi.
* **Ekotizim:** Bilet Scan → Quiz → Socratic Mentor → Flashcards yagona o'quv zanjiriga ulanadi.

---

## 2. FAZALAR KESIMIDA TO'LIQ DEVELOPMENT ROADMAP

---

### 🔴 PHASE 0 — CRITICAL SECURITY & AUTHENTICATION FIXES

#### TASK-001: Admin va Broadcast Marshrutlarini Himoyalash (IDOR Fix)
* **Muammo:** `/api/admins/*` va `/api/broadcast/create` dagi `admin_id === 6630030492` tekshiruvini ixtiyoriy shaxs aldashi mumkin.
* **Fayllar:**
  * `app/api/admins/add/route.ts`
  * `app/api/admins/list/route.ts`
  * `app/api/admins/remove/route.ts`
  * `app/api/broadcast/create/route.ts`
  * `lib/admin.ts`
* **Amalga oshirish rejasi:**
  1. `.env.local` faylida `ADMIN_API_SECRET_KEY` o'zgaruvchisi kiritiladi.
  2. Barcha admin API-lariga sarlavha tekshiruvi qo'shiladi:
     ```typescript
     const authHeader = req.headers.get("authorization");
     const token = authHeader?.replace("Bearer ", "");
     if (token !== process.env.ADMIN_API_SECRET_KEY) {
       return NextResponse.json({ success: false, error: "UNAUTHORIZED_ADMIN" }, { status: 401 });
     }
     ```
* **Acceptance Criteria:**
  - [ ] `admin_id` yuborilgan, ammo token berilmagan so'rovlar `401 Unauthorized` qaytaradi.
  - [ ] Faqat to'g'ri sirli token bilan admin qo'shish va xabar yuborish mumkin bo'ladi.

#### TASK-002: Telegram Webhook Secret Token Tekshiruvi
* **Muammo:** `/api/telegram` so'rovi istalgan IP dan yangilanishlarni qabul qilmoqda.
* **Fayllar:** `app/api/telegram/route.ts`
* **Amalga oshirish rejasi:**
  ```typescript
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized update" }, { status: 401 });
  }
  ```
* **Acceptance Criteria:**
  - [ ] `x-telegram-bot-api-secret-token` sarlavhasisiz kelgan yangilanishlar 401 bilan rad etiladi.

#### TASK-003: Server-side Telegram `initData` HMAC Tekshiruvi
* **Muammo:** Barcha API Route-lar `telegram_user_id` ni klienti yuborgan JSON dan olib, birovning hisobidan foydalanishga yo'l qo'ymoqda.
* **Fayllar:**
  * `lib/quiz/security.ts` (`validateTelegramWebAppData` funksiyasi)
  * `app/api/analyze/route.ts`
  * `app/api/ai-chat/route.ts`
  * `app/api/generate-ppt/route.ts`
  * `app/api/write-referat/route.ts`
  * `app/api/user-stats/route.ts`
* **Amalga oshirish rejasi:**
  1. `lib/auth-server.ts` yaratiladi:
     ```typescript
     import { validateTelegramWebAppData } from "@/lib/quiz/security";
     export async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; telegramId?: number }> {
       const initData = req.headers.get("x-telegram-init-data") || "";
       const validation = validateTelegramWebAppData(initData);
       if (validation.valid && validation.user?.id) {
         return { authenticated: true, telegramId: Number(validation.user.id) };
       }
       return { authenticated: false };
     }
     ```
  2. Barcha marshrutlarda `body.telegram_user_id` o'rniga server tasdiqlagan `telegramId` olinadi.
* **Acceptance Criteria:**
  - [ ] Soxta `telegram_user_id` bilan yuborilgan so'rovlar qabul qilinmaydi.
  - [ ] Telegram WebApp ichida ochilgan qonuniy so'rovlar avtomatik tasdiqlanadi.

---

### 🟠 PHASE 1 — RELIABILITY & STABILITY

#### TASK-101: Bilet Scan Mijozida Rasmni Siqish (Canvas Compressor)
* **Muammo:** 10MB lik kamera rasmlari Next.js serverless limitiga uriladi.
* **Fayllar:** `app/scan/page.tsx`
* **Amalga oshirish rejasi:**
  1. Rasmni o'qish paytida HTML Canvas yaratiladi.
  2. Agar eni yoki bo'yi 1200px dan oshsa, nisbati saqlangan holda kichraytiriladi.
  3. `canvas.toDataURL("image/jpeg", 0.8)` orqali sifatli, lekin 200-400KB hajmga keltirilib base64 olinadi.
* **Acceptance Criteria:**
  - [ ] 15MB li fayl yuklanganda ham tarmoq orqali 500KB dan kam yuk ketadi.
  - [ ] Serverda `413 Payload Too Large` xatosi butunlay yo'qoladi.

#### TASK-102: PPT Reja (`outline`) Qaytishi va Slayd Turlarini To'g'rilash
* **Muammo:** `/api/generate-ppt` reja qaytarmaydi; `comparison` va `horizontal-steps` render qilinmaydi.
* **Fayllar:**
  * `app/api/generate-ppt/route.ts`
  * `app/talaba-tools/ppt/page.tsx`
* **Amalga oshirish rejasi:**
  1. `app/api/generate-ppt/route.ts` yakunida qaytariladi:
     ```typescript
     return NextResponse.json({ success: true, downloadUrl, outline });
     ```
  2. `route.ts` da `item.layoutType === "comparison"` bloki qo'shilib, slayd ikkita yonma-yon karta (`roundRect`) va ikkita sarlavha bilan chiziladi.
  3. `item.layoutType === "horizontal-steps"` bloki qo'shilib, 3-4 ta gorizontal qadamli chiziq va doiralar chiziladi.
* **Acceptance Criteria:**
  - [ ] Slayd generatsiyasidan so'ng ekranda "AI Reja" kartasi to'liq ma'lumotlar bilan ko'rinadi.
  - [ ] Slaydlarda comparison va horizontal-steps tushganda generic fallback-ga o'tib ketmaydi.

#### TASK-103: Polling Xotira Isrofini Yo'qotish (`UsageStatsWidget`)
* **Muammo:** Har 1 soniyada `setInterval` ishlashi.
* **Fayllar:** `components/UsageStatsWidget.tsx`
* **Amalga oshirish rejasi:**
  * `setInterval` o'chiriladi. Uning o'rniga har bir AI chaqiruv muvaffaqiyatli tugagan joyda:
    ```typescript
    window.dispatchEvent(new CustomEvent("refetch-stats"));
    ```
    chaqiriladi. Vidjet faqatgina o'sha event kelganda yoki sahifa fokuslangandagina qayta so'rov yuboradi.
* **Acceptance Criteria:**
  - [ ] Brauzer backgroundida bo'lganda ortiqcha so'rovlar va CPU bandligi 0 ga tushadi.

---

### 🟡 PHASE 2 — AI CHAT STREAMING & STUDY MENTOR

#### TASK-201: AI Chat Server-Sent Events (SSE) Streaming
* **Muammo:** Talaba xabarni yuborib, 30 soniya oq ekranga qarab turadi.
* **Fayllar:**
  * `app/api/ai-chat/route.ts`
  * `app/ai-chat/page.tsx`
* **Amalga oshirish rejasi:**
  1. Backend `@google/genai` dagi `generateContentStream` ga o'tkaziladi va chunklar `data: {"text": "..."}\n\n` formatida oqim qilinadi.
  2. Frontend `fetch` response'ni `ReadableStreamDefaultReader` orqali qabul qilib, xabar oxiriga real vaqtda harflarni qo'shib boradi.
* **Acceptance Criteria:**
  - [ ] Talaba "Yuborish" tugmasini bosgach, birinchi so'z 1 soniya ichida paydo bo'ladi.
  - [ ] Oqim davomida kursor miltillovchi animatsiyada bo'ladi.

#### TASK-202: Matematik Formulalar uchun KaTeX Integratsiyasi
* **Muammo:** `\frac{-b \pm \sqrt{D}}{2a}` kabi formulalar xunuk matn bo'lib turadi.
* **Fayllar:** `app/ai-chat/page.tsx`, `package.json` (`katex`)
* **Amalga oshirish rejasi:**
  1. `katex` kutubxonasi o'rnatiladi.
  2. `FormattedMessageText` komponentida `$$...$$` va `$...$` regex orqali topilib, `katex.renderToString` orqali chiroyli matematik ko'rinishda chiziladi.
* **Acceptance Criteria:**
  - [ ] Matematika, fizika va kimyo formulalari kitobdagidek toza vizual formulalarga aylanadi.

---

### 🟢 PHASE 3 — MODULLARARO INTEGRATSIYA (CROSS-MODULE ECOSYSTEM)

#### TASK-301: Bilet Scan → Quiz Integratsiyasi
* **Fayllar:** `app/scan/page.tsx`, `app/quiz/page.tsx`
* **Implementatsiya:**
  1. Scan natijasi ekranda paydo bo'lgach, "📥 DOCX" va "📨 Telegram" tugmalari yoniga yangi yorqin tugma qo'shiladi:
     `[🎯 Ushbu savollardan Test topshirish]`
  2. Tugma bosilganda olingan savollar matni `sessionStorage.setItem("quiz_seed_text", extractedText)` ga saqlanadi va foydalanuvchi avtomatik `/quiz?autoParse=true` ga yo'naltiriladi.
  3. Quiz sahifasi yuklanganda matnni avtomatik parslaydi va talabaga 10 savolli imtihon simulyatsiyasini boshlaydi.
* **Acceptance Criteria:**
  - [ ] Biletni rasmga olgan talaba bitta tugma bilan o'sha bilet bo'yicha interaktiv test topshira oladi.

#### TASK-302: Quiz Xatolari → Sokratik AI Murabbiy
* **Fayllar:** `app/quiz/page.tsx`, `app/ai-chat/page.tsx`
* **Implementatsiya:**
  1. Quiz yakunlangan sahifada har bir noto'g'ri javob ostida tugma paydo bo'ladi:
     `[🎓 AI Murabbiy bilan tushunib olish]`
  2. Bosilganda AI Chat ochilib, tizim quyidagi ko'rsatma bilan suhbatni boshlaydi:
     *"Men ushbu test savolida xato qildim: [Savol matni]. To'g'ri javob [Javob]. Menga buni Sokratik usulda, savollar berib tushuntirib bering."*
* **Acceptance Criteria:**
  - [ ] Talaba xatolarini shunchaki ko'rib ketmasdan, mentor yordamida o'zlashtiradi.

---

### 🔵 PHASE 4 — TO'LOV VA AVTOMATIK BILLING (CLICK & PAYME)

#### TASK-401: Click va Payme Webhooklarini Amalga Oshirish
* **Fayllar:**
  * `app/api/payments/click/prepare/route.ts`
  * `app/api/payments/click/complete/route.ts`
  * `app/api/payments/payme/route.ts`
  * `lib/payment.ts`
* **Implementatsiya:**
  1. Click va Payme protokollarining standart `Prepare` va `Complete` tranzaksiya holatlari yoziladi.
  2. To'lov muvaffaqiyatli o'tgan zahoti Supabase `payments` jadvaliga `PAID` yoziladi va `givePremium(telegramId, plan)` funksiyasi avtomatik ishga tushadi.
  3. Foydalanuvchiga Telegram bot orqali tabriknoma yuboriladi.
* **Acceptance Criteria:**
  - [ ] Talaba Click orqali to'lov qilganda admin tasdig'isiz, 1 soniyada Premium faollashadi.
  - [ ] Qo'lda chek yuklash ikkinchi darajali zaxira variant sifatida qoladi.

---

## 3. DEPENDENCY GRAPH (Vazifalar Ketma-ketligi)

```
TASK-001 (Admin Token) ───┐
TASK-002 (Webhook Secret)─┼──> TASK-003 (Telegram HMAC Auth) ──> TASK-401 (Auto Payments)
TASK-004 (Upload Limits) ─┘
                                       │
TASK-101 (Image Compress) ─────────────┼──> TASK-301 (Bilet to Quiz)
TASK-102 (PPT Outline Fix) ────────────┤
TASK-103 (PPT Layouts) ────────────────┤
TASK-104 (Widget Interval Fix) ────────┤
                                       │
TASK-201 (Chat SSE Streaming) ─────────┴──> TASK-202 (KaTeX) & TASK-203 (Syntax Highlighting)
                                                       │
                                                       ▼
                                            TASK-302 (Quiz Mistakes to Mentor)
```

---

## 4. NOW / NEXT / FUTURE STRATEGIYASI

### 🟢 NOW (Hozir — 1-2 hafta ichida):
* Barcha xavfsizlik teshiklarini yopish (Admin IDOR, Webhook Secret, HMAC Auth).
* Bilet Scanga Canvas image compression ulash.
* PPT outline qaytishini va 2 ta yetishmayotgan slayd turini tuzatish.
* UsageStatsWidget polling xatosini bartaraf etish.

### 🟡 NEXT (Keyin — 1 oy ichida):
* AI Chat Server-Sent Events (SSE) streaming va KaTeX formula ko'rinishiga o'tish.
* Bilet Scan → Quiz va Quiz xatolari → AI Chat integratsiyalarini ishga tushirish.
* Click va Payme avtomatik to'lov shlyuzlarini joriy etish.
* Katta darsliklar (PDF) bilan to'g'ridan-to'g'ri suhbat (1M context PDF Chat).

### 🔵 FUTURE (Uzoq muddatli — 2-3 oy ichida):
* Spaced Repetition (oraliqli takrorlash) algoritmi bilan Flashcards moduli.
* OTM talabalari uchun Grant va Stipendiya motivatsion xati generatori.
* Telegram Voice orqali og'zaki imtihon simulyatsiyasi (Gemini Live to'liq integratsiyasi).
* Akademik maqolalar uchun plagiatga qarshi chuqur tekshiruv.
