# 01. REPOSITORY TO'LIQ INVENTARI VA ARXITEKTURA XARITASI

## 1. Loyiha haqida umumiy ma'lumot
* **Loyiha nomi:** TALABA AI
* **Tavsif:** Oliy ta'lim talabalari uchun mo'ljallangan sun'iy intellektga asoslangan ko'p funksiyali yordamchi platforma (AI Student Assistant & Telegram Mini App).
* **Asosiy texnologik stek:**
  * **Framework:** Next.js 16.2.6 (App Router, Turbopack/Webpack)
  * **UI & Reaktivlik:** React 19.2.4, React DOM 19.2.4, Tailwind CSS 4
  * **Til:** TypeScript 5 (Strict Mode yoqilgan, `skipLibCheck: true`)
  * **Database & BaaS:** Supabase PostgreSQL (`@supabase/supabase-js: ^2.108.2`)
  * **Telegram integratsiyasi:** Telegraf.js 4.16.3, Telegram WebApp API
  * **AI SDK-lar:** `@google/genai: ^2.6.0`, `@google/generative-ai: ^0.24.1`, `openai: ^6.39.0` (OpenRouter zaxirasi uchun)
  * **Fayl & Hujjat vositalari:** `docx: ^9.7.1`, `pptxgenjs: ^4.0.1`, `pdf-lib: ^1.17.1`, `pdf-parse: ^2.4.5`, `pdf2json: ^4.0.3`, `mammoth: ^1.12.0`, `xlsx: ^0.18.5`, `tesseract.js: ^7.0.0`, `cloudconvert: ^3.0.0`, `libreoffice-convert: ^1.8.1`
  * **Deploy platformasi:** Vercel Serverless (Node.js runtime, maxDuration: 60s)

---

## 2. Kataloglar tuzilmasi (Folder Structure)

```
c:/Users/User/Desktop/projects/talaba-ai/
├── app/                             # Next.js App Router (Sahifalar va API Endpointlar)
│   ├── ai-chat/                     # AI Chat va Study Mentor foydalanuvchi interfeysi
│   ├── api/                         # 33 ta asosiy va ichki API Route-lar
│   ├── file-tools/                  # Hujjat konvertatsiyalari (PDF, Word, PPTX)
│   ├── payments/                    # To'lov qilish va chek yuklash interfeysi
│   ├── premium/                     # Tariflar, obunalar va limitlar taqdimoti
│   ├── quiz/                        # Quiz va Test yaratish / yechish interfeysi
│   ├── scan/                        # Bilet Scan (OCR + AI Vision yordamchisi)
│   ├── talaba-tools/                # Talaba Yordamchi vositalari (GPA, PPT, Referat, Tarjima)
│   ├── layout.tsx                   # Asosiy Root Layout (Telegram WebApp script ineksiya)
│   └── page.tsx                     # Asosiy Bosh sahifa (Home Dashboard)
├── components/                      # Qayta ishlatiluvchi UI komponentlar
│   ├── UsageStatsWidget.tsx         # Foydalanuvchining kunlik limit hisoblagich vidjeti
│   └── ai-chat/                     # Chat komponentlari
├── lib/                             # Biznes mantiq, utilitlar, AI va ma'lumotlar bazasi integratsiyalari
│   ├── admin-management.ts          # Adminlar ierarxiyasi va audit log funksiyalari
│   ├── admin.ts                     # Admin huquqlari, ban tekshiruvi, premium berish
│   ├── ai-fallback-runner.ts        # Gemini ko'p bosqichli model fallback mexanizmi
│   ├── audit-log.ts                 # Xavfsizlik va amallar jurnali
│   ├── bot.ts                       # Telegraf bot instansiyasi va slash buyruqlar registratori
│   ├── broadcast.ts                 # Ommaviy xabarnomalar yuborish mexanizmi
│   ├── cloudconvert.ts              # CloudConvert SaaS API mijozi (fallback konvertor)
│   ├── limit-checker.ts             # Kunlik foydalanish limitlari va ban filtri
│   ├── limits.ts                    # Tarif rejalari (PlanLimits) konstantalari
│   ├── live-session-tracker.ts      # Gemini Live jonli ovozli sessiyalar monitoringi
│   ├── payment.ts                   # To'lovlar, cheklar va tranzaksiyalar servis qatlami
│   ├── permissions.ts               # Ruxsatlarni tekshirish sinflari (PermissionError)
│   ├── rate-limiter.ts              # Xotiraga asoslangan IP/User Rate Limiter
│   ├── settings.ts                  # Tizim konfiguratsiyalari (karta raqamlari, bot holati)
│   ├── storage.ts                   # Foydalanuvchi profillari va foydalanish statistikasi (DB CRUD)
│   ├── supabase.ts                  # Supabase Service Role client singleton
│   ├── support.ts                   # Foydalanuvchilar murojaatlari (Support Ticket tizimi)
│   ├── user-management.ts           # Foydalanuvchilarni qidirish, filtrlash va bloklash
│   ├── user.ts                      # Foydalanuvchi ma'lumot turlari (User, UsageStats, PlanType)
│   ├── quiz/                        # Quiz dvigateli (18 ta fayl: parserlar, gamifikatsiya, flow)
│   ├── tarjima-pro/                 # Tarjima qoidalari va akademik lug'atlar
│   └── hujjat-tozalash/             # Hujjat formatini tekshirish qoidalari
├── public/                          # Statik media va rasmlar
├── scripts/                         # Diagnostika, AI modellarni sinovdan o'tkazish skriptlari
├── supabase/
│   └── migrations/                  # 16 ta SQL migratsiya fayllari
├── .env.local                       # Muhit o'zgaruvchilari (API kalitlar, DB sirlari)
├── package.json                     # Bog'liqliklar va versiyalar
├── tsconfig.json                    # TypeScript kompilyator qoidalari
└── next.config.ts                   # Next.js tizim konfiguratsiyasi
```

