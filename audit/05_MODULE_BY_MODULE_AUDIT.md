# 05. BO'LIMLAR BO'YICHA CHUQUR AUDIT (MODULE-BY-MODULE AUDIT)

Ushbu hujjat Talaba AI loyihasining 5 ta asosiy bo'limi va qo'shimcha aniqlangan modullarining real holati, muammolari va rivojlantirish nuqtalarini yoritadi.

---

## 1. 📸 Bilet Scan (`app/scan/page.tsx` & `app/api/analyze/route.ts`)

### Hozirgi Holat (Current State)
* **Yuklash usullari:** Drag-and-drop (`react-dropzone`), fayl tanlash va clipboarddan to'g'ridan-to'g'ri nusxalash (`paste` / Ctrl+V).
* **AI Ishlov berish:** Rasmni to'g'ridan-to'g'ri base64 ga o'girib, `/api/analyze` ga jo'natadi. Gemini Vision modeli bilet ichidagi barcha savollarni o'qib, ularga to'liq akademik javoblar va "shpargalka" konspektini yozib beradi.
* **Eksport:** DOCX formatida yuklab olish va Telegram chatga yuborish.
* **Cheklov:** FREE tarifda kuniga 2 ta, limit tugasa Premium taklif banneri chiqadi.

### Muammolar va Zaifliklar
1. **Mijoz tomonida rasm siqish (compression) yo'q:**
   * Zamonaviy smartfonlar rasmlari 8-15 MB bo'ladi. Ular base64 ga aylantirilganda 11-20 MB ga yetadi. Next.js va Vercel serverless request body limiti (4.5 MB) sababli so'rov serverga yetib bormasdan `413 Payload Too Large` xatosi bilan uziladi.
2. **Kamera tugmasi yo'q:**
   * Mobil telefonda ochganda kamerani to'g'ridan-to'g'ri faollashtiruvchi `<input capture="environment">` tugmasi yo'q.
3. **Nusxa olish (Copy) tugmasi yo'q:**
   * Talaba natijani tezda nusxalab olishi uchun alohida qulay tugma mavjud emas.
4. **Matematik formulalar va jadvallar:**
   * Formulalar oddiy matn ko'rinishida chiqadi, KaTeX ko'rinishida formatlanmaydi.

---

## 2. 📄 File Tools (`app/file-tools/*` & `app/api/*`)

### Hozirgi Holat
* 6 ta konvertor mavjud: Word → PDF, PPTX → PDF, PDF → Word, Merge PDF, Split PDF, Compress PDF.
* Merge va Split PDF to'liq in-house (`pdf-lib`) kutubxonasida amalga oshiriladi va juda tez ishlaydi.
* Word/PPTX konvertatsiyalarida serverless uchun CloudConvert SaaS xizmatiga tayaniladi.

### Muammolar va Zaifliklar
1. **PDF to Word sifati past:** Asl format, rasmlar va jadvallar saqlanmaydi; faqat xom matn DOCX ga ko'chiriladi.
2. **CloudConvert bepul limitiga tobelik:** Kuniga 25 ta bepul konvertatsiya tugagach, konvertorlar ishlamay qoladi.
3. **Hujjatli tahlil (Document Intelligence) yo'q:**
   * Talaba uchun eng kerakli bo'lgan funksiyalar: "PDF bilan chat", "Hujjat konspekti (Summary)", "Kitobdan test yaratish" File Tools bo'limida yo'q.

---

## 3. 🛠️ Talaba Yordamchi (`app/talaba-tools/*`)

