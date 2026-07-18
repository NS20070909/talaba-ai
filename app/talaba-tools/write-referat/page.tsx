"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// Subjects for dropdown
const SUBJECTS = [
  { id: "cs", name: "Kiberxavfsizlik" },
  { id: "history", name: "O'zbekiston tarixi" },
  { id: "econ", name: "Iqtisodiyot nazariyasi" },
  { id: "math", name: "Oliy matematika" },
  { id: "philosophy", name: "Falsafa" },
  { id: "ecology", name: "Ekologiya" },
  { id: "custom", name: "Boshqa (O'zingiz yozasiz)" },
];

// Plan limits helper
const getLimitsForPlan = (plan: string) => {
  switch (plan) {
    case "FREE":
      return { name: "Free", min: 3, max: 4 };
    case "DAY":
    case "STARTER":
      return { name: "Starter", min: 5, max: 8 };
    case "WEEK":
    case "STUDENT":
      return { name: "Weekly", min: 5, max: 15 };
    case "MONTH":
    case "PREMIUM":
      return { name: "Premium", min: 5, max: 20 };
    case "QUARTER":
    case "PRO":
      return { name: "Pro", min: 5, max: 30 };
    case "YEAR":
    case "ELITE":
      return { name: "Elite", min: 5, max: Infinity };
    default:
      return { name: "Free", min: 3, max: 4 };
  }
};

interface OutlineResult {
  title: string;
  outline: string[];
  model: string;
}

