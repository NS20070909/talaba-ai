# 03. AXBOROT XAVFSIZLIGI AUDITI (SECURITY AUDIT)

Ushbu bo'limda Talaba AI loyihasining autentifikatsiya, avtorizatsiya, ma'lumotlar bazasi, API va kiruvchi fayllar xavfsizligi bo'yicha mustaqil va dalillarga asoslangan tekshiruv natijalari keltiriladi.

---

## 1. Tasdiqlangan Xavfsizlik Zaifliklari (Confirmed Vulnerabilities)

### 🔴 SEC-01: Admin va Ega (Owner) Huquqlarining Autentifikatsiyasiz Ochiqligi (IDOR / Broken Object Level Authorization)
* **Xavf darajasi:** **CRITICAL (CVSS: 9.8)**
* **Ta'sirlangan fayllar:**
  * `app/api/admins/add/route.ts` (L9-11)
  * `app/api/admins/list/route.ts` (L7-11)
  * `app/api/admins/remove/route.ts` (L9-11)
  * `app/api/broadcast/create/route.ts` (L8-12)
  * `lib/admin.ts` (L10: `export const OWNER_ID = 6630030492;`)
* **Kod dalili (`app/api/admins/add/route.ts`):**
  ```typescript
  const body = await req.json();
  const { target_telegram_id, name, username, role, permissions, admin_id } = body;

  if (!admin_id || !isOwner(Number(admin_id))) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
  }
  ```
* **Texnik tushuntirish:**
  * Tizimda admin yoki owner ekanlikni tasdiqlash uchun hech qanday sirli kalit, JWT token, parol yoki Telegram sessiyasi talab qilinmaydi.
  * Tizim faqat kelgan JSON so'rovidagi `admin_id` raqamini `6630030492` ga tengligini tekshiradi xolos.
  * Internetdagi ixtiyoriy shaxs quyidagi so'rovni yuborib, o'zini SUPERADMIN qilib belgilashi mumkin:
    ```bash
    curl -X POST https://talaba-ai.vercel.app/api/admins/add \
      -H "Content-Type: application/json" \
      -d '{"admin_id": 6630030492, "target_telegram_id": 12345678, "role": "SUPERADMIN"}'
    ```
  * Xuddi shunday yo'l bilan `/api/broadcast/create` orqali butun baza foydalanuvchilariga bot nomidan fishing/spam xabarlar yuborish mumkin.
* **Tuzatish choralari:**
  * Admin API yo'nalishlarini qat'iy `ADMIN_SECRET_KEY` (Bearer token) bilan himoyalash yoki server-side sessiya (NextAuth/Iron Session) o'rnatish.
  * Oddiy `admin_id` parametriga ishonishni darhol to'xtatish.

---

### 🔴 SEC-02: Telegram Webhook Soxtalashtirish Xavfi (Missing Secret Token)
* **Xavf darajasi:** **CRITICAL (CVSS: 9.1)**
* **Ta'sirlangan fayl:** `app/api/telegram/route.ts` (L2915-2962)
* **Kod dalili:**
  ```typescript
  export async function POST(req: Request) {
    const body = await req.json();
    ...
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  }
  ```
* **Texnik tushuntirish:**
  * Telegram Bot API webhook sozlamasida `secret_token` parametri taqdim etiladi va har bir webhook yangilanishida `X-Telegram-Bot-Api-Secret-Token` sarlavhasida yuboriladi.
  * `route.ts` da bu sarlavha tekshirilmaydi.
  * Har qanday tajovuzkor `/api/telegram` manziliga soxta webhook `Update` ob'ektini (masalan, admin to'lovni tasdiqladi degan `callback_query`) jo'natib, xohlagan foydalanuvchiga tekinga Premium faollashtirishi yoki boshqa bot amallarini bajartirishi mumkin.
* **Tuzatish choralari:**
  ```typescript
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```

---

### 🔴 SEC-03: Telegram WebApp Foydalanuvchi Shaxsini Soxtalashtirish (Identity Spoofing)
* **Xavf darajasi:** **HIGH (CVSS: 8.5)**
* **Ta'sirlangan modullar:** Barcha API Route-lar (`/api/analyze`, `/api/ai-chat`, `/api/generate-ppt`, `/api/write-referat`, `/api/user-stats`)
* **Kod dalili:**
  * `lib/quiz/security.ts` da `validateTelegramWebAppData` funksiyasi yozilgan (L6-60), lekin u bitta ham API Route ichida chaqirilmagan.
  * Klient (`localStorage.getItem("telegram_user_id")`) shunchaki raqam yuboradi:
    ```typescript
    const telegramId = Number(body.telegram_user_id);
    const guard = await guardCheck(telegramId);
    ```