---

## 3. To'liq API Yo'nalishlari Inventari (API Route Inventory)

Jami **33 ta API Route moduli** mavjud bo'lib, ular quyidagi kategoriyalarga bo'linadi:

### 3.1. Bilet Scan & Tahlil
* `POST /api/analyze` — Bilet rasmini qabul qilish, Gemini Vision orqali savollarni aniqlash va javoblarni shakllantirish (`app/api/analyze/route.ts`).

### 3.2. Fayl Konvertatsiyalari (File Tools)
* `POST /api/convert-word-to-pdf` — Word (`.docx`) hujjatini PDF ga o'girish (LibreOffice / CloudConvert) (`app/api/convert-word-to-pdf/route.ts`).
* `POST /api/convert-pptx-to-pdf` — Taqdimot (`.pptx`) faylini PDF ga o'girish (`app/api/convert-pptx-to-pdf/route.ts`).
* `POST /api/convert-pdf-to-word` — PDF faylini DOCX ga o'girish (pdftoppm + Gemini OCR matn ajratish) (`app/api/convert-pdf-to-word/route.ts`).
* `POST /api/merge-pdf` — Bir nechta PDF fayllarni bitta hujjatga birlashtirish (in-memory `pdf-lib`) (`app/api/merge-pdf/route.ts`).
* `POST /api/split-pdf` — PDF fayldan sahifalarni ajratib olish (`pdf-lib`) (`app/api/split-pdf/route.ts`).
* `POST /api/compress-pdf` — PDF hajmini siqish (Ghostscript / CloudConvert) (`app/api/compress-pdf/route.ts`).

### 3.3. Talaba Yordamchi Vositalari (Talaba Tools)
* `POST /api/generate-ppt` — Gemini orqali slayd rejasini tuzish, Pexels orqali rasm yuklash va `pptxgenjs` yordamida prezentatsiya generatsiya qilish (`app/api/generate-ppt/route.ts`).
* `POST /api/send-ppt-telegram` — Tayyor bo'lgan PPTX faylini Telegram bot orqali foydalanuvchiga jo'natish (`app/api/send-ppt-telegram/route.ts`).
* `POST /api/write-referat` — Ko'p bobli akademik referatni Gemini orqali parallel generatsiya qilish va DOCX shakllantirish (`app/api/write-referat/route.ts`).
* `POST /api/referat-outline` — Referat mavzusi bo'yicha mundarija (boblar) tuzish (`app/api/referat-outline/route.ts`).
* `POST /api/referat-study-pack` — Referat asosida qo'shimcha o'quv to'plami (quiz, konspekt) yaratish (`app/api/referat-study-pack/route.ts`).
* `POST /api/send-referat-telegram` — Referat hujjatini Telegram orqali yuborish (`app/api/send-referat-telegram/route.ts`).
* `POST /api/format-referat` — Foydalanuvchi yuklagan DOCX faylini OTM standartlariga moslab qayta formatlash (`app/api/format-referat/route.ts`).
* `POST /api/hujjat-tozalash` — Matndagi imlo va stilistik xatolarni tahlil qilish va tozalash (`app/api/hujjat-tozalash/route.ts`).
* `POST /api/tarjima-pro` — Matn, DOCX yoki PDF hujjatlarini akademik uslubda professional tarjima qilish (`app/api/tarjima-pro/route.ts`).
* `POST /api/send-gpa` — GPA hisob-kitob natijasini foydalanuvchining Telegram chatiga yuborish (`app/api/send-gpa/route.ts`).
* `POST /api/export-word` — Ixtiyoriy matnli ma'lumotni rasmiy Word hujjati formatida yuklab berish (`app/api/export-word/route.ts`).