export default function WriteReferatPage() {
  // Form states
  const [topic, setTopic] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0].id);
  const [customSubject, setCustomSubject] = useState("");
  const [language, setLanguage] = useState("uz");
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const [pagesVal, setPagesVal] = useState<string>("3"); // 3 = FREE plan minimum; updated by useEffect when plan loads
  const pagesCount = parseInt(pagesVal, 10) || 0;

  // Interactive UX states
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isTelegramSent, setIsTelegramSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real API result
  const [result, setResult] = useState<OutlineResult | null>(null);

  // Fetch user stats on mount to determine plan
  useEffect(() => {
    const userId = localStorage.getItem("telegram_user_id");
    if (userId) {
      fetch(`/api/user-stats?telegram_id=${userId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.stats) {
            setUserPlan(data.stats.plan || "FREE");
          }
        })
        .catch((err) => console.error("Error fetching user stats:", err));
    }
  }, []);

  // Update page count when user plan changes to match minimum
  useEffect(() => {
    const limits = getLimitsForPlan(userPlan);
    setPagesVal(limits.min.toString());
  }, [userPlan]);

  const planLimits = getLimitsForPlan(userPlan);
  const isExceeded = pagesCount > planLimits.max;
  const isInvalid = pagesCount < planLimits.min || isExceeded;

  const triggerTelegramSend = () => {
    setIsTelegramSent(true);
    alert("✅ Referat muvaffaqiyatli Telegram botingizga yuborildi!");
  };

  const getSubjectName = () => {
    if (selectedSubject === "custom") {
      return customSubject.trim() || "Erkin mavzu";
    }
    return SUBJECTS.find((s) => s.id === selectedSubject)?.name || "Erkin mavzu";
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setShowResult(false);
    setResult(null);
    setError(null);
    setIsTelegramSent(false);
    setLoading(true);
    setLoadingMessage("AI mavzuni tahlil qilmoqda...");

    const telegramUserId = localStorage.getItem("telegram_user_id");
    console.log("[UI] Calling referat-outline with:", { topic, subject: getSubjectName(), language, pages: pagesCount, telegram_user_id: telegramUserId });

    try {
      // Step 1 – animate loading messages while waiting
      const messages = [
        "AI mavzuni tahlil qilmoqda...",
        "Reja va mundarija shakllantirilmoqda...",
        "Akademik strukturа yaratilmoqda...",
      ];
      let msgIdx = 0;
      const msgInterval = setInterval(() => {
        msgIdx = (msgIdx + 1) % messages.length;
        setLoadingMessage(messages[msgIdx]);
      }, 1800);

      // Step 2 – real API call
      const res = await fetch("/api/referat-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: getSubjectName(),
          language,
          pages: pagesCount,
          telegram_user_id: telegramUserId,
        }),
      });

      clearInterval(msgInterval);

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Serverdan xato javob keldi.");
      }

      console.log("[UI] Outline received from model:", data.model);

      setResult({
        title: data.title,
        outline: data.outline,
        model: data.model,
      });
      setShowResult(true);

      // Dispatch event so UsageStatsWidget re-fetches immediately (fixes issue #1 & #4)
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: any) {
      console.error("[UI] Error:", err.message);
      setError(err.message || "Noma'lum xato yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

  return (
    <main className="min-h-screen bg-[#0f1724] text-white selection:bg-cyan-500/30">
      <div className="max-w-md mx-auto px-4 py-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/talaba-tools"
            className="
              h-11 w-11 rounded-[16px]
              bg-[#243140] border border-white/5
              flex items-center justify-center
              text-lg hover:bg-slate-700 transition-colors
            "
          >
            ←
          </Link>

          <div>
            <h1 className="text-[24px] font-bold tracking-tight">
              Referat Yozish
            </h1>
            <p className="text-slate-400 text-xs">
              AI yordamida akademik referat yaratish
            </p>
          </div>
        </div>

        {/* Main Interface */}
        {!loading && !showResult && (
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* Input Card */}
            <div className="rounded-[28px] bg-[#243140] border border-cyan-500/10 p-5 space-y-4 shadow-lg">

              {/* Topic */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Referat Mavzusi
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Masalan: Kiberxavfsizlik asoslari va tarmoq himoyasi usullari"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="
                    w-full
                    bg-[#1b2635]
                    border border-white/10
                    rounded-2xl
                    px-4 py-3
                    text-white
                    placeholder-slate-500
                    outline-none
                    focus:border-cyan-400
                    focus:ring-1
                    focus:ring-cyan-400
                    transition-all
                    text-sm
                    resize-none
                  "
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Fan yoki Yo'nalish
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="
                    w-full
                    bg-[#1b2635]
                    border border-white/10
                    rounded-2xl
                    px-4 py-3
                    text-white
                    outline-none
                    focus:border-cyan-400
                    transition-all
                    text-sm
                  "
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-[#1b2635]">
                      {sub.name}
                    </option>
                  ))}
                </select>

                {selectedSubject === "custom" && (
                  <input
                    type="text"
                    required
                    placeholder="Fanning nomini yozing..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="
                      w-full
                      mt-2.5
                      bg-[#1b2635]
                      border border-white/10
                      rounded-xl
                      px-4 py-2.5
                      text-white
                      placeholder-slate-500
                      outline-none
                      focus:border-cyan-400
                      transition-all
                      text-sm
                    "
                  />
                )}
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Referat Tili
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: "uz", label: "O'zbekcha", flag: "🇺🇿" },
                    { code: "ru", label: "Русский", flag: "🇷🇺" },
                    { code: "en", label: "English", flag: "🇬🇧" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`
                        py-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all
                        ${
                          language === lang.code
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                            : "bg-[#1b2635] border-white/15 text-slate-300 hover:border-slate-500"
                        }
                      `}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

               {/* Pages Numeric Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Sahifalar soni (Pages)
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(pagesVal, 10) || 0;
                      setPagesVal(Math.max(1, current - 1).toString());
                    }}
                    className="h-12 w-12 rounded-2xl bg-[#1b2635] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-cyan-400"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={pagesVal}
                    onChange={(e) => setPagesVal(e.target.value)}
                    className="
                      flex-1 h-12 text-center
                      bg-[#1b2635]
                      border border-white/10
                      rounded-2xl
                      text-white
                      font-bold
                      outline-none
                      focus:border-cyan-400
                      transition-all
                    "
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const current = parseInt(pagesVal, 10) || 0;
                      setPagesVal((current + 1).toString());
                    }}
                    className="h-12 w-12 rounded-2xl bg-[#1b2635] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-cyan-400"
                  >
                    +
                  </button>
                </div>
                
                {/* Dynamically display current plan and allowed pages */}
                <div className="mt-4 p-4 rounded-[20px] bg-[#1b2635]/60 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Joriy tarif (Current Plan):</span>
                    <span className="text-cyan-400 font-extrabold">{planLimits.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Ruxsat etilgan sahifalar (Allowed pages):</span>
                    <span className="text-slate-200 font-bold">
                      {planLimits.max === Infinity ? "Cheksiz (Unlimited)" : `${planLimits.min}–${planLimits.max}`}
                    </span>
                  </div>
                </div>

                {/* Inline warning and Upgrade button */}
                {isExceeded && (
                  <div className="mt-4 p-4 rounded-[20px] bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                    <p className="text-amber-400 font-semibold leading-relaxed">
                      ⚠️ Sizning joriy tarifingizda maksimal {planLimits.max} sahifa yozish mumkin. Kattaroq referat yozish uchun tarifingizni yangilang.
                    </p>
                    <Link
                      href="/premium"
                      className="block w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-center shadow-md active:scale-95 transition-all"
                    >
                      👑 Tarifni Yangilash (Upgrade Plan)
                    </Link>
                  </div>
                )}
                
                {/* Warning for less than minimum pages */}
                {!isExceeded && pagesCount < planLimits.min && (
                  <div className="mt-4 p-3 rounded-[20px] bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-semibold">
                    ⚠️ Sahifa soni kamida {planLimits.min} bo'lishi kerak.
                  </div>
                )}
              </div>

            </div>

            {/* Error */}
            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-xs">
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!topic.trim() || isInvalid}
              className={`
                w-full py-4 rounded-[20px] font-bold text-center text-sm shadow-md transition-all
                ${
                  isExceeded
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed"
                    : isInvalid
                    ? "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
                    : topic.trim()
                    ? "bg-cyan-500 hover:bg-cyan-400 text-black active:scale-95 shadow-cyan-500/10"
                    : "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
                }
              `}
            >
              {isExceeded
                ? "👑 Tarifni yangilang (Upgrade Plan)"
                : "✨ AI Referat Yozish"}
            </button>
          </form>
        )}

        {/* Loading State */}
        {loading && (
          <div className="rounded-[28px] bg-[#243140] border border-cyan-500/10 p-8 text-center space-y-6 shadow-xl my-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-fuchsia-500/10 border-t-fuchsia-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">
                ⚡
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-400">Referat tayyorlanmoqda</h3>
              <p className="text-xs text-slate-400 italic transition-all duration-300">
                {loadingMessage}
              </p>
            </div>

            {/* Loading Indicator Bar */}
            <div className="w-full bg-[#1b2635] h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full animate-pulse w-2/3" />
            </div>
            <p className="text-[10px] text-slate-500">
              Bu amal taxminan 5-10 soniya vaqt oladi. Iltimos sahifadan chiqmang.
            </p>
          </div>
        )}

        {/* Result Screen */}
        {showResult && !loading && result && (
          <div className="space-y-4">

            {/* Header Result */}
            <div className="rounded-[28px] bg-[#243140] border border-emerald-500/20 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0">
                  ✅
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    Muvaffaqiyatli Yaratildi
                  </span>
                  <h2 className="text-base font-bold leading-tight">
                    {result.title}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fan: {getSubjectName()} • Til: {language.toUpperCase()} • Hajm: {pagesVal} bet
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    🤖 Model: {result.model}
                  </p>
                </div>
              </div>
            </div>

            {/* Outline Preview — real Gemini data */}
            <div className="rounded-[28px] bg-[#243140] border border-white/5 p-5 space-y-4 shadow-md">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Mundarija (Reja)
              </h3>

              <ul className="space-y-2.5 text-sm">
                {result.outline.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300">
                    <span className="text-cyan-400 text-xs shrink-0 mt-0.5">
                      {romanNumerals[idx] ?? idx + 1}.
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-3 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
                <span>📖 Bo'limlar soni: {result.outline.length} ta</span>
                <span>📋 Times New Roman 14pt formatda</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("📥 Hujjat yuklab olish simulyatsiyasi boshlandi. 'TalabaAI-Referat.docx' yuklab olinmoqda.");
                }}
                className="
                  w-full py-4 rounded-[20px] bg-white text-black font-bold text-center block text-sm active:scale-95 transition-transform shadow-md
                "
              >
                📥 Word (.docx) yuklab olish
              </a>

              <button
                onClick={triggerTelegramSend}
                disabled={isTelegramSent}
                className={`
                  w-full py-4 rounded-[20px] font-bold text-center text-sm active:scale-95 transition-all shadow-md border
                  ${
                    isTelegramSent
                      ? "bg-[#1b2635] text-slate-500 border-white/10 cursor-not-allowed"
                      : "bg-[#243140] text-white border-white/10 hover:bg-slate-700"
                  }
                `}
              >
                {isTelegramSent ? "📨 Yuborildi" : "📨 Telegramga yuborish"}
              </button>

              <button
                onClick={() => {
                  setShowResult(false);
                  setResult(null);
                  setTopic("");
                }}
                className="
                  w-full py-3.5 rounded-[20px] bg-transparent text-slate-400 font-semibold text-center block text-xs hover:text-white transition-colors
                "
              >
                🔄 Yangi referat yozish
              </button>
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