* **Texnik tushuntirish:**
  * Agar tajovuzkor Premium olgan boshqa bir talabaning ommaviy Telegram ID-sini bilsa, so'rov tanasida o'sha ID-ni yuborib, uning hisobidan cheksiz AI xizmatlaridan foydalana oladi yoki uning limitlarini tugatib qo'yishi mumkin.
* **Tuzatish choralari:**
  * Frontend har bir so'rovda `window.Telegram.WebApp.initData` xom satrini `Authorization: Bearer <initData>` sarlavhasida yuborishi shart.
  * Backend `lib/quiz/security.ts` dagi `validateTelegramWebAppData` orqali HMAC-SHA256 tekshiruvini o'tkazib, haqiqiy foydalanuvchi ID-sini serverda ajratib olishi kerak.

---

### 🟠 SEC-04: Supabase RLS Cheklovlarining To'liq Chetlab O'tilishi (Global Service Role Bypass)
* **Xavf darajasi:** **HIGH (CVSS: 7.5)**
* **Ta'sirlangan fayl:** `lib/supabase.ts` (L1-27)
* **Kod dalili:**
  ```typescript
  export function getSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  ```
* **Texnik tushuntirish:**
  * `SUPABASE_SERVICE_ROLE_KEY` barcha so'rovlar uchun ishlatiladi. Ushbu kalit PostgreSQL-dagi barcha Row Level Security (RLS) qoidalarini to'liq o'chiradi.
  * Bazada RLS yoqilgan bo'lsa ham, u dastur uchun mutlaqo ishlamaydi. Butun himoya faqat kod ichidagi `if`-larga tayanadi.
* **Tuzatish choralari:**
  * Umumiy o'qish/yozish operatsiyalari uchun `SUPABASE_ANON_KEY` va foydalanuvchi konteksti bilan so'rovlar yuborish, Service Role-ni faqat bot admin boshqaruviga qoldirish.

---

### 🟠 SEC-05: Fayl Hajmi Cheklovlarining Yo'qligi (Unrestricted File Upload Size)
* **Xavf darajasi:** **MEDIUM (CVSS: 6.5)**
* **Ta'sirlangan fayllar:**
  * `app/api/payments/upload-proof/route.ts` (L15-30)
  * `app/api/convert-word-to-pdf/route.ts` (L18-30)
  * `app/api/analyze/route.ts` (L10-25)
* **Texnik tushuntirish:**
  * To'lov chekini yuklashda faqat fayl kengaytmasi (`jpg, png, webp`) tekshiriladi, lekin `file.size` tekshirilmaydi.
  * Foydalanuvchi 100MB li soxta faylni yuklab, Supabase Storage bepul kvotasini (1GB) to'ldirib qo'yishi mumkin (Storage Denial of Service).
* **Tuzatish choralari:**
  * Klient va serverda qat'iy hajm cheklovi: `if (file.size > 5 * 1024 * 1024) throw new Error("Maksimal hajm 5MB");`.

---

### 🟡 SEC-06: `dangerouslySetInnerHTML` va Regex Sanitizatsiyasi
* **Xavf darajasi:** **LOW to MEDIUM (CVSS: 4.3) — Zaiflik / Code Smell**
* **Ta'sirlangan fayl:** `app/ai-chat/page.tsx` (L92-117)
* **Tahlil:**
  * Dastur `safeText = part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")` orqali HTML teglarini zararsizlantiradi.
  * Shu sababli standart `<script>alert(1)</script>` kiritilganda brauzer uni teg sifatida bajarmaydi (ekranda matn bo'lib chiqadi).
  * Ammo qo'lda yozilgan regex asosidagi markdown parslari nostandart belgilar, emojilar yoki URL-lar aralashganda xatoliklarga olib kelishi mumkin.
* **Tuzatish choralari:**
  * DOMPurify kutubxonasi yoki xavfsiz AST-ga asoslangan `react-markdown` kutubxonasiga o'tish.

---

### 🟡 SEC-07: Kvota Chegirishdagi Poyga Holati (Race Condition on Quota Increment)
* **Xavf darajasi:** **MEDIUM (CVSS: 5.3)**
* **Ta'sirlangan fayllar:** `lib/limit-checker.ts`, barcha AI marshrutlari.
* **Tushuntirish:**
  * Limitni tekshirish so'rov boshida (`await canUseScan()`), hisoblagichni oshirish esa og'ir generatsiya tugagandan so'ng (`await incrementScan()`) amalga oshiriladi (oraliq 10-30 soniya).
  * Bir vaqtning o'zida parallel 10 ta so'rov yuborilsa, ularning barchasi `canUseScan()` dan o'tib ketadi va bepul limit 2 ta bo'lishiga qaramay, 10 ta generatsiya bepul bajariladi.
* **Tuzatish choralari:**
  * Bazada atomik tranzaksiya (`UPDATE usage_stats SET scan_used = scan_used + 1 WHERE ... RETURNING ...`).
