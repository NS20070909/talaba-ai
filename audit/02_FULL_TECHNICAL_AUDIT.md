# 02. LOYIHASONING TO'LIQ TEXNIK AUDITI (FULL TECHNICAL AUDIT)

Ushbu hujjat Talaba AI loyihasining arxitekturasi, Next.js serverless muhiti, kutubxonalar va har bir texnik qatlam bo'yicha mustaqil tekshiruv natijalarini jamlaydi.

---

## 1. Next.js & Serverless Arxitektura Baholanishi

### 1.1. Serverless Runtime & Timeout Cheklovlari
* **Holat:** Barcha API Route-lar Vercel Serverless Function (Node.js runtime) muhitida ishlaydi.
* **maxDuration konfiguratsiyasi:**
  * Ko'plab og'ir marshrutlarda `export const maxDuration = 60;` ko'rsatilgan (masalan, `/api/generate-ppt/route.ts`, `/api/analyze/route.ts`, `/api/write-referat/route.ts`).
  * **Xavf:** Vercel Hobby tarifida maksimal ruxsat etilgan davomiylik 10-15 soniya, Pro tarifida esa 60 soniyadir.
  * Agar taqdimot yaratishda 15 ta slayd uchun Pexels API orqali rasmlar parallel tortilsa va AI sekin javob bersa, umumiy so'rov vaqti 55-65 soniyaga yetib, serverless timeout xatosi (`FUNCTION_INVOCATION_TIMEOUT`) kelib chiqadi.
* **Xotira va Vaqtinchalik Fayllar (`os.tmpdir()`):**
  * `convert-word-to-pdf`, `convert-pptx-to-pdf`, `compress-pdf` yo'nalishlarida fayllar serverless konteynerining `/tmp/` katalogiga yoziladi.
  * `try...finally` bloklarida `fs.unlinkSync` va `fs.rm` orqali tozalash amalga oshirilgan (yaxshi amaliyot).
  * Ammo bir nechta yirik fayllar bir vaqtda konvertatsiya qilinganda, Vercel lambda xotirasi (default 1024MB) to'lib ketish xavfi mavjud.

---

## 2. Frontend Arxitekturasi va Holat Boshqaruvi (State Management)

### 2.1. `"use client"` Monolit Komponentlari
* **Muammo:** Barcha asosiy sahifalar to'liq `"use client"` direktivasi bilan bitta ulkan fayl sifatida yozilgan:
  * `app/talaba-tools/write-referat/page.tsx` — **91,370 bayt** (2,000 dan ortiq satr).
  * `app/ai-chat/page.tsx` — **77,650 bayt** (1,809 satr).
  * `app/quiz/page.tsx` — **41,673 bayt**.
  * `app/talaba-tools/ppt/page.tsx` — **13,804 bayt**.
* **Texnik oqibatlar:**
  * Komponentlar sub-komponentlarga ajratilmagani sababli React virtual DOM har bir harf kiritilganda butun ulkan daraxtni qayta render qiladi.
  * Client bundle hajmi asossiz kattalashgan, bu esa mobil internetda ochilish tezligini pasaytiradi.
  * Global state management (Zustand, Redux yoki Context API) yo'q; barcha ma'lumotlar 30-40 ta mustaqil `useState` orqali boshqariladi.

### 2.2. Polling va Xotira Isrofi (Memory Leak Risk)
* `components/UsageStatsWidget.tsx` (L69):
  ```typescript
  const interval = setInterval(checkDirtyAndRefresh, 1000);
  ```
  * Har bir soniyada `localStorage.getItem("user_stats_dirty")` tekshiriladi.
  * Mobil brauzerda bu protsessorni doimiy band qilib, telefon batareyasini tez tugatadi.
  * **Tavsiya:** Polling o'rniga Window `CustomEvent("refetch-stats")` yoki holat o'zgargandagina xabar beruvchi reaktiv trigger ishlatilishi shart.

---

## 3. Fayl va Hujjatlarni Qayta Ishlash Quvuri (File Processing Pipeline)

