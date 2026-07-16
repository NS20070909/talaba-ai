"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

// Mock subjects for dropdown
const SUBJECTS = [
  { id: "cs", name: "Kiberxavfsizlik" },
  { id: "history", name: "O'zbekiston tarixi" },
  { id: "econ", name: "Iqtisodiyot nazariyasi" },
  { id: "math", name: "Oliy matematika" },
  { id: "philosophy", name: "Falsafa" },
  { id: "ecology", name: "Ekologiya" },
  { id: "custom", name: "Boshqa (O'zingiz yozasiz)" },
];

// Mock size options
const SIZES = [
  { label: "Kichik (5-10 bet)", value: "5-10", desc: "Tezkor va lo'nda referatlar uchun" },
  { label: "O'rtacha (10-15 bet)", value: "10-15", desc: "Standart OTM talablari uchun" },
  { label: "Katta (15-20 bet)", value: "15-20", desc: "Batafsil tahlil va tadqiqotlar uchun" },
];

export default function WriteReferatPage() {
  // Form states
  const [topic, setTopic] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0].id);
  const [customSubject, setCustomSubject] = useState("");
  const [language, setLanguage] = useState("uz");
  const [size, setSize] = useState("10-15");
  
  // Interactive UX states
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isTelegramSent, setIsTelegramSent] = useState(false);

  // Loading animation step messages
  const steps = [
    "AI mavzuni tahlil qilmoqda...",
    "Reja va mundarija shakllantirilmoqda...",
    "Boblar bo'yicha ilmiy matnlar yozilmoqda...",
    "OTM standartlari bo'yicha formatlanmoqda...",
    "Word (.docx) hujjati tayyorlanmoqda...",
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < steps.length - 1) {
            return prev + 1;
          } else {
            clearInterval(interval);
            setLoading(false);
            setShowResult(true);
            return 0;
          }
        });
      }, 1500); // changes step every 1.5s
    }
    return () => clearInterval(interval);
  }, [loading, steps.length]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    setShowResult(false);
    setIsTelegramSent(false);
    setLoading(true);
    setLoadingStep(0);
  };

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

              {/* Size Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Hajm (Sahifalar soni)
                </label>
                <div className="space-y-2">
                  {SIZES.map((s) => (
                    <label
                      key={s.value}
                      onClick={() => setSize(s.value)}
                      className={`
                        flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all
                        ${
                          size === s.value
                            ? "bg-cyan-500/10 border-cyan-400/40 shadow-sm"
                            : "bg-[#1b2635] border-white/10 opacity-70 hover:opacity-100"
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="size"
                        value={s.value}
                        checked={size === s.value}
                        onChange={() => {}}
                        className="accent-cyan-400 h-4 w-4"
                      />
                      <div className="flex-1">
                        <span className="block text-xs font-bold text-white">
                          {s.label}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {s.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* Actions */}
            <button
              type="submit"
              disabled={!topic.trim()}
              className={`
                w-full py-4 rounded-[20px] font-bold text-center text-sm shadow-md transition-all
                ${
                  topic.trim()
                    ? "bg-cyan-500 hover:bg-cyan-400 text-black active:scale-95 shadow-cyan-500/10"
                    : "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
                }
              `}
            >
              ✨ AI Referat Yozish
            </button>
          </form>
        )}

        {/* Loading / Generating State */}
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
                {steps[loadingStep]}
              </p>
            </div>

            {/* Loading Indicator Bar */}
            <div className="w-full bg-[#1b2635] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full transition-all duration-300"
                style={{ width: `${((loadingStep + 1) / steps.length) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Bu amal taxminan 5-10 soniya vaqt oladi. Iltimos sahifadan chiqmang.
            </p>
          </div>
        )}

        {/* Result Screen */}
        {showResult && !loading && (
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
                    {topic}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fan: {getSubjectName()} • Til: {language.toUpperCase()} • Hajm: {size} bet
                  </p>
                </div>
              </div>
            </div>

            {/* Outline Preview */}
            <div className="rounded-[28px] bg-[#243140] border border-white/5 p-5 space-y-4 shadow-md">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Mundarija (Reja)
              </h3>
              
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 text-xs">I.</span>
                  <span className="font-medium">Kirish</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 text-xs">II.</span>
                  <span>{getSubjectName()} fanining umumiy prinsiplari</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 text-xs">III.</span>
                  <span>Mavzuning amaliy tahlili va muammolari</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 text-xs">IV.</span>
                  <span>Rivojlantirish istiqbollari va xulosalar</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <span className="text-cyan-400 text-xs">V.</span>
                  <span className="text-slate-400">Foydalanilgan adabiyotlar ro'yxati</span>
                </li>
              </ul>

              <div className="pt-3 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
                <span>📖 Adabiyotlar soni: 7 ta</span>
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