### 3.1. Slayd Tayyorlash (AI PPT)
* **Holat:** Mavzu, slaydlar soni, til va uslub tanlanadi. Pexels API dan mavzuga mos stock rasmlar olinadi va `PptxGenJS` bilan prezentatsiya generatsiya qilinadi.
* **Kritik kamchiliklar:**
  * `comparison` va `horizontal-steps` slayd turlari kodda chizilmaydi (fallback-ga tushadi).
  * API response ichida `outline` qaytarilmaydi (`outline: undefined`), natijada sahifadagi "AI Reja" kartasi doimo bo'sh qoladi.
  * Slayd soni inputida cheklov yo'q (harf kiritilsa `NaN` bo'ladi).
  * Generatsiya paytida progress indikatori yo'q (talaba 25-35 soniya davomida nima bo'layotganini ko'rmaydi).
  * WebApp ichida xunuk ko'rinuvchi `alert()` ishlatilgan.

### 3.2. Referat Yozish (`write-referat`)
* **Holat:** OTM standartlariga mos to'liq referat yaratadi (Mundarija, Kirish, 3 ta Bob, Xulosa, Foydalanilgan Adabiyotlar).
* **Yaxshi tomoni:** Gemini-ga parallel so'rovlar yuborilib, tezlik sezilarli oshirilgan.
* **Muammo:** Bitta fayl 91 KB (2,000+ qator). Kod arxitekturasi juda og'ir, refaktor talab qiladi.

### 3.3. GPA Hisoblagich (`gpa`)
* Fanlar, kreditlar va baholarni kiritish orqali GPA hisoblaydi. Natijani faqat Telegram-ga jo'natadi, ekranda yuklab olish yoki nusxalash yo'q.

---

## 4. 🧠 Quiz va Test Tizimi (`app/quiz/*` & `lib/quiz/*`)

### Hozirgi Holat
* Gibrid parser tizimi: Avval qat'iy qoidalarga asoslangan `RuleParser` ishlaydi. Agar savollar soni 2 tadan kam bo'lsa yoki to'g'rilik 60% dan past bo'lsa, Gemini AI parseri ishga tushadi.
* XP ballari, kunlik seriyalar (streak), 7 ta yutuq nishonlari (achievements) va peshqadamlar jadvali mavjud.
* Tayyor testlarni Telegram kanallarga so'rovnoma (poll) qilib yuborish imkoniyati bor.

### Muammolar va Zaifliklar
1. **RuleParser haddan tashqari qat'iy:** Talabalar internetdan nusxalagan tartibsiz testlarni taniy olmaydi.
2. **AI Parser Regexi nozik:** `cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/)` agar AI ozgina ortiqcha matn qo'shsa, buziladi.
3. **Qiyinlik darajasi (Difficulty) yo'q:** Quiz UI-da "Oson / O'rta / Murakkab" filtri yo'q.
4. **Xatolar tahlili chuqur emas:** Talaba qaysi mavzuda ko'p xato qilayotgani (Weak Topics) avtomatik aniqlanmaydi.

---

## 5. 🤖 AI Chat & Study Mentor (`app/ai-chat/*`)

### Hozirgi Holat
* 7 ta rejim: Study Mentor, Socratic, Code Explainer, Math Step-by-Step, IELTS Speaking, Interview, Research.
* Real-time Google Search grounding (manbalar bilan).
* Rasm va PDF tahlili (multimodal inline data).
* Flash Review (WAV audio sintezi).
* Gemini Live (real-time ovozli suhbat infratuzilmasi).

### Kritik Kamchiliklar
1. **Real Streaming yo'q:**
   * So'rov yuborilgach, foydalanuvchi butun javob to'liq tayyor bo'lguncha 15-45 soniya kutib turadi. Tokenma-token chiqish yo'q.
2. **Tarix 16 ta xabar bilan cheklangan:**
   * Chuqur dars tayyorlashda kontekst tezda o'chib ketadi.
3. **Matematik formulalar:**
   * LaTeX sintaksisi (`$`, `\frac`) render qilinmaydi, faqat quruq matn bo'lib ko'rinadi.
4. **Kod ranglanishi (Syntax Highlighting) yo'q:**
   * Kod faqat `<pre><code>` ichida oq matn bo'lib turadi, kalit so'zlar ranglanmaydi.
