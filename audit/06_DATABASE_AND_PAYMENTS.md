# 06. MA'LUMOTLAR BAZASI, TO'LOVLAR VA LIMITLAR AUDITI

Ushbu hujjatda Talaba AI loyihasining Supabase PostgreSQL tuzilmasi, migratsiyalar, to'lovlar mexanizmi va obuna limitlari tahlili keltiriladi.

---

## 1. Supabase Ma'lumotlar Bazasi Tuzilmasi (Database Schema)

Bazadagi asosiy jadvallar va ularning vazifalari:

1. **`users`:** Foydalanuvchilar profillari (`telegram_id`, `first_name`, `username`, `plan`, `premium_until`, `created_at`).
2. **`usage_stats`:** Kundalik foydalanish hisoblagichlari (`ppt_used_today`, `pdf_used_today`, `scan_used_today`, `referat_used_today`, `translation_used_today`, `quiz_used_today`, `live_seconds_today`, `flash_review_used_today`, `chat_messages_today`, `last_reset_date`).
3. **`payments`:** To'lov yozuvlari (`id`, `telegram_id`, `amount`, `plan`, `status`, `provider`, `proof_url`, `confirmed_by`, `confirmed_at`).
4. **`admins`:** Tizim adminlari ro'yxati va rollari (`telegram_id`, `role`, `permissions`, `is_deleted`, `last_seen`).
5. **`live_sessions`:** Gemini Live audio sessiyalari davomiyligi va heartbeati.
6. **`audit_logs`:** Admin va xavfsizlik harakatlari jurnali (`admin_id`, `action`, `target_id`, `old_value`, `new_value`, `ip_address`).
7. **`support_tickets` & `support_messages`:** Foydalanuvchilar murojaatlari va yordam markazi chiptalari.
8. **`bot_states`:** Telegram botining kontekst holatlari (FSM - Finite State Machine).
9. **`quiz_*` jadvallari:** Quiz to'plamlari, urinishlar, nishonlar va foydalanuvchi XP ballari.

---

## 2. Migratsiyalar Tahlili (Migrations Audit)

`supabase/migrations/` katalogida **16 ta SQL migratsiya fayli** mavjud:
* `20260621_payment_proofs_v2.sql`
* `20260716_bot_states.sql`
* `20260716_referat_yozish_v1.sql`
* `20260723_hujjat_tozalash_v1.sql`
* `20260723_tarjima_pro_v1.sql`
* `20260730_admin_hardening.sql`
* `20260730_admin_management_v2.sql`
* `20260730_broadcast_v2.sql`
* `20260730_settings_audit_v2.sql`
* `20260730_support_v2.sql`
* `20260730_user_management_v2.sql`
* `20260802_quiz_engine_pro.sql`
* `20260802_quiz_engine_v2.sql`
* `20260802_quiz_gamification.sql`
* `20260914_ai_chat_study_mentor_v1.sql`
* `20260923_live_sessions_v1.sql`

### Aniqlangan Muammolar:
* **Foreign Key Constraints yetishmovchiligi:** Ko'pgina jadvallarda `telegram_id` ustuni `users(telegram_id)` ga `REFERENCES ... ON DELETE CASCADE` bilan bog'lanmagan. Foydalanuvchi o'chirilganda yetim yozuvlar (orphan rows) qolishi mumkin.
* **RLS Policies yo'qligi:** Migratsiyalarda jadvallar uchun `ENABLE ROW LEVEL SECURITY` va aniq `CREATE POLICY` direktivalari deyarli uchramaydi. Dastur to'liq Service Role kalitiga tayanadi.

---

## 3. Tarif Rejalari va Limitlar Tizimi (Plans & Limits)

`lib/limits.ts` faylidagi rasmiy tariflar va ularning kunlik limitlari:

| Tarif nomi | Davomiyligi | Narxi (UZS) | Scan | PPT | PDF | Referat | Live Ovoz | Flash Review |
|---|---|---|---|---|---|---|---|---|
| **FREE** | Cheksiz | 0 | 2 | 2 | 2 | 2 (3-7 bet) | 20 daqiqa | 5 ta |
| **DAY (Starter)** | 1 kun | 2,900 | 5 | 3 | 5 | 10 (5-10 bet) | 30 daqiqa | 15 ta |
| **WEEK (Weekly)** | 7 kun | 11,900 | 50 | 20 | 50 | 50 (5-15 bet) | 45 daqiqa | 30 ta |
| **MONTH (Premium)** | 30 kun | 29,900 | 300 | 120 | 300 | 120 (5-50 bet) | 60 daqiqa | 60 ta |
| **QUARTER (Pro)** | 90 kun | 69,900 | 1000 | 400 | 1000 | 400 (5-30 bet) | 60 daqiqa | 100 ta |
| **YEAR (Elite)** | 365 kun | 199,900 | Cheksiz | Cheksiz | Cheksiz | Cheksiz | 60 daqiqa | 999 ta |

* **AI Chat:** Barcha tariflarda, shu jumladan FREE da ham matnli chat cheksiz deb belgilangan (`chatUnlimited: true`).
* **Kundalik yangilanish (`checkDailyReset`):** Toshkent vaqt zonasi (`Asia/Tashkent`) bo'yicha har kuni 00:00 da hisoblagichlar avtomatik 0 ga tushadi.

---

## 4. To'lov Tizimi Tahlili (Payment Architecture)

### 4.1. Hozirgi Ishlash Zanjiri
1. Foydalanuvchi `/payments` sahifasida tarifni tanlaydi.
2. Ko'rsatilgan karta raqamiga (standart: Suxrob Narkabilov) pul o'tkazadi.
3. Kvitansiya/chek skrinshotini yuklaydi (`/api/payments/upload-proof`).
4. Fayl Supabase Storage `payment-proofs` chelagiga saqlanadi.
5. Bot orqali asosiy admin (`6630030492`) ga tasdiqlash tugmalari bilan xabar boradi:
   `[📸 View Proof]`, `[✅ Confirm]`, `[❌ Reject]`.
6. Admin "Confirm" tugmasini bosganda, bazada `status = 'PAID'` bo'ladi va `givePremium()` funksiyasi orqali foydalanuvchiga tegishli kunlar qo'shiladi.

### 4.2. Zaifliklar va Muammolar
* **Qo'lda tekshirish inson omiliga bog'liq:** Admin doim onlayn bo'lmasa, talaba 2-3 soat kutib qoladi.
* **Soxta chek xavfi:** Photoshop yoki boshqa ilovalar orqali o'zgartirilgan cheklarni inson ko'zi bilan aniqlash qiyin.
* **Avtomatik provayderlar (Click / Payme) integratsiya qilinmagan:** `lib/payment.ts` da `"click" | "payme"` turlari e'lon qilingan bo'lsa-da, ularning real billing webhooklari mavjud emas.
