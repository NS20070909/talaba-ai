# 11. SINOV VA SIFAT KAFOLATI (TESTING & QUALITY ASSURANCE)

Ushbu hujjat loyihaning mavjud sinov infratuzilmasi, audit vaqtida o'tkazilgan tekshiruvlar natijalari va zaruriy test strategiyasini o'z ichiga oladi.

---

## 1. O'tkazilgan Avtomatlashtirilgan Sinovlar Natijalari

### 1.1. TypeScript Tip Tekshiruvi (`npx tsc --noEmit`)
* **Buyruq:** `npx tsc --noEmit`
* **Natija:** `Exit Code: 0` (Muvaffaqiyatli).
* **Xulosa:** Barcha TypeScript fayllari kompilyatsiya qoidalariga mos. Loyihada sintaktik yoki halokatli tip xatoliklari mavjud emas.

### 1.2. Statik Kod Analizi (`npm run lint` - ESLint)
* **Buyruq:** `npm run lint`
* **Natija:** `Exit Code: 1` — **430 ta muammo (369 ta xato, 61 ta ogohlantirish)**.
* **Xatoliklar profili:**
  * 320 dan ortiq holatda `@typescript-eslint/no-explicit-any` (aniq tiplar o'rniga `any` ishlatilgan).
  * 60 ga yaqin foydalanilmagan o'zgaruvchi va importlar (`@typescript-eslint/no-unused-vars`).
  * `lib/quiz/upload-manager.ts` (L130) da CommonJS uslubidagi `require()` taqiqlangan sintaksisi.

---

## 2. Loyihadagi Mavjud Sinov Skriptlari (`scripts/`)

Ishlab chiquvchilar tomonidan `scripts/` katalogida quyidagi mustaqil sinov skriptlari tayyorlangan:
* `scripts/auditGeminiModels.ts` — Gemini API orqali mavjud barcha modellar ro'yxatini olib, ularning ishlashini tekshiruvchi skript.
* `scripts/test-grounding.ts` — Google Search grounding (internet qidiruv) mexanizmini tekshirish.
* `scripts/test-stage2.ts` — Flash Review ovoz sintezi (TTS) va Code/Math rejimlarini sinash.
* `scripts/test-stage3.ts` — Gemini Live WebRTC token generatsiyasini sinash.

---

## 3. Yetishmayotgan Sinov Tizimlari (Missing Coverage)

Loyihada professional tijoriy dastur darajasidagi quyidagi testlar umuman mavjud emas:
1. **Unit Testlar (Birlik sinovlari):**
   * `Vitest` yoki `Jest` o'rnatilmagan.
   * `limit-checker.ts`, `limits.ts`, `permissions.ts` va `hybrid-parser.ts` kabi murakkab biznes-mantiq birlik testlari bilan qoplanmagan.
2. **API Integratsiya Testlari:**
   * Soxta (mock) ma'lumotlar bilan API marshrutlarini avtomatlashtirilgan tekshirish yo'q.
3. **E2E (End-to-End) Sinovlar:**
   * Playwright yoki Cypress yo'q. Telegram WebApp ichidagi to'liq foydalanuvchi yo'li avtomatlashtirilmagan.

---

## 4. Regressiyaga Qarshi Majburiy Nazorat Ro'yxati (Regression Checklist)

Har bir yangi reliz chiqarilishidan oldin qo'lda yoki avtomat ravishda quyidagi stsenariylar tekshirilishi shart:

- [ ] **Bilet Scan:** Rasmni yuklash → javob chiqishi → DOCX yuklab olish → Telegramga jo'natish.
- [ ] **AI Chat:** Xabar yuborish → javob oqimi (streaming) → rasm/PDF biriktirish → internet qidiruv natijasi.
- [ ] **AI PPT:** Mavzu kiritish → slayd generatsiyasi → PPTX yuklab olish → Telegramga yuborish.
- [ ] **Quiz:** TXT/DOCX fayl yuklash → savollar to'g'ri parslanishi → test yechish → natija va XP hisoblanishi.
- [ ] **Limitlar:** Kunlik 2 ta bepul limit tugagach, 3-urinishda to'g'ri bloklanishi va ertasi kuni 0 ga reset bo'lishi.
- [ ] **To'lovlar:** Chek yuklash → admin botida tasdiqlash → foydalanuvchiga Premium muddati to'g'ri qo'shilishi.