### 3.1. LibreOffice vs CloudConvert Dualligi
* `lib/cloudconvert.ts` va `app/api/convert-word-to-pdf/route.ts`:
  * Tizim serverda `/usr/bin/soffice` bormi-yo'qligini tekshiradi (`fs.existsSync`).
  * Vercel muhitida LibreOffice bo'lmaydi, shuning uchun tizim avtomatik ravishda CloudConvert SaaS xizmatiga o'tadi.
  * **Zaiflik:** CloudConvert bepul tarifida kuniga faqat 25 ta konvertatsiya krediti beriladi. Agar 26-foydalanuvchi fayl yuklasa, API 503 xatosi qaytaradi va foydalanuvchiga xizmat ko'rsatib bo'lmaydi.

### 3.2. PDF to Word — Format va Rasm Yo'qolishi
* `app/api/convert-pdf-to-word/route.ts`:
  * Ushbu modul PDF-ni asl DOCX formatiga o'girmaydi.
  * U PDF-dan faqat matnni ajratib oladi (yoki Gemini OCR orqali matnni o'qiydi) va uni `docx` kutubxonasi yordamida standart paragraflar ko'rinishida bo'sh DOCX hujjatiga yozadi.
  * **Natija:** Barcha jadvallar, diagrammalar, ranglar, shriftlar va asl sahifa dizayni yo'qoladi. Talaba kutayotgan vizual Word hujjati o'rniga oddiy qora matnli fayl hosil bo'ladi.

### 3.3. PPTX Generatsiyasi (PptxGenJS)
* `app/api/generate-ppt/route.ts`:
  * Har bir slayd koordinatalari qo'lda hisoblangan (in-line coordinates: `x, y, w, h`).
  * 10 ta slayd turi e'lon qilingan bo'lsa-da, faqat `hero-cover`, `image-left`, `image-right`, `premium-content` qismlari to'liq chiziladi.
  * `comparison` va `horizontal-steps` turlari kiritilmagan.
  * API yakunida tayyor faylni base64 data-URL sifatida qaytaradi (Vercel lambda xotirasidan 5-10MB string o'tadi).

---

## 4. Tashqi Xizmatlar va API Integratsiyalari

| Xizmat | Ishlatilish sohasi | Xavf darajasi | Bog'liqlik turi |
|---|---|---|---|
| **Google Gemini API** | Chat, Bilet Scan, Referat, PPT, Quiz | 🔴 KRITIK | Barcha asosiy funksiyalar to'xtaydi |
| **OpenRouter** | Gemini ishlamaganda zaxira model | 🟠 YUQORI | Zaxira ishlamasa 500 qaytadi |
| **Pexels API** | Slaydlar va referat uchun stock rasmlar | 🟡 O'RTA | Rasm bo'lmasa rangli fon ishlatiladi |
| **Telegram Bot API** | Xabarlar, fayllar, poll yuborish, admin | 🔴 KRITIK | Foydalanuvchi faylini ololmaydi |
| **CloudConvert API** | DOCX/PPTX konvertatsiyasi | 🟠 YUQORI | Bepul limit 25 konvertatsiya/kun |
| **Supabase (Postgres & S3)** | Foydalanuvchilar, to'lovlar, statistika | 🔴 KRITIK | Butun autentifikatsiya va cheklovlar |

---

## 5. TypeScript Kompilyatsiya va ESLint Natijalari

1. **TypeScript (`npx tsc --noEmit`):**
   * **Natija:** `Exit code: 0`.
   * Kompilyatsiya xatosi yo'q. Loyiha qat'iy TypeScript interfeyslariga ega bo'lsa-da, juda ko'p joyda `any` tipi ishlatilgan.
2. **ESLint (`npm run lint`):**
   * **Natija:** `430 ta muammo (369 ta xato, 61 ta ogohlantirish)`.
   * Asosiy xatolar: `@typescript-eslint/no-explicit-any` (320+ ta holatda), `@typescript-eslint/no-unused-vars` (o'lik o'zgaruvchilar), va ba'zi joylarda CommonJS `require()` sintaksisi.
