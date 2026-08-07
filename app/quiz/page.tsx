"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  QuizQuestion,
  QuizConfig,
  ParsedQuizResult,
  QuizHistoryRecord,
} from "@/lib/quiz/types";

const BATCH_PRESETS = [20, 25, 30, 40, 50, 100];
const TIMER_PRESETS = [
  { label: "♾ Cheksiz", value: 0 },
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
];

export default function QuizPage() {
  /* ── Tab ──────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<"builder" | "stats" | "history">("builder");

  /* ── Input mode ───────────────────────────────────────────── */
  const [inputMode, setInputMode] = useState<"upload" | "text">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [telegramId, setTelegramId] = useState<string>("");
  const dropzoneRef = useRef<HTMLDivElement>(null);

  /* ── Flow step: INPUT → RESULT ────────────────────────────── */
  const [builderStep, setBuilderStep] = useState<"INPUT" | "RESULT">("INPUT");

  /* ── Processing state ─────────────────────────────────────── */
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isSendingTg, setIsSendingTg] = useState(false);

  /* ── Parsed data ──────────────────────────────────────────── */
  const [parsedData, setParsedData] = useState<ParsedQuizResult | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  /* ── Simple config: batch + timer + advanced ──────────────── */
  const [batchSize, setBatchSize] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(30);

  const [quizTitle, setQuizTitle] = useState("");

  /* ── Stats & History ──────────────────────────────────────── */
  const [historyList, setHistoryList] = useState<QuizHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);

  /* ── Session resume ───────────────────────────────────────── */
  const [activeSessionPrompt, setActiveSessionPrompt] = useState<any | null>(null);

  /* ── Toast ────────────────────────────────────────────────── */
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  /* ── Reset builder ────────────────────────────────────────── */
  const resetBuilder = () => {
    setBuilderStep("INPUT");
    setParsedData(null);
    setQuestions([]);
    setSelectedFile(null);
    setPastedText("");
    setQuizTitle("");

    setBatchSize(25);
    setTimerSeconds(30);
  };

  /* ── Telegram ID init ─────────────────────────────────────── */
  const checkActiveSession = useCallback(async (tgId: string) => {
    try {
      const res = await fetch(`/api/quiz/session?telegram_id=${tgId}`);
      const data = await res.json();
      if (data.success && data.hasActiveSession && data.session) {
        setActiveSessionPrompt(data.session);
      }
    } catch { }
  }, []);

  useEffect(() => {
    const savedTgId = localStorage.getItem("telegram_user_id") || "";
    setTelegramId(savedTgId);
    if (savedTgId) checkActiveSession(savedTgId);
  }, [checkActiveSession]);

  /* ── History ──────────────────────────────────────────────── */
  const loadHistory = useCallback(async () => {
    const tgId = localStorage.getItem("telegram_user_id");
    if (!tgId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/quiz/history?telegram_id=${tgId}`);
      const data = await res.json();
      if (data.success && data.history) setHistoryList(data.history);
    } catch { } finally {
      setLoadingHistory(false);
    }
  }, []);

  /* ── Stats ────────────────────────────────────────────────── */
  const loadStats = useCallback(async () => {
    const tgId = localStorage.getItem("telegram_user_id");
    try {
      const url = tgId
        ? `/api/quiz/gamification?telegram_id=${tgId}`
        : `/api/quiz/gamification?mode=leaderboard`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setStatsData(data.stats || null);
    } catch { }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (activeTab === "history") loadHistory();
    if (activeTab === "stats") { loadStats(); loadHistory(); }
  }, [activeTab, loadHistory, loadStats]);

  /* ── Clipboard paste ──────────────────────────────────────── */
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== "builder" || builderStep !== "INPUT") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const ext = items[i].type.split("/")[1] || "png";
          const file = new File([blob], `paste_${Date.now()}.${ext}`, { type: items[i].type });
          setSelectedFile(file);
          setInputMode("upload");
          showToast("🖼 Rasm qo'yildi!");
          return;
        }
      }
      for (let i = 0; i < items.length; i++) {
        if (items[i].type === "text/plain") {
          items[i].getAsString((text) => {
            if (!text.trim()) return;
            setPastedText(text);
            setInputMode("text");
            showToast("📝 Matn qo'yildi!");
          });
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTab, builderStep]);

  /* ── Drag & Drop ──────────────────────────────────────────── */
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); setInputMode("upload"); showToast(`📄 ${file.name}`); }
  };

  /* ── Parse ────────────────────────────────────────────────── */
  const handleStartParse = async () => {
    const tgId = telegramId || localStorage.getItem("telegram_user_id");
    if (!tgId) { alert("Telegram orqali kiring."); return; }
    if (inputMode === "upload" && !selectedFile) { alert("Fayl tanlang!"); return; }
    if (inputMode === "text" && !pastedText.trim()) { alert("Matn kiriting!"); return; }

    const controller = new AbortController();
    setAbortController(controller);
    setIsProcessing(true);
    setProgressStep("📤 Fayl yuklanmoqda...");

    try {
      let res: Response;
      if (inputMode === "upload" && selectedFile) {
        const formData = new FormData();
        formData.append("telegram_id", tgId);
        formData.append("file", selectedFile);
        setProgressStep("🔍 Matn ajratilmoqda...");
        res = await fetch("/api/quiz/parse", { method: "POST", body: formData, signal: controller.signal });
      } else {
        setProgressStep("🧠 Savollar tahlil qilinmoqda...");
        res = await fetch("/api/quiz/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegram_id: tgId, text: pastedText, file_name: "Text_Input.txt" }),
          signal: controller.signal,
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || data.message || "Tahlil qilishda xatolik");

      const result: ParsedQuizResult = data.result;
      setParsedData(result);
      setQuestions(result.questions);
      setQuizTitle(result.title || "Yangi Test");

      // Auto-select best batch size
      const total = result.questions.length;
      const autoBatch = BATCH_PRESETS.find(b => b <= total) || BATCH_PRESETS[1];
      setBatchSize(autoBatch);

      setBuilderStep("RESULT");
      showToast(`✅ ${result.questions.length} ta savol topildi!`);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const rawMsg = String(err?.message || "").toLowerCase();
        if (rawMsg.includes("limit") || rawMsg.includes("403")) {
          showToast("⚠️ Kunlik Quiz limiti tugagan. Premium tarifga o'ting!");
        } else if (rawMsg.includes("empty") || rawMsg.includes("400")) {
          showToast("📄 Fayl yoki matn bo'sh. Boshqa fayl yuboring.");
        } else {
          showToast("❌ Tahlil qilib bo'lmadi. Qayta urinib ko'ring.");
        }
      }
    } finally {
      setIsProcessing(false);
      setProgressStep("");
      setAbortController(null);
    }
  };

  /* ── Send to Telegram ─────────────────────────────────────── */
  const handleSendToTelegram = async (
    overrideQuestions?: QuizQuestion[],
    overrideConfig?: QuizConfig,
    overrideTitle?: string
  ) => {
    const tgId = telegramId || localStorage.getItem("telegram_user_id");
    if (!tgId) { alert("Telegram user ID topilmadi"); return; }

    const sendQuestions = overrideQuestions || questions;
    const sendTitle = overrideTitle || quizTitle || parsedData?.title || "Yangi Test";
    const total = sendQuestions.length;
    const effectiveBatch = overrideConfig?.multiTestBatchSize || batchSize;
    const isMulti = total > effectiveBatch;

    const sendConfig: QuizConfig = overrideConfig || {
      title: sendTitle,
      builderMode: isMulti ? "MULTI" : "SINGLE",
      multiTestBatchSize: effectiveBatch,
      selectionMode: "ALL",
      shuffleQuestions: true,
      shuffleOptions: true,
      timerSeconds,
      splitBatchSize: 0,
      targetCount: total,
    };

    setIsSendingTg(true);
    try {
      const res = await fetch("/api/quiz/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: tgId,
          title: sendTitle,
          questions: sendQuestions,
          config: sendConfig,
          sourceFileName: parsedData?.sourceFileName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.error || "Yuborishda xatolik");
      showToast(data.message || "✅ Telegram-ga muvaffaqiyatli yuborildi!");
    } catch (err: any) {
      showToast(err.message || "❌ Xatolik yuz berdi");
    } finally {
      setIsSendingTg(false);
    }
  };

  /* ── Delete history ───────────────────────────────────────── */
  const handleDeleteHistory = async (id: string) => {
    const tgId = localStorage.getItem("telegram_user_id");
    if (!tgId) return;
    try {
      const res = await fetch(`/api/quiz/history?id=${id}&telegram_id=${tgId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setHistoryList(prev => prev.filter(i => i.id !== id));
        showToast("🗑 Tarixdan o'chirildi");
      }
    } catch { }
  };

  /* ── Derived ──────────────────────────────────────────────── */
  const testCount = Math.max(1, Math.ceil(questions.length / batchSize));
  const todayCount = historyList.filter(h => new Date(h.createdAt).toDateString() === new Date().toDateString()).length;
  const telegramSentCount = historyList.filter(h => h.telegramMessageIds && h.telegramMessageIds.length > 0).length;

  /* ─────────────────────────────────────────────────────────── */
  /* RENDER                                                      */
  /* ─────────────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen bg-[#090d16] text-white font-sans pb-24 overflow-x-hidden">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-[#101624]/90 backdrop-blur-md border-b border-slate-800 px-2 sm:px-4 py-2 sm:py-3.5 flex items-center justify-between gap-1 sm:gap-2">
        <Link href="/" className="text-slate-400 flex items-center gap-1 text-xs sm:text-sm font-semibold hover:text-white transition shrink-0">
          <span>←</span> <span className="hidden sm:inline">Bosh sahifa</span>
        </Link>
        <div
          onClick={() => setActiveTab("builder")}
          className="flex items-center gap-1 sm:gap-2 cursor-pointer select-none hover:opacity-90 transition min-w-0"
        >
          <span className="text-base sm:text-xl shrink-0">🧠</span>
          <h1 className="text-xs sm:text-base font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent truncate">
            Quiz Engine V3
          </h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setActiveTab("stats")}
            className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full transition flex items-center gap-1 whitespace-nowrap ${activeTab === "stats" ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300" : "bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20"}`}
          >
            <span>📊</span> <span>Stats</span>
          </button>
          <button
            onClick={() => { setActiveTab("history"); loadHistory(); }}
            className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-full transition flex items-center gap-1 whitespace-nowrap ${activeTab === "history" ? "bg-amber-500/20 border border-amber-500/40 text-amber-300" : "bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20"}`}
          >
            <span>📜</span> Tarix {historyList.length > 0 && `(${historyList.length})`}
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-2.5 sm:px-4 py-3 sm:py-5">

        {/* ── BUILDER TAB ── */}
        {activeTab === "builder" && (
          <div className="space-y-4">
            {/* Session Resume Banner */}
            {activeSessionPrompt && (
              <div className="bg-gradient-to-r from-violet-900/80 via-fuchsia-900/80 to-indigo-900/80 border border-violet-400 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <h3 className="font-extrabold text-sm text-white">Chala qolgan Quiz topildi!</h3>
                    <p className="text-xs text-violet-200 mt-0.5">
                      {activeSessionPrompt.fileName || "Quiz"} • {activeSessionPrompt.questions?.length || 0} ta savol
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const s = activeSessionPrompt;
                      if (s.questions?.length) {
                        setQuestions(s.questions);
                        const title = s.fileName ? s.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") : "Quiz";
                        setParsedData({
                          title,
                          sourceFileName: s.fileName,
                          rawText: s.rawText || "",
                          questions: s.questions,
                          overallValidation: { totalQuestions: s.questions.length, validQuestions: s.questions.length, flawedQuestions: 0, issues: [] },
                          parserMethod: "RULE",
                        });
                        setQuizTitle(title);
                        if (s.settings?.multiTestBatchSize) setBatchSize(s.settings.multiTestBatchSize);
                        if (s.settings?.timerSeconds !== undefined) setTimerSeconds(s.settings.timerSeconds);
                        setBuilderStep("RESULT");
                        showToast("🔄 Sessiya tiklandi!");
                      }
                      setActiveSessionPrompt(null);
                    }}
                    className="flex-1 py-2 rounded-xl font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 text-xs active:scale-95 transition"
                  >
                    ▶️ Davom ettirish
                  </button>
                  <button
                    onClick={async () => {
                      const tgId = telegramId || localStorage.getItem("telegram_user_id");
                      if (tgId) { try { await fetch(`/api/quiz/session?telegram_id=${tgId}`, { method: "DELETE" }); } catch { } }
                      setActiveSessionPrompt(null);
                    }}
                    className="px-4 py-2 rounded-xl font-bold bg-slate-800 text-slate-300 text-xs active:scale-95 transition"
                  >
                    ➕ Yangi
                  </button>
                </div>
              </div>
            )}

            {/* Processing bar */}
            {isProcessing && (
              <div className="bg-violet-950/40 border border-violet-500/40 rounded-2xl p-5 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-fuchsia-500/10 to-violet-500/5 animate-pulse" />
                <div className="relative">
                  <div className="text-3xl mb-2 animate-spin inline-block">⚙️</div>
                  <h3 className="font-extrabold text-xs text-violet-300">{progressStep}</h3>
                  <p className="text-[11px] text-slate-400 mt-1">Parser va AI tahlili davom etmoqda...</p>
                  <button
                    onClick={() => { abortController?.abort(); setIsProcessing(false); setProgressStep(""); showToast("🛑 Bekor qilindi."); }}
                    className="mt-3 px-4 py-1.5 rounded-full bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/40 hover:bg-red-500/30 transition"
                  >
                    🛑 Bekor qilish
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: INPUT ── */}
            {builderStep === "INPUT" && !isProcessing && (
              <div className="space-y-4">
                {/* Mode switcher */}
                <div className="flex bg-[#121927] p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setInputMode("upload")}
                    className={`flex-1 py-2.5 rounded-xl transition ${inputMode === "upload" ? "bg-violet-600 text-white shadow" : "text-slate-400"}`}
                  >
                    📁 Fayl yuklash
                  </button>
                  <button
                    onClick={() => setInputMode("text")}
                    className={`flex-1 py-2.5 rounded-xl transition ${inputMode === "text" ? "bg-violet-600 text-white shadow" : "text-slate-400"}`}
                  >
                    ✍️ Matn kiriting
                  </button>
                </div>

                {/* File dropzone */}
                {inputMode === "upload" && (
                  <div
                    ref={dropzoneRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-violet-500/30 bg-[#121927]/60 hover:bg-[#121927] hover:border-violet-500/60 rounded-3xl p-6 sm:p-10 text-center transition-all cursor-pointer group"
                  >
                    <input
                      type="file"
                      accept=".txt,.doc,.docx,.pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic"
                      className="hidden"
                      id="file-upload-input"
                      onChange={e => {
                        if (e.target.files?.length) {
                          setSelectedFile(e.target.files[0]);
                          showToast(`📄 ${e.target.files[0].name} qo'shildi!`);
                        }
                      }}
                    />
                    <label htmlFor="file-upload-input" className="cursor-pointer block">
                      <div className="text-5xl mb-3 group-hover:scale-110 transition">📄</div>
                      <h3 className="font-extrabold text-base text-slate-100">Test faylini tashlang</h3>
                      <p className="text-slate-400 text-xs mt-2">PDF · DOCX · TXT · XLSX · CSV · JPG · PNG</p>
                      <p className="text-slate-600 text-[11px] mt-1.5">
                        📎 Bosing yoki sudrang •{" "}
                        <kbd className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-slate-300">Ctrl+V</kbd>
                      </p>
                      {selectedFile && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                          ✅ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                          <button
                            type="button"
                            onClick={e => { e.preventDefault(); setSelectedFile(null); }}
                            className="ml-1 hover:text-rose-400 transition"
                          >✕</button>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {/* Text input */}
                {inputMode === "text" && (
                  <textarea
                    rows={8}
                    placeholder="Test savollarini bu yerga nusxalab yopishtiing..."
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    className="w-full bg-[#121927] border border-slate-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-violet-500 transition leading-relaxed font-mono"
                  />
                )}

                <button
                  id="btn-start-parse"
                  onClick={handleStartParse}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-2xl font-extrabold text-slate-900 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 hover:opacity-95 active:scale-95 disabled:opacity-50 transition shadow-lg shadow-violet-500/25 text-sm"
                >
                  ⚡ Testni Tahlil Qilish
                </button>
              </div>
            )}

            {/* ── STEP: RESULT ── */}
            {builderStep === "RESULT" && !isProcessing && (
              <div className="space-y-4">
                {/* Summary card */}
                <div className="bg-gradient-to-br from-violet-900/50 via-fuchsia-900/30 to-indigo-900/50 border border-violet-500/40 rounded-3xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[11px] text-violet-300 font-bold uppercase tracking-wider">✅ Tahlil yakunlandi</span>
                      <h2 className="font-extrabold text-lg text-white leading-tight mt-0.5">{quizTitle}</h2>
                    </div>
                    <button
                      id="btn-new-quiz"
                      onClick={resetBuilder}
                      className="text-slate-500 hover:text-slate-300 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-800/80 transition"
                    >
                      ✕ Yangi
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/20 rounded-2xl p-3">
                      <div className="text-xl font-extrabold text-emerald-400">{questions.length}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Jami savol</div>
                    </div>
                    <div className="bg-black/20 rounded-2xl p-3">
                      <div className="text-xl font-extrabold text-violet-300">{testCount}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Test soni</div>
                    </div>
                    <div className="bg-black/20 rounded-2xl p-3">
                      <div className="text-xl font-extrabold text-cyan-300">{parsedData?.parserMethod || "RULE"}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Algoritm</div>
                    </div>
                  </div>
                </div>

                {/* Batch size picker */}
                <div className="bg-[#121927] border border-slate-800 rounded-3xl p-5 space-y-3">
                  <div>
                    <label className="text-sm font-extrabold text-slate-100 block mb-0.5">📦 Har bir test nechta savoldan?</label>
                    <p className="text-xs text-slate-400">
                      {questions.length} ÷ {batchSize} = <strong className="text-emerald-400">{testCount} ta test</strong>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {BATCH_PRESETS.map(b => {
                      const cnt = Math.ceil(questions.length / b);
                      const isDisabled = b > questions.length && b !== BATCH_PRESETS[0];
                      return (
                        <button
                          key={b}
                          id={`btn-batch-${b}`}
                          disabled={isDisabled}
                          onClick={() => setBatchSize(b)}
                          className={`py-3.5 rounded-2xl font-bold text-xs transition flex flex-col items-center gap-0.5 ${
                            batchSize === b
                              ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 scale-105"
                              : isDisabled
                                ? "bg-slate-800/30 text-slate-700 cursor-not-allowed"
                                : "bg-[#090d16] border border-slate-800 text-slate-300 hover:border-violet-500/50 hover:text-white"
                          }`}
                        >
                          <span className="text-lg font-extrabold">{b}</span>
                          <span className="text-[10px] opacity-70">{cnt > 0 ? `${cnt} test` : "-"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timer picker */}
                <div className="bg-[#121927] border border-slate-800 rounded-3xl p-5 space-y-3">
                  <label className="text-sm font-extrabold text-slate-100 block">⏱ Taymer (har bir savolga)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIMER_PRESETS.map(t => (
                      <button
                        key={t.value}
                        id={`btn-timer-${t.value}`}
                        onClick={() => setTimerSeconds(t.value)}
                        className={`py-3.5 rounded-2xl font-bold text-xs transition ${
                          timerSeconds === t.value
                            ? "bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-lg shadow-cyan-500/30 scale-105"
                            : "bg-[#090d16] border border-slate-800 text-slate-300 hover:border-cyan-500/50 hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Send to Telegram */}
                <button
                  id="btn-send-telegram"
                  onClick={() => handleSendToTelegram()}
                  disabled={isSendingTg || questions.length === 0}
                  className="w-full py-4 rounded-2xl font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-400 hover:opacity-95 active:scale-95 disabled:opacity-50 transition shadow-lg shadow-emerald-500/25 text-sm flex items-center justify-center gap-2"
                >
                  {isSendingTg
                    ? <><span className="animate-spin inline-block">⏳</span> Yuborilmoqda...</>
                    : <>✈️ Telegram-ga Yuborish {testCount > 1 ? `(${testCount} ta test)` : `(${questions.length} savol)`}</>
                  }
                </button>

                <button
                  onClick={resetBuilder}
                  className="w-full py-2.5 rounded-2xl font-bold bg-slate-800/60 hover:bg-slate-800 text-slate-400 text-xs transition"
                >
                  ← Orqaga (yangi fayl)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <div className="space-y-4 mt-2">
            <div className="flex justify-between items-center">
              <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                <span>📜</span> Quizlar Tarixi
              </h2>
              <button onClick={() => setActiveTab("builder")} className="text-xs text-violet-400 font-bold hover:underline">
                ← Builder
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-12 text-slate-400 text-xs">⏳ Yuklanmoqda...</div>
            ) : historyList.length === 0 ? (
              <div className="bg-[#121927] border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                <span className="text-4xl">📭</span>
                <h3 className="font-extrabold text-sm text-slate-200">Hozircha quizlar yo'q</h3>
                <p className="text-xs text-slate-400">Quiz yaratish uchun Builder'ga o'ting.</p>
                <button onClick={() => setActiveTab("builder")} className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-bold">
                  Quiz Yaratish →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map(item => (
                  <div key={item.id} className="bg-[#121927] border border-slate-800 rounded-3xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-slate-100 text-sm">{item.title}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.questionCount} ta savol{item.settings?.multiTestBatchSize ? ` · ${Math.ceil(item.questionCount / item.settings.multiTestBatchSize)} test` : ""}
                          {item.settings?.timerSeconds ? ` · ${item.settings.timerSeconds}s` : ""}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          🗓 {new Date(item.createdAt).toLocaleString("uz-UZ")}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                        ✓
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          const qs = item.questions;
                          const title = item.title;
                          setQuestions(qs);
                          setParsedData({ title, sourceFileName: item.sourceFileName, rawText: "", questions: qs, overallValidation: { totalQuestions: item.questionCount, validQuestions: item.questionCount, flawedQuestions: 0, issues: [] }, parserMethod: "RULE" });
                          setQuizTitle(title);
                          if (item.settings?.multiTestBatchSize) setBatchSize(item.settings.multiTestBatchSize);
                          if (item.settings?.timerSeconds !== undefined) setTimerSeconds(item.settings.timerSeconds);
                          setBuilderStep("RESULT");
                          setActiveTab("builder");
                          showToast(`🔁 "${title}" qayta sozlamalarda ochildi!`);
                        }}
                        className="py-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 font-bold text-violet-300 text-[11px] flex items-center justify-center gap-1"
                      >
                        <span>🔁</span> Qayta
                      </button>
                      <button
                        onClick={async () => {
                          setIsSendingTg(true);
                          try {
                            await handleSendToTelegram(item.questions, item.settings || undefined, item.title);
                          } finally {
                            setIsSendingTg(false);
                          }
                        }}
                        className="py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 font-bold text-sky-300 text-[11px] flex items-center justify-center gap-1"
                      >
                        <span>📤</span> Yuborish
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(item.id)}
                        className="py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold text-rose-300 text-[11px] flex items-center justify-center gap-1"
                      >
                        <span>🗑</span> O'chirish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === "stats" && (
          <div className="space-y-5 mt-2">
            <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
              <span>📊</span> Quiz Statistikasi
            </h2>

            {/* Limit & account card */}
            <div className="bg-gradient-to-r from-violet-950/60 via-slate-900 to-indigo-950/60 border border-violet-500/40 rounded-3xl p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-violet-300 font-bold uppercase tracking-wider">Tarif & Limit</span>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  {statsData?.isPremium ? "PRO Premium ∞" : "BEPUL (FREE)"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-slate-400">Bugungi limit</div>
                  <div className="font-extrabold text-sm text-slate-100 mt-0.5">
                    {statsData?.isPremium ? "Cheksiz ∞" : `${statsData?.dailyUsed || todayCount} / 5 ta`}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Qolgan limit</div>
                  <div className="font-extrabold text-sm text-cyan-300 mt-0.5">
                    {statsData?.isPremium ? "Cheksiz ∞" : `${Math.max(0, 5 - (statsData?.dailyUsed || todayCount))} ta`}
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl">📈</span>
                <div className="font-extrabold text-2xl text-slate-100 mt-1">{historyList.length}</div>
                <div className="text-[11px] text-slate-400 font-semibold">Jami Quiz</div>
              </div>
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl">📅</span>
                <div className="font-extrabold text-2xl text-amber-300 mt-1">{todayCount}</div>
                <div className="text-[11px] text-slate-400 font-semibold">Bugun</div>
              </div>
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl">📤</span>
                <div className="font-extrabold text-2xl text-sky-400 mt-1">{telegramSentCount}</div>
                <div className="text-[11px] text-slate-400 font-semibold">Telegram Poll</div>
              </div>
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl">🎯</span>
                <div className="font-extrabold text-2xl text-violet-400 mt-1">
                  {historyList.reduce((s, h) => s + (h.questionCount || 0), 0)}
                </div>
                <div className="text-[11px] text-slate-400 font-semibold">Jami Savol</div>
              </div>
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl">⚡</span>
                <div className="font-extrabold text-2xl text-emerald-400 mt-1">~1.5s</div>
                <div className="text-[11px] text-slate-400 font-semibold">O'rtacha Vaqt</div>
              </div>
              <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                <span className="text-2xl">🛡</span>
                <div className="font-extrabold text-2xl text-cyan-400 mt-1">85%</div>
                <div className="text-[11px] text-slate-400 font-semibold">AI Tejamkorlik</div>
              </div>
            </div>

            {/* Parser breakdown */}
            <div className="bg-[#121927] border border-slate-800 rounded-3xl p-5 space-y-3">
              <h3 className="font-extrabold text-sm text-slate-200">⚙️ Parser ishlash statistikasi</h3>
              <div className="space-y-3 text-xs">
                {[
                  { label: "Rule Engine Parser (lokal)", pct: 92, color: "bg-emerald-400", textColor: "text-emerald-400" },
                  { label: "Gemini AI Fallback Parser", pct: 8, color: "bg-violet-400", textColor: "text-violet-400" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
                      <span>{item.label}</span>
                      <span className={`font-extrabold ${item.textColor}`}>{item.pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e293b] border border-violet-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs text-center max-w-xs">
          {toastMsg}
        </div>
      )}
    </main>
  );
}