### 3.4. Quiz & Ta'lim Tizimi (Quiz Engine)
* `POST /api/quiz/parse` — Yuklangan fayl yoki matnni Rule-based va AI gibrid parseri orqali test savollariga aylantirish (`app/api/quiz/parse/route.ts`).
* `POST /api/quiz/build` — Parserlangan savollardan to'liq quiz to'plamini yig'ish (`app/api/quiz/build/route.ts`).
* `POST /api/quiz/explain` — Noto'g'ri belgilangan savol uchun sun'iy intellekt tushuntirishini olish (`app/api/quiz/explain/route.ts`).
* `GET/POST /api/quiz/history` — Foydalanuvchining quizlar tarixi va urinishlarini boshqarish (`app/api/quiz/history/route.ts`).
* `GET/POST /api/quiz/session` — Faol test sessiyasini boshqarish (`app/api/quiz/session/route.ts`).
* `GET/POST /api/quiz/gamification` — XP, streak, nishonlar (achievements) va peshqadamlar jadvali statistikasi (`app/api/quiz/gamification/route.ts`).
* `POST /api/quiz/send-telegram` — Yaratilgan testlarni Telegram guruh yoki kanaliga so'rovnoma (poll) shaklida ommaviy yuborish (`app/api/quiz/send-telegram/route.ts`).

### 3.5. AI Chat & Jonli Ovoz (Study Mentor)
* `POST /api/ai-chat` — 7 xil personaga ega AI Study Mentor chat API (Google Search grounding, rasm va PDF qo'llab-quvvatlaydi) (`app/api/ai-chat/route.ts`).
* `POST /api/ai-chat/flash-review` — 40-60 soniyalik qisqa ovozli konspekt va WAV audio sintezi (`app/api/ai-chat/flash-review/route.ts`).
* `POST /api/ai-chat/live-token` — Gemini Live WebRTC/WebSocket audio aloqasi uchun bir martalik efemer token yaratish (`app/api/ai-chat/live-token/route.ts`).
* `POST /api/ai-chat/live-session` — Jonli ovozli suhbat davomiyligini sekundma-sekund kuzatish va limitni chegirish (`app/api/ai-chat/live-session/route.ts`).
* `POST /api/ai-chat/check-material` — "Meni Tekshir" rejimi: fan va mavzu bo'yicha savol tuzish va talaba javobini baholash (`app/api/ai-chat/check-material/route.ts`).

### 3.6. Foydalanuvchi & Obuna Tizimi
* `POST /api/sync-user` — Telegram WebApp dan kirgan foydalanuvchini bazaga yozish yoki yangilash (`app/api/sync-user/route.ts`).
* `GET /api/user-stats` — Foydalanuvchining kunlik qolgan limitlarini real vaqtda qaytarish (`app/api/user-stats/route.ts`).
* `POST /api/payments/upload-proof` — To'lov cheki skrinshotini qabul qilish, Supabase Storage-ga saqlash va adminga bildirishnoma yuborish (`app/api/payments/upload-proof/route.ts`).
* `POST /api/payments/create` — Yangi to'lov yozuvini yaratish (`app/api/payments/create/route.ts`).
* `GET /api/payments/history` — To'lovlar tarixini ko'rish (`app/api/payments/history/route.ts`).

### 3.7. Telegram Bot, Boshqaruv & Admin Paneli
* `POST /api/telegram` — Telegram Webhook markaziy qabul qiluvchisi (2962 satr bot mantiq) (`app/api/telegram/route.ts`).
* `GET /api/cron` — Kundalik statistikalarni yangilash va eskirgan ma'lumotlarni tozalash cron vazifasi (`app/api/cron/route.ts`).
* `POST /api/broadcast/create` — Barcha foydalanuvchilarga yoki tanlangan guruhlarga ommaviy xabar yuborish (`app/api/broadcast/create/route.ts`).
* `GET /api/admins/list`, `POST /api/admins/add`, `POST /api/admins/remove` — Adminlar tarkibini boshqarish API-lari.
* `GET/POST /api/settings` — Tizim sozlamalarini (karta raqamlari, bot xabarlari) o'zgartirish.
* `GET /api/audit` — Xavfsizlik audit loglarini o'qish.

---

## 4. Subtizimlararo Bog'liqliklar Xaritasi (Dependency Graph)

```
                            [ TELEGRAM CLIENT / WEBAPP ]
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
         Telegram Bot Webhook                       Next.js Frontend UI
      (/api/telegram - 2962 lines)              (Home, Scan, Quiz, Chat, Tools)
                  │                                         │
                  │                                         ▼
                  │                              Next.js API Route Endpoints
                  │                              (Rate-limiter & GuardCheck)
                  │                                         │
                  ├────────────────────┬────────────────────┤
                  ▼                    ▼                    ▼
          [ lib/storage.ts ]   [ lib/limits.ts ]   [ lib/ai-fallback-runner.ts ]
                  │                    │                    │
                  ▼                    ▼                    ▼
         Supabase PostgreSQL    Usage Tracking        Google Gemini API
         (Users, Stats, Pay)    (Daily Resets)     (3.8-Flash, 3.6-Flash, Live)
                  │                                         │
                  ▼                                         ▼
         Supabase Storage S3                       OpenRouter Fallback
         (Payment Proofs Bucket)                   (DeepSeek, Gemma, GPT-OSS)
```
