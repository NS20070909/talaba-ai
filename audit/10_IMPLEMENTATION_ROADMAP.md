# 10. BOSQICHMA-BOSQICH RIVOJLANTIRISH YO'L XARITASI (IMPLEMENTATION ROADMAP)

Ushbu yo'l xaritasi audit davomida aniqlangan barcha kamchiliklarni bartaraf etish va yangi imkoniyatlarni bosqichma-bosqich, mavjud tizimni buzmagan holda kiritish uchun ishlab chiqildi.

---

## 1. Bosqichlar va Vazifalar Taqvimi

### 🔴 0-BOSQICH: Kritik Xavfsizlik va Ma'lumotlar Butunligi (1-hafta)
* **Maqsad:** Tizimdagi o'ta xavfli teshiklarni zudlik bilan yopish va ruxsatsiz kirishlarni to'sish.

| ID | Vazifa tavsifi | Prioritet | Ta'sirlangan fayllar | Bog'liqlik |
|---|---|---|---|---|
| **TASK-001** | Admin API yo'nalishlariga `ADMIN_SECRET_KEY` va token himoyasini o'rnatish | **P0** | `app/api/admins/*`, `app/api/broadcast/create` | — |
| **TASK-002** | Telegram Webhook uchun `X-Telegram-Bot-Api-Secret-Token` tekshiruvini qo'shish | **P0** | `app/api/telegram/route.ts` | — |
| **TASK-003** | Telegram `initData` HMAC tekshiruvini barcha API yo'nalishlarida majburiy qilish | **P0** | `lib/quiz/security.ts`, `app/api/*` | — |
| **TASK-004** | Fayl yuklash yo'nalishlarida (chek, rasm, hujjat) 5-10MB qat'iy hajm tekshiruvini kiritish | **P1** | `app/api/payments/upload-proof`, `api/convert-*` | — |

---

### 🟠 1-BOSQICH: Barqarorlik va Muhim Tuzatishlar (2-hafta)
* **Maqsad:** Mavjud xatoliklar va uzilishlarni bartaraf etish.

| ID | Vazifa tavsifi | Prioritet | Ta'sirlangan fayllar | Bog'liqlik |
|---|---|---|---|---|
| **TASK-101** | Bilet Scan mijozida Canvas yordamida rasmni avtomatik siqish (max 1200px, JPEG 80%) | **P1** | `app/scan/page.tsx` | — |
| **TASK-102** | PPT generatorida `outline` ni response qaytarish va bo'sh kartani to'g'rilash | **P1** | `app/api/generate-ppt/route.ts`, `ppt/page.tsx` | — |
| **TASK-103** | PPT da `comparison` va `horizontal-steps` slayd turlarini to'liq render qilish | **P2** | `app/api/generate-ppt/route.ts` | — |
| **TASK-104** | `UsageStatsWidget` dagi 1 soniyalik `setInterval` ni hodisaviy modelga o'tkazish | **P2** | `components/UsageStatsWidget.tsx` | — |
| **TASK-105** | AI fallback zanjirini 3 ta optimal modelga ixchamlashtirish va timeoutni sozlash | **P2** | `lib/ai-fallback-runner.ts`, `api/analyze/route.ts` | — |

---

### 🟡 2-BOSQICH: AI Chat & Study Mentorni Modernizatsiya Qilish (3-hafta)
* **Maqsad:** Foydalanuvchi kutish vaqtini 30 barobarga qisqartirish va akademik ko'rinishni yaxshilash.

| ID | Vazifa tavsifi | Prioritet | Ta'sirlangan fayllar | Bog'liqlik |
|---|---|---|---|---|
| **TASK-201** | AI Chat uchun Server-Sent Events (SSE) streaming javob qaytarishni joriy etish | **P1** | `app/api/ai-chat/route.ts`, `app/ai-chat/page.tsx` | — |
| **TASK-202** | Matematik formulalar uchun KaTeX kutubxonasini ulash | **P2** | `app/ai-chat/page.tsx`, `components/ai-chat/*` | TASK-201 |
| **TASK-203** | Kod bloklari uchun sintaksis ranglash (Prism/Highlight) va qulay nusxa olish | **P2** | `app/ai-chat/page.tsx` | TASK-201 |
| **TASK-204** | Chat kontekst oynasini 16 tadan 32 ta xabarga kengaytirish | **P2** | `app/api/ai-chat/route.ts` | — |

---

### 🟢 3-BOSQICH: Modullararo Integratsiya va Yangi Imkoniyatlar (4-hafta)
* **Maqsad:** Yagona o'quv ekotizimini shakllantirish.

| ID | Vazifa tavsifi | Prioritet | Ta'sirlangan fayllar | Bog'liqlik |
|---|---|---|---|---|
| **TASK-301** | Bilet Scan natijasidan to'g'ridan-to'g'ri Quiz generatsiya qilish tugmasi | **P2** | `app/scan/page.tsx`, `app/quiz/page.tsx` | — |
| **TASK-302** | Katta darsliklar bilan to'g'ridan-to'g'ri suhbatlashish (PDF Chat / Long-context) | **P2** | `app/file-tools/`, `app/ai-chat/` | TASK-201 |
| **TASK-303** | Quizda xato qilingan savollarni Sokratik AI Mentor bilan qayta ishlash | **P2** | `app/quiz/page.tsx`, `app/ai-chat/page.tsx` | TASK-201 |
| **TASK-304** | Click va Payme billing provayderlarini to'liq avtomatik ulash | **P1** | `app/api/payments/*`, `lib/payment.ts` | TASK-001 |
