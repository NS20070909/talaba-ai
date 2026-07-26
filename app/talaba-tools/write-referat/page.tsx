"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  { id: "cs",          name: "Kiberxavfsizlik" },
  { id: "history",     name: "O'zbekiston tarixi" },
  { id: "econ",        name: "Iqtisodiyot nazariyasi" },
  { id: "math",        name: "Oliy matematika" },
  { id: "philosophy",  name: "Falsafa" },
  { id: "ecology",     name: "Ekologiya" },
  { id: "custom",      name: "Boshqa (O'zingiz yozasiz)" },
];

// Stage labels shown to user during DOCX generation
const DOCX_STAGES = [
  "Tayyorlanmoqda...",
  "Mundarija yaratilmoqda...",
  "Kirish yozilmoqda...",
  "1-bob yozilmoqda...",
  "2-bob yozilmoqda...",
  "3-bob yozilmoqda...",
  "Xulosa yozilmoqda...",
  "DOCX formatlanmoqda...",
  "Tayyor! ✅",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getLimitsForPlan = (plan: string) => {
  switch (plan) {
    case "FREE":                   return { name: "Free",    min: 3, max: 4 };
    case "DAY":   case "STARTER":  return { name: "Starter", min: 5, max: 8 };
    case "WEEK":  case "STUDENT":  return { name: "Weekly",  min: 5, max: 15 };
    case "MONTH": case "PREMIUM":  return { name: "Premium", min: 5, max: 20 };
    case "QUARTER": case "PRO":    return { name: "Pro",     min: 5, max: 30 };
    case "YEAR":  case "ELITE":    return { name: "Elite",   min: 5, max: Infinity };
    default:                       return { name: "Free",    min: 3, max: 4 };
  }
};

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("limit") || msg.includes("tugagan"))
    return "Bugungi referat limitingiz tugagan. Ertaga yana urinib ko'ring yoki tarifni yangilang.";
  if (msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted"))
    return "AI xizmati vaqtincha band. Bir necha daqiqadan so'ng qayta urinib ko'ring.";
  if (msg.includes("timeout") || msg.includes("etimedout") || msg.includes("fetch failed"))
    return "So'rov vaqti tugadi. Internet aloqangizni tekshirib, qayta urinib ko'ring.";
  if (msg.includes("bloklangan") || msg.includes("403"))
    return "Kirish rad etildi. Iltimos admin bilan bog'laning.";
  if (msg.includes("generatsiyasi muvaffaqiyatsiz"))
    return "Referat yaratishda xatolik yuz berdi. Qayta urinib ko'ring.";
  if (msg.includes("topic is required") || msg.includes("mavzu"))
    return "Referat mavzusini kiriting.";
  if (msg.includes("server configuration"))
    return "Server xatosi yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.";
  return raw || "Noma'lum xato yuz berdi. Qayta urinib ko'ring.";
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} soniya`;
  return `${Math.floor(s / 60)} daq ${s % 60} son`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutlineResult {
  title: string;
  outline: string[];
  model: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WriteReferatPage() {
  // Form
  const [topic,           setTopic]           = useState("");
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0].id);
  const [customSubject,   setCustomSubject]   = useState("");
  const [language,        setLanguage]        = useState("uz");
  const [userPlan,        setUserPlan]        = useState("FREE");
  const [pagesVal,        setPagesVal]        = useState("3");
  const pagesCount = parseInt(pagesVal, 10) || 0;

  // Outline phase
  const [loading,        setLoading]        = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showOutline,    setShowOutline]    = useState(false);
  const [result,         setResult]         = useState<OutlineResult | null>(null);

  // Editable outline (seeded from result.outline; user can modify before generating)
  const [editableOutline, setEditableOutline] = useState<string[]>([]);
  const [editingIdx,      setEditingIdx]      = useState<number | null>(null);
  const [editingText,     setEditingText]     = useState("");
  const [newItemText,     setNewItemText]     = useState("");

  // DOCX generation phase
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [docxStageIdx,   setDocxStageIdx]   = useState(0);
  const docxStageTimer   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cached DOCX blob — reused for both download and Telegram send to avoid double generation
  const cachedBlob = useRef<Blob | null>(null);

  // Success state
  const [docxReady,      setDocxReady]      = useState(false);
  const [generationTime, setGenerationTime] = useState(0); // elapsed ms

  // Telegram delivery
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSent,    setTelegramSent]    = useState(false);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Tracks whether DOCX generation is currently running (ref so async callbacks read live value)
  const generatingDocxRef = useRef(false);

  // Guard against duplicate requests
  const inFlight = useRef(false);

  // ── Plan data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const userId = localStorage.getItem("telegram_user_id");
    if (!userId) return;
    fetch(`/api/user-stats?telegram_id=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.stats) setUserPlan(d.stats.plan || "FREE"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const limits = getLimitsForPlan(userPlan);
    setPagesVal(limits.min.toString());
  }, [userPlan]);

  const planLimits = getLimitsForPlan(userPlan);
  const isExceeded = pagesCount > planLimits.max;
  const isInvalid  = pagesCount < planLimits.min || isExceeded;

  const getSubjectName = () =>
    selectedSubject === "custom"
      ? (customSubject.trim() || "Erkin mavzu")
      : (SUBJECTS.find((s) => s.id === selectedSubject)?.name || "Erkin mavzu");

  // ── Outline editor helpers ─────────────────────────────────────────────────

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingText(editableOutline[idx]);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      setEditableOutline((prev) => prev.map((v, i) => (i === editingIdx ? trimmed : v)));
    }
    setEditingIdx(null);
    setEditingText("");
  };

  const deleteItem = (idx: number) => {
    setEditableOutline((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) { setEditingIdx(null); setEditingText(""); }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setEditableOutline((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    setEditableOutline((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const addItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setEditableOutline((prev) => [...prev, trimmed]);
    setNewItemText("");
  };

  // ── DOCX stage progress timer ──────────────────────────────────────────────

  const startDocxStageTimer = useCallback(() => {
    setDocxStageIdx(0);
    let idx = 0;
    docxStageTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, DOCX_STAGES.length - 2);
      setDocxStageIdx(idx);
    }, 7000);
  }, []);

  const stopDocxStageTimer = useCallback(() => {
    if (docxStageTimer.current) {
      clearInterval(docxStageTimer.current);
      docxStageTimer.current = null;
    }
    setDocxStageIdx(DOCX_STAGES.length - 1);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (docxStageTimer.current) clearInterval(docxStageTimer.current);
  }, []);

  // ── Step 1: Outline generation ─────────────────────────────────────────────

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || inFlight.current) return;

    inFlight.current = true;
    setShowOutline(false);
    setResult(null);
    setEditableOutline([]);
    setDocxReady(false);
    setTelegramSent(false);
    cachedBlob.current = null;
    setError(null);
    setLoading(true);
    setLoadingMessage("Tayyorlanmoqda...");

    const telegramUserId = localStorage.getItem("telegram_user_id");

    try {
      setLoadingMessage("Mundarija yaratilmoqda...");

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

      setLoadingMessage("Natija tayyorlanmoqda...");

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Serverdan xato javob keldi.");

      setResult({ title: data.title, outline: data.outline, model: data.model });
      setEditableOutline([...data.outline]);
      setShowOutline(true);

      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      setError(friendlyError(msg));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // ── Step 2: DOCX fetch (shared — cached after first call) ─────────────────

  const fetchDocxBlob = async (): Promise<Blob> => {
    if (cachedBlob.current) return cachedBlob.current;

    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) throw new Error("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");

    const res = await fetch("/api/write-referat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: topic.trim(),
        subject: getSubjectName(),
        language,
        pages: pagesCount,
        outline: editableOutline,
        telegram_user_id: telegramUserId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || `Server xatosi (${res.status})`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error("Bo'sh fayl keldi. Qayta urinib ko'ring.");
    cachedBlob.current = blob;
    return blob;
  };

  // ── Step 2a: Download ──────────────────────────────────────────────────────

  const handleDownloadDocx = async () => {
    if (!result || inFlight.current) return;

    inFlight.current = true;
    generatingDocxRef.current = true;
    setGeneratingDocx(true);
    setDocxReady(false);
    setError(null);
    startDocxStageTimer();

    const t0 = Date.now();

    try {
      const blob = await fetchDocxBlob();
      stopDocxStageTimer();

      const url = window.URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `TalabaAI-Referat-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setGenerationTime(Date.now() - t0);
      setDocxReady(true);
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      stopDocxStageTimer();
      setError(friendlyError(msg));
    } finally {
      generatingDocxRef.current = false;
      setGeneratingDocx(false);
      inFlight.current = false;
    }
  };

  // ── Step 2b: Send to Telegram ─────────────────────────────────────────────

  const handleSendTelegram = async () => {
    if (!result || inFlight.current || telegramSent) return;

    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) {
      setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }

    inFlight.current = true;
    setSendingTelegram(true);
    setError(null);

    const t0 = Date.now();

    // If blob not cached yet, show DOCX generation progress
    const needsDocxFetch = !cachedBlob.current;
    if (needsDocxFetch) {
      generatingDocxRef.current = true;
      setGeneratingDocx(true);
      startDocxStageTimer();
    }

    try {
      const blob = await fetchDocxBlob();

      if (needsDocxFetch) {
        stopDocxStageTimer();
        generatingDocxRef.current = false;
        setGeneratingDocx(false);
      }

      // Blob → base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes       = new Uint8Array(arrayBuffer);
      // Use chunked approach to avoid call-stack overflow on large files
      const CHUNK = 8192;
      let binary  = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.slice(i, i + CHUNK));
      }
      const base64 = btoa(binary);

      const res = await fetch("/api/send-referat-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          telegram_user_id: telegramUserId,
          caption: `✅ "${result.title}" referati tayyor!\n\n📄 Til: ${language.toUpperCase()}\n📏 Hajm: ${pagesVal} bet\n\n🤖 TalabaAI tomonidan yaratildi.`,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Telegram yuborishda xatolik.");

      setTelegramSent(true);
      if (!docxReady) {
        setGenerationTime(Date.now() - t0);
        setDocxReady(true);
      }
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      if (needsDocxFetch && generatingDocxRef.current) {
        stopDocxStageTimer();
        generatingDocxRef.current = false;
        setGeneratingDocx(false);
      }
      setError(friendlyError(msg));
    } finally {
      setSendingTelegram(false);
      inFlight.current = false;
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setShowOutline(false);
    setResult(null);
    setEditableOutline([]);
    setDocxReady(false);
    setTelegramSent(false);
    cachedBlob.current = null;
    setTopic("");
    setError(null);
    setEditingIdx(null);
    setNewItemText("");
    setGenerationTime(0);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const isAnyBusy    = loading || generatingDocx || sendingTelegram;
  const romanNumerals = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#0f1724] text-white selection:bg-cyan-500/30">
      <div className="max-w-md mx-auto px-4 py-4 pb-12">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/talaba-tools"
            className="h-11 w-11 rounded-[16px] bg-[#243140] border border-white/5 flex items-center justify-center text-lg hover:bg-slate-700 transition-colors shrink-0"
          >
            ←
          </Link>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Referat Yozish</h1>
            <p className="text-slate-400 text-xs">AI yordamida akademik referat yaratish</p>
          </div>
        </div>

        {/* ── Input Form ── */}
        {!loading && !showOutline && (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="rounded-[28px] bg-[#243140] border border-cyan-500/10 p-5 space-y-5 shadow-lg">

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
                  className="w-full bg-[#1b2635] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all text-sm resize-none"
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
                  className="w-full bg-[#1b2635] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-cyan-400 transition-all text-sm"
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-[#1b2635]">{sub.name}</option>
                  ))}
                </select>
                {selectedSubject === "custom" && (
                  <input
                    type="text"
                    required
                    placeholder="Fanning nomini yozing..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full mt-2.5 bg-[#1b2635] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition-all text-sm"
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
                    { code: "ru", label: "Русский",   flag: "🇷🇺" },
                    { code: "en", label: "English",   flag: "🇬🇧" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`py-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                        language === lang.code
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                          : "bg-[#1b2635] border-white/15 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pages */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                  Sahifalar soni
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPagesVal(Math.max(1, (parseInt(pagesVal,10)||0) - 1).toString())}
                    className="h-12 w-12 rounded-2xl bg-[#1b2635] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-cyan-400"
                  >−</button>
                  <input
                    type="number"
                    value={pagesVal}
                    onChange={(e) => setPagesVal(e.target.value)}
                    min={1}
                    className="flex-1 h-12 text-center bg-[#1b2635] border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-cyan-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setPagesVal(((parseInt(pagesVal,10)||0) + 1).toString())}
                    className="h-12 w-12 rounded-2xl bg-[#1b2635] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-cyan-400"
                  >+</button>
                </div>

                {/* Plan info */}
                <div className="mt-3 p-4 rounded-[20px] bg-[#1b2635]/60 border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Joriy tarif:</span>
                    <span className="text-cyan-400 font-extrabold">{planLimits.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ruxsat etilgan:</span>
                    <span className="text-slate-200 font-bold">
                      {planLimits.max === Infinity ? "Cheksiz" : `${planLimits.min}–${planLimits.max} bet`}
                    </span>
                  </div>
                </div>

                {isExceeded && (
                  <div className="mt-3 p-4 rounded-[20px] bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                    <p className="text-amber-400 font-semibold leading-relaxed">
                      ⚠️ Sizning tarifingizda maksimal {planLimits.max === Infinity ? "cheksiz" : planLimits.max} sahifa. Kattaroq referat uchun tarifni yangilang.
                    </p>
                    <Link
                      href="/premium"
                      className="block w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-center shadow-md active:scale-95 transition-all"
                    >
                      👑 Tarifni Yangilash
                    </Link>
                  </div>
                )}

                {!isExceeded && pagesCount < planLimits.min && (
                  <div className="mt-3 p-3 rounded-[20px] bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-semibold">
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
              disabled={!topic.trim() || isInvalid || inFlight.current}
              className={`w-full py-4 rounded-[20px] font-bold text-center text-sm shadow-md transition-all ${
                isExceeded
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed"
                  : isInvalid
                  ? "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
                  : topic.trim()
                  ? "bg-cyan-500 hover:bg-cyan-400 text-black active:scale-95 shadow-cyan-500/20"
                  : "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
              }`}
            >
              {isExceeded ? "👑 Tarifni yangilang" : "✨ AI Referat Yozish"}
            </button>
          </form>
        )}

        {/* ── Outline Loading Spinner ── */}
        {loading && (
          <div className="rounded-[28px] bg-[#243140] border border-cyan-500/10 p-10 text-center space-y-6 shadow-xl my-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-fuchsia-500/10 border-t-fuchsia-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-400">Mundarija tayyorlanmoqda</h3>
              <p className="text-xs text-slate-400 italic">{loadingMessage}</p>
            </div>
            <div className="w-full bg-[#1b2635] h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full animate-pulse w-2/3" />
            </div>
            <p className="text-[10px] text-slate-500">Iltimos sahifadan chiqmang.</p>
          </div>
        )}

        {/* ── Outline + Editor ── */}
        {showOutline && !loading && result && (
          <div className="space-y-4">

            {/* Title card */}
            <div className="rounded-[28px] bg-[#243140] border border-emerald-500/20 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0">✅</div>
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Mundarija Yaratildi</span>
                  <h2 className="text-base font-bold leading-tight break-words">{result.title}</h2>
                  <p className="text-xs text-slate-400">
                    {getSubjectName()} · {language.toUpperCase()} · {pagesVal} bet
                  </p>
                </div>
              </div>
            </div>

            {/* Editable outline */}
            <div className="rounded-[28px] bg-[#243140] border border-white/5 p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mundarija
                  {!isAnyBusy && <span className="ml-1 text-slate-500 normal-case font-normal">(tahrirlash mumkin)</span>}
                </h3>
                <span className="text-[10px] text-slate-500">{editableOutline.length} ta bo'lim</span>
              </div>

              {editableOutline.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2">Bo'lim topilmadi. Quyida qo'shing.</p>
              )}

              <ul className="space-y-2">
                {editableOutline.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 group">
                    <span className="text-cyan-400 text-xs shrink-0 mt-2.5 w-5 text-right">
                      {romanNumerals[idx] ?? idx + 1}.
                    </span>

                    {editingIdx === idx ? (
                      <div className="flex-1 flex gap-1.5">
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                            if (e.key === "Escape") { setEditingIdx(null); }
                          }}
                          className="flex-1 bg-[#1b2635] border border-cyan-400/50 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400 transition-all"
                        />
                        <button
                          type="button"
                          onClick={commitEdit}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-colors"
                        >✓</button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-start gap-1.5">
                        <span
                          className={`flex-1 text-sm py-1.5 break-words transition-colors ${
                            isAnyBusy ? "text-slate-400 cursor-default" : "text-slate-300 cursor-pointer hover:text-white"
                          }`}
                          onClick={() => !isAnyBusy && startEdit(idx)}
                        >
                          {item}
                        </span>
                        {!isAnyBusy && (
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            <button
                              type="button"
                              onClick={() => moveUp(idx)}
                              disabled={idx === 0}
                              title="Yuqoriga"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-30 text-xs"
                            >↑</button>
                            <button
                              type="button"
                              onClick={() => moveDown(idx)}
                              disabled={idx === editableOutline.length - 1}
                              title="Pastga"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-30 text-xs"
                            >↓</button>
                            <button
                              type="button"
                              onClick={() => startEdit(idx)}
                              title="Tahrirlash"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors text-xs"
                            >✏️</button>
                            <button
                              type="button"
                              onClick={() => deleteItem(idx)}
                              title="O'chirish"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors text-xs"
                            >🗑</button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Add new item */}
              {!isAnyBusy && (
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <input
                    type="text"
                    placeholder="Yangi bo'lim qo'shing..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); }}}
                    className="flex-1 bg-[#1b2635] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={!newItemText.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    + Qo'sh
                  </button>
                </div>
              )}
            </div>

            {/* DOCX generation progress */}
            {generatingDocx && (
              <div className="rounded-[24px] bg-[#243140] border border-cyan-500/10 p-6 text-center space-y-4">
                <div className="relative w-14 h-14 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-xl">📄</div>
                </div>
                <div>
                  <p className="text-sm font-bold text-cyan-400">Referat yozilmoqda...</p>
                  <p className="text-xs text-slate-400 italic mt-1">{DOCX_STAGES[docxStageIdx]}</p>
                </div>
                {/* Stage dots */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {DOCX_STAGES.map((_, i) => (
                    <span
                      key={i}
                      className={`rounded-full transition-all duration-500 ${
                        i <= docxStageIdx ? "w-2 h-2 bg-cyan-400" : "w-1.5 h-1.5 bg-white/15"
                      }`}
                    />
                  ))}
                </div>
                {/* Progress bar */}
                <div className="w-full bg-[#1b2635] h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full transition-all duration-700"
                    style={{ width: `${((docxStageIdx + 1) / DOCX_STAGES.length) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">Bu amal 30–60 soniya. Sahifadan chiqmang.</p>
              </div>
            )}

            {/* Telegram sending indicator */}
            {sendingTelegram && !generatingDocx && (
              <div className="rounded-[24px] bg-[#243140] border border-cyan-500/10 p-5 text-center space-y-2">
                <div className="text-2xl animate-pulse">📨</div>
                <p className="text-sm font-semibold text-cyan-400">Telegramga yuborilmoqda...</p>
                <p className="text-[10px] text-slate-500">Iltimos kuting.</p>
              </div>
            )}

            {/* Success state */}
            {docxReady && !generatingDocx && !sendingTelegram && (
              <div className="rounded-[24px] bg-emerald-500/10 border border-emerald-500/20 p-5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">🎉</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Hujjat muvaffaqiyatli yaratildi!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {result.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language.toUpperCase()} · {pagesVal} bet
                      {generationTime > 0 && ` · ${fmtDuration(generationTime)}`}
                    </p>
                  </div>
                </div>
                {telegramSent && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-emerald-500/10 pt-2.5">
                    <span className="text-emerald-400">✓</span>
                    <span>Telegram chatingizga yuborildi</span>
                  </div>
                )}
              </div>
            )}

            {/* Error with Retry */}
            {error && !generatingDocx && !sendingTelegram && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-2">
                <p className="text-red-400 text-xs leading-relaxed">⚠️ {error}</p>
                <button
                  type="button"
                  onClick={() => { setError(null); handleDownloadDocx(); }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  Qayta urinib ko'ring →
                </button>
              </div>
            )}

            {/* Actions */}
            {!generatingDocx && !sendingTelegram && (
              <div className="space-y-2 pt-1">
                {/* Download */}
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  disabled={isAnyBusy}
                  className="w-full py-4 rounded-[20px] bg-white text-black font-bold text-center text-sm active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📥 Word (.docx) yuklab olish
                </button>

                {/* Telegram */}
                <button
                  type="button"
                  onClick={handleSendTelegram}
                  disabled={isAnyBusy || telegramSent}
                  className={`w-full py-4 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                    telegramSent
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                      : "bg-[#243140] border-white/10 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {telegramSent ? "✅ Telegramga yuborildi" : "📨 Telegramga yuborish"}
                </button>

                {/* Reset */}
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isAnyBusy}
                  className="w-full py-3.5 rounded-[20px] bg-transparent text-slate-400 font-semibold text-center text-xs hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🔄 Yangi referat yozish
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
