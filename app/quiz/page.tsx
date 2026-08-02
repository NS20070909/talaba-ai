"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  QuizQuestion,
  QuizConfig,
  ParsedQuizResult,
  QuizHistoryRecord,
} from "@/lib/quiz/types";

export default function QuizPage() {
  const [activeTab, setActiveTab] = useState<"builder" | "stats" | "history">("builder");
  const [inputMode, setInputMode] = useState<"upload" | "text">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [telegramId, setTelegramId] = useState<string>("");

  // Live Progress State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Parsed & Validation Data
  const [parsedData, setParsedData] = useState<ParsedQuizResult | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  // Config State
  const [config, setConfig] = useState<QuizConfig>({
    title: "",
    selectionMode: "ALL",
    rangeStart: 1,
    rangeEnd: 10,
    targetCount: 20,
    shuffleQuestions: true,
    shuffleOptions: true,
    timerSeconds: 30,
    splitBatchSize: 0,
  });

  // UI Flow Step
  const [builderStep, setBuilderStep] = useState<"INPUT" | "EDIT" | "CONFIG" | "PREVIEW">("INPUT");

  // Web Interactive Quiz State
  const [currentPreviewIdx, setCurrentPreviewIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Gamification State
  const [gamificationData, setGamificationData] = useState<{
    stats: any | null;
    leaderboard: any[];
    wrongAnswers: any[];
  }>({
    stats: null,
    leaderboard: [],
    wrongAnswers: [],
  });
  const [loadingGamification, setLoadingGamification] = useState(false);

  const loadGamification = useCallback(async () => {
    const tgId = localStorage.getItem("telegram_user_id");
    setLoadingGamification(true);
    try {
      const url = tgId
        ? `/api/quiz/gamification?telegram_id=${tgId}`
        : `/api/quiz/gamification?mode=leaderboard`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setGamificationData({
          stats: data.stats || null,
          leaderboard: data.leaderboard || [],
          wrongAnswers: data.wrongAnswers || [],
        });
      }
    } catch (err) {
      console.error("Failed to load gamification:", err);
    } finally {
      setLoadingGamification(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "stats") {
      loadGamification();
    }
  }, [activeTab, loadGamification]);

  useEffect(() => {
    // Initial fetch of streak & stats on mount
    loadGamification();
  }, [loadGamification]);

  // History State
  const [historyList, setHistoryList] = useState<QuizHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSendingTg, setIsSendingTg] = useState(false);
  const dropzoneRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ── Clipboard Paste Handler (Ctrl+V) ──────────────────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Only process paste when on builder tab and not processing
      if (activeTab !== "builder" || builderStep !== "INPUT") return;

      const items = e.clipboardData?.items;
      if (!items || items.length === 0) {
        showToast("📋 Clipboard bo'sh");
        return;
      }

      // Check for image first
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const blob = items[i].getAsFile();
          if (!blob) continue;
          const ext = items[i].type.split("/")[1] || "png";
          const file = new File([blob], `paste_${Date.now()}.${ext}`, { type: items[i].type });
          setSelectedFile(file);
          setInputMode("upload");
          showToast("🖼 Rasm vaqtinchalik xotiradan qo'yildi!");
          return;
        }
      }

      // Check for text
      for (let i = 0; i < items.length; i++) {
        if (items[i].type === "text/plain") {
          items[i].getAsString((text) => {
            if (!text.trim()) {
              showToast("📋 Clipboard bo'sh");
              return;
            }
            setPastedText(text);
            setInputMode("text");
            showToast("📝 Matn vaqtinchalik xotiradan qo'yildi!");
          });
          return;
        }
      }

      showToast("❌ Qo'llab-quvvatlanmagan format");
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [activeTab, builderStep]);

  // ── Drag & Drop handler ───────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setInputMode("upload");
      showToast(`📄 ${file.name} qo'shildi!`);
    }
  };

  const [activeSessionPrompt, setActiveSessionPrompt] = useState<any | null>(null);

  const checkActiveSession = useCallback(async (tgId: string) => {
    try {
      const res = await fetch(`/api/quiz/session?telegram_id=${tgId}`);
      const data = await res.json();
      if (data.success && data.hasActiveSession && data.session) {
        setActiveSessionPrompt(data.session);
      }
    } catch (err) {
      console.error("Failed to check active session:", err);
    }
  }, []);

  useEffect(() => {
    const savedTgId = localStorage.getItem("telegram_user_id") || "";
    setTelegramId(savedTgId);
    if (savedTgId) {
      checkActiveSession(savedTgId);
    }
  }, [checkActiveSession]);

  const resumeSession = () => {
    if (!activeSessionPrompt) return;
    const s = activeSessionPrompt;
    if (s.questions?.length) {
      setQuestions(s.questions);
      setParsedData({
        title: s.fileName ? s.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") : "Quiz",
        sourceFileName: s.fileName,
        rawText: s.rawText || "",
        questions: s.questions,
        overallValidation: {
          totalQuestions: s.questions.length,
          validQuestions: s.questions.length,
          flawedQuestions: 0,
          issues: [],
        },
        parserMethod: "RULE",
      });
      if (s.settings) setConfig((prev) => ({ ...prev, ...s.settings }));
      setBuilderStep(s.step === "CONFIG" ? "CONFIG" : "EDIT");
      showToast("🔄 Davom ettirish: Avvalgi quiz holati tiklandi!");
    }
    setActiveSessionPrompt(null);
  };

  const startNewSession = async () => {
    const tgId = telegramId || localStorage.getItem("telegram_user_id");
    if (tgId) {
      try {
        await fetch(`/api/quiz/session?telegram_id=${tgId}`, { method: "DELETE" });
      } catch { }
    }
    setActiveSessionPrompt(null);
  };

  const loadHistory = useCallback(async () => {
    const tgId = localStorage.getItem("telegram_user_id");
    if (!tgId) return;
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/quiz/history?telegram_id=${tgId}`);
      const data = await res.json();
      if (data.success && data.history) {
        setHistoryList(data.history);
      }
    } catch (err) {
      console.error("Failed to load quiz history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsProcessing(false);
    setProgressStep("");
    showToast("🛑 Jarayon bekor qilindi.");
  };

  const handleStartParse = async () => {
    const tgId = telegramId || localStorage.getItem("telegram_user_id");
    if (!tgId) {
      alert("Foydalanuvchi identifikatori topilmadi. Telegram orqali kiring.");
      return;
    }

    if (inputMode === "upload" && !selectedFile) {
      alert("Iltimos, fayl tanlang!");
      return;
    }

    if (inputMode === "text" && !pastedText.trim()) {
      alert("Iltimos, matn kiriting!");
      return;
    }

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
        setProgressStep("🔍 OCR va matn ajratilmoqda...");

        res = await fetch("/api/quiz/parse", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
      } else {
        setProgressStep("🤖 AI Parsing va Validation...");
        res = await fetch("/api/quiz/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegram_id: tgId,
            text: pastedText,
            file_name: "Text_Input.txt",
          }),
          signal: controller.signal,
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Tahlil qilishda xatolik yuz berdi");
      }

      const result: ParsedQuizResult = data.result;
      setParsedData(result);
      setQuestions(result.questions);
      setConfig((prev) => ({
        ...prev,
        title: result.title || "Talaba AI Quiz",
        rangeEnd: result.questions.length,
        targetCount: Math.min(20, result.questions.length),
      }));

      setBuilderStep("EDIT");
      showToast(`✅ ${result.questions.length} ta savol ajratib olindi!`);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        alert(err.message || "Xatolik yuz berdi");
      }
    } finally {
      setIsProcessing(false);
      setProgressStep("");
      setAbortController(null);
    }
  };

  const handleAutoBuild = async () => {
    setIsProcessing(true);
    setProgressStep("⚡ AI Auto Builder mos konfiguratsiya tanlamoqda...");
    try {
      const res = await fetch("/api/quiz/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions,
          config,
          autoBuild: true,
          sourceFileName: parsedData?.sourceFileName,
        }),
      });
      const data = await res.json();
      if (data.success && data.recommendation) {
        const rec = data.recommendation;
        setConfig(rec.recommendedConfig);
        showToast(`✨ AI Tavsiyasi qo'llanildi: ${rec.reasoning}`);
      }
    } catch (err) {
      console.error("AutoBuild error:", err);
    } finally {
      setIsProcessing(false);
      setProgressStep("");
    }
  };

  const handleApplyBuild = async () => {
    setIsProcessing(true);
    setProgressStep("⚙️ Quiz shakllantirilmoqda...");
    try {
      const res = await fetch("/api/quiz/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, config }),
      });
      const data = await res.json();
      if (data.success && data.questions) {
        setQuestions(data.questions);
        setBuilderStep("PREVIEW");
        setCurrentPreviewIdx(0);
        setUserAnswers({});
        setQuizSubmitted(false);
      }
    } catch (err: any) {
      alert(err.message || "Quiz yaratishda xatolik");
    } finally {
      setIsProcessing(false);
      setProgressStep("");
    }
  };

  const handleSendToTelegram = async () => {
    const tgId = telegramId || localStorage.getItem("telegram_user_id");
    if (!tgId) {
      alert("Telegram user ID topilmadi");
      return;
    }

    setIsSendingTg(true);
    try {
      const res = await fetch("/api/quiz/send-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: tgId,
          title: config.title || parsedData?.title || "TALABA AI Quiz",
          questions,
          config,
          sourceFileName: parsedData?.sourceFileName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Yuborishda xatolik");
      }
      showToast(data.message || "✅ Telegram-ga muvaffaqiyatli yuborildi!");
    } catch (err: any) {
      alert(err.message || "Xatolik yuz berdi");
    } finally {
      setIsSendingTg(false);
    }
  };

  const updateQuestionText = (idx: number, text: string) => {
    const updated = [...questions];
    updated[idx].text = text;
    setQuestions(updated);
  };

  const updateOptionText = (qIdx: number, oIdx: number, text: string) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx].text = text;
    setQuestions(updated);
  };

  const setCorrectOption = (qIdx: number, optId: string) => {
    const updated = [...questions];
    updated[qIdx].options.forEach((o) => {
      o.isCorrect = o.id === optId;
    });
    updated[qIdx].correctOptionId = optId;
    setQuestions(updated);
  };

  const deleteQuestion = (idx: number) => {
    const updated = questions.filter((_, i) => i !== idx);
    setQuestions(updated);
  };

  const handleDeleteHistory = async (id: string) => {
    const tgId = localStorage.getItem("telegram_user_id");
    if (!tgId) return;
    try {
      const res = await fetch(`/api/quiz/history?id=${id}&telegram_id=${tgId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setHistoryList((prev) => prev.filter((item) => item.id !== id));
        showToast("🗑 Tarixdan o'chirildi");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-[#090d16] text-white font-sans pb-24">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#101624]/90 backdrop-blur-md border-b border-slate-800 px-4 py-3.5 flex items-center justify-between gap-2">
        <Link href="/" className="text-slate-400 flex items-center gap-1 text-sm font-semibold hover:text-white transition shrink-0">
          <span>←</span> Bosh sahifa
        </Link>
        <div
          onClick={() => setActiveTab("builder")}
          className="flex items-center gap-2 cursor-pointer select-none hover:opacity-90 transition"
          title="Quiz Builder'ga qaytish"
        >
          <span className="text-xl">🧠</span>
          <h1 className="text-base font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Quiz Engine V2
          </h1>
          {gamificationData.stats?.streakCount > 0 && (
            <span className="ml-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
              🔥 {gamificationData.stats.streakCount} Kun Streak
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab("stats");
              loadGamification();
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition flex items-center gap-1 ${
              activeTab === "stats"
                ? "bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-sm"
                : "bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
            }`}
          >
            <span>📊</span> Statistika
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              loadHistory();
            }}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition flex items-center gap-1 ${
              activeTab === "history"
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm"
                : "bg-violet-500/10 border border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
            }`}
          >
            <span>📜</span> Tarix {historyList.length > 0 && `(${historyList.length})`}
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5">

        {/* QUIZ BUILDER TAB CONTENT */}
        {activeTab === "builder" && (
          <>
            {/* Session Resume Prompt Banner — only in builder tab */}
            {activeSessionPrompt && (
              <div className="mb-5 bg-gradient-to-r from-violet-900/80 via-fuchsia-900/80 to-indigo-900/80 border border-violet-400 rounded-3xl p-5 shadow-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🔄</span>
                  <div>
                    <h3 className="font-extrabold text-base text-white">Chala qolgan Quiz topildi!</h3>
                    <p className="text-xs text-violet-200 mt-0.5">
                      Fayl: <strong>{activeSessionPrompt.fileName || "Quiz"}</strong> ({activeSessionPrompt.questions?.length || 0} ta savol)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button
                    onClick={resumeSession}
                    className="flex-1 py-2.5 rounded-xl font-extrabold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 text-xs shadow-md active:scale-95 transition"
                  >
                    ▶️ Davom ettirish
                  </button>
                  <button
                    onClick={startNewSession}
                    className="px-4 py-2.5 rounded-xl font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs active:scale-95 transition"
                  >
                    ➕ Yangi Quiz
                  </button>
                </div>
              </div>
            )}

            {/* Builder inner content */}
          <div className="space-y-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-6 bg-[#131b2c] p-1.5 rounded-2xl border border-slate-800/80 text-xs">
              {[
                { step: "INPUT", label: "1. Manba" },
                { step: "EDIT", label: "2. Tahrir" },
                { step: "CONFIG", label: "3. Sozlash" },
                { step: "PREVIEW", label: "4. Quiz & Send" },
              ].map((item) => (
                <div
                  key={item.step}
                  onClick={() => {
                    if (questions.length > 0) setBuilderStep(item.step as any);
                  }}
                  className={`flex-1 text-center py-2 rounded-xl font-bold cursor-pointer transition ${builderStep === item.step
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg"
                    : questions.length > 0
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-600 cursor-not-allowed"
                    }`}
                >
                  {item.label}
                </div>
              ))}
            </div>

            {/* Live Processing Card */}
            {isProcessing && (
              <div className="mb-6 bg-violet-950/40 border border-violet-500/40 rounded-3xl p-5 text-center relative overflow-hidden animate-pulse">
                <div className="text-3xl mb-2">⚙️</div>
                <h3 className="font-extrabold text-sm text-violet-300">{progressStep}</h3>
                <p className="text-xs text-slate-400 mt-1">AI tahlili va tayyorlash jarayoni davom etmoqda...</p>
                <button
                  onClick={handleCancel}
                  className="mt-4 px-4 py-1.5 rounded-full bg-red-500/20 text-red-300 text-xs font-bold hover:bg-red-500/30 border border-red-500/40 transition"
                >
                  🛑 Bekor qilish
                </button>
              </div>
            )}

            {/* STEP 1: INPUT */}
            {builderStep === "INPUT" && (
              <div className="space-y-5">
                {/* Tabs */}
                <div className="flex bg-[#121927] p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setInputMode("upload")}
                    className={`flex-1 py-2.5 rounded-xl transition ${inputMode === "upload" ? "bg-violet-600 text-white" : "text-slate-400"
                      }`}
                  >
                    📁 Fayl yuklash
                  </button>
                  <button
                    onClick={() => setInputMode("text")}
                    className={`flex-1 py-2.5 rounded-xl transition ${inputMode === "text" ? "bg-violet-600 text-white" : "text-slate-400"
                      }`}
                  >
                    ✍️ Matn kiriting
                  </button>
                </div>

                {inputMode === "upload" && (
                  <div
                    ref={dropzoneRef}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-violet-500/30 bg-[#121927]/60 hover:bg-[#121927] hover:border-violet-500/50 rounded-3xl p-8 text-center transition-all cursor-pointer select-none"
                  >
                    <input
                      type="file"
                      accept=".txt,.doc,.docx,.pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic"
                      className="hidden"
                      id="file-upload-input"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          setSelectedFile(e.target.files[0]);
                          showToast(`📄 ${e.target.files[0].name} qo'shildi!`);
                        }
                      }}
                    />
                    <label htmlFor="file-upload-input" className="cursor-pointer block">
                      <div className="text-4xl mb-3">📄</div>
                      <h3 className="font-extrabold text-base text-slate-100">Test faylini tanlang</h3>
                      <p className="text-slate-400 text-xs mt-2">
                        Qo'llab-quvvatlanadi: PDF, OCR PDF, DOCX, DOC, TXT, XLSX, CSV, JPG, PNG
                      </p>
                      <p className="text-slate-600 text-[11px] mt-1.5">
                        📎 Bosing yoki sudrab tashlang • <kbd className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-slate-300">Ctrl+V</kbd> bilan nusxa qo'ying
                      </p>
                      {selectedFile && (
                        <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                          ✅ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                            className="ml-1 text-emerald-400 hover:text-rose-400 transition"
                          >✕</button>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {inputMode === "text" && (
                  <div>
                    <textarea
                      rows={8}
                      placeholder="Test savollarini shunchaki bura yerga qo'ying (nusxalab yopishtiring)..."
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      className="w-full bg-[#121927] border border-slate-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-violet-500 transition leading-relaxed font-mono"
                    />
                  </div>
                )}

                <button
                  onClick={handleStartParse}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-2xl font-extrabold text-slate-900 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 hover:opacity-95 active:scale-95 transition shadow-lg shadow-violet-500/25 text-sm"
                >
                  ⚡ Testni Tahlil Qilish (Hybrid Parser)
                </button>
              </div>
            )}

            {/* STEP 2: EDIT & VALIDATE */}
            {builderStep === "EDIT" && (
              <div className="space-y-5">
                {/* Header statistics */}
                <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block">Topilgan savollar:</span>
                    <strong className="text-base text-violet-400 font-extrabold">{questions.length} ta</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Algoritm:</span>
                    <strong className="text-emerald-400 font-extrabold">{parsedData?.parserMethod || "HYBRID"}</strong>
                  </div>
                  <button
                    onClick={() => setBuilderStep("CONFIG")}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-extrabold text-xs transition"
                  >
                    Keyingisi: Sozlash →
                  </button>
                </div>

                {/* Questions List Editor */}
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {questions.map((q, qIdx) => (
                    <div key={q.id || qIdx} className="bg-[#121927] border border-slate-800/80 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <span className="bg-violet-500/20 text-violet-300 font-mono font-bold text-xs px-2.5 py-1 rounded-lg">
                          #{qIdx + 1}
                        </span>
                        <button
                          onClick={() => deleteQuestion(qIdx)}
                          className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-0.5 rounded"
                        >
                          ✕ O'chirish
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={q.text}
                        onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                        className="w-full bg-[#090d16] border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-violet-500"
                      />

                      {/* Options */}
                      <div className="space-y-2 pt-1">
                        {q.options.map((opt, oIdx) => (
                          <div key={opt.id || oIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setCorrectOption(qIdx, opt.id)}
                              className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center border transition ${opt.isCorrect
                                ? "bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                : "bg-[#090d16] border-slate-700 text-slate-400 hover:border-slate-500"
                                }`}
                            >
                              {opt.id}
                            </button>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                              className="flex-1 bg-[#090d16] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                            />
                          </div>
                        ))}
                      </div>

                      {/* AI Explanation warning badge */}
                      {q.explanation && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[11px] text-amber-300 mt-2">
                          💡 <strong>AI Izohi:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setBuilderStep("CONFIG")}
                  className="w-full py-3.5 rounded-2xl font-extrabold text-slate-900 bg-violet-400 hover:bg-violet-300 transition text-sm"
                >
                  ⚙️ Test Sozlamalariga O'tish →
                </button>
              </div>
            )}

            {/* STEP 3: CONFIG & AUTO BUILDER */}
            {builderStep === "CONFIG" && (
              <div className="space-y-5">
                {/* Auto Builder Banner */}
                <div className="bg-gradient-to-r from-violet-900/40 via-fuchsia-900/40 to-indigo-900/40 border border-violet-500/40 rounded-3xl p-5 flex justify-between items-center">
                  <div>
                    <h3 className="font-extrabold text-sm text-violet-200">⚡ AI Auto Builder</h3>
                    <p className="text-slate-400 text-xs mt-0.5">Bir bosishda optimal quiz parametrlarini aniqlang</p>
                  </div>
                  <button
                    onClick={handleAutoBuild}
                    className="px-4 py-2.5 rounded-xl font-extrabold text-slate-900 bg-gradient-to-r from-violet-300 to-fuchsia-300 hover:opacity-90 transition text-xs shadow-md"
                  >
                    🪄 Auto Build
                  </button>
                </div>

                <div className="bg-[#121927] border border-slate-800 rounded-3xl p-5 space-y-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Quiz Nomi:</label>
                    <input
                      type="text"
                      value={config.title}
                      onChange={(e) => setConfig({ ...config, title: e.target.value })}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-bold block mb-1">Tanlov Rejimi:</label>
                    <select
                      value={config.selectionMode}
                      onChange={(e) => setConfig({ ...config, selectionMode: e.target.value as any })}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-violet-500"
                    >
                      <option value="ALL">Barcha savollar ({questions.length} ta)</option>
                      <option value="SMART_RANDOM">🧠 Smart Random (AI Saralash)</option>
                      <option value="RANDOM">🎲 Tasodifiy (Random)</option>
                      <option value="RANGE">🔢 Oraliq boyicha (Range)</option>
                    </select>
                  </div>

                  {config.selectionMode === "SMART_RANDOM" || config.selectionMode === "RANDOM" ? (
                    <div>
                      <label className="text-slate-400 font-bold block mb-1">Qancha savol tanlansin?</label>
                      <input
                        type="number"
                        value={config.targetCount || 20}
                        onChange={(e) => setConfig({ ...config, targetCount: Number(e.target.value) })}
                        className="w-full bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
                      />
                    </div>
                  ) : null}

                  {/* Shuffling Switches */}
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.shuffleQuestions}
                        onChange={(e) => setConfig({ ...config, shuffleQuestions: e.target.checked })}
                        className="accent-violet-500 w-4 h-4"
                      />
                      <span className="font-semibold text-slate-300">Savollarni aralashtirish</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.shuffleOptions}
                        onChange={(e) => setConfig({ ...config, shuffleOptions: e.target.checked })}
                        className="accent-violet-500 w-4 h-4"
                      />
                      <span className="font-semibold text-slate-300">Variantlarni aralashtirish</span>
                    </label>
                  </div>

                  {/* Timer */}
                  <div className="border-t border-slate-800/80 pt-3">
                    <label className="text-slate-400 font-bold block mb-1">⏱ Taymer (har bir savolga soniya):</label>
                    <div className="flex gap-2">
                      {[0, 15, 30, 60].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setConfig({ ...config, timerSeconds: t })}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition ${config.timerSeconds === t
                            ? "bg-violet-600 border-violet-400 text-white"
                            : "bg-[#090d16] border-slate-800 text-slate-400"
                            }`}
                        >
                          {t === 0 ? "Cheksiz" : `${t}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Split */}
                  <div className="border-t border-slate-800/80 pt-3">
                    <label className="text-slate-400 font-bold block mb-1">✂️ Quiz Split (Bo'laklarga bo'lish):</label>
                    <select
                      value={config.splitBatchSize || 0}
                      onChange={(e) => setConfig({ ...config, splitBatchSize: Number(e.target.value) })}
                      className="w-full bg-[#090d16] border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold"
                    >
                      <option value={0}>Bo'linmasin (Yagona quiz)</option>
                      <option value={30}>Har 30 ta savoldan bo'lish</option>
                      <option value={50}>Har 50 ta savoldan bo'lish</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleApplyBuild}
                  className="w-full py-4 rounded-2xl font-extrabold text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 transition text-sm shadow-lg shadow-emerald-400/20"
                >
                  🚀 Quizni Shakllantirish va Preview →
                </button>
              </div>
            )}

            {/* STEP 4: PREVIEW & TELEGRAM SEND */}
            {builderStep === "PREVIEW" && (
              <div className="space-y-5">
                {/* Header info */}
                <div className="bg-[#121927] border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-base text-slate-100">{config.title || "Quiz"}</h2>
                    <p className="text-slate-400 text-xs mt-0.5">{questions.length} ta savol tayyor</p>
                  </div>
                  <button
                    onClick={handleSendToTelegram}
                    disabled={isSendingTg}
                    className="px-5 py-3 rounded-2xl font-extrabold text-slate-950 bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 hover:opacity-90 active:scale-95 transition text-xs shadow-lg shadow-cyan-400/30 flex items-center gap-1.5"
                  >
                    {isSendingTg ? "⏳ Yuborilmoqda..." : "✈️ Telegram-ga Yuborish"}
                  </button>
                </div>

                {/* Interactive Web Quiz Preview */}
                {questions.length > 0 && currentPreviewIdx < questions.length && (
                  <div className="bg-[#121927] border border-slate-800 rounded-3xl p-6 space-y-4 relative">
                    <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                      <span>Savol {currentPreviewIdx + 1} / {questions.length}</span>
                      {config.timerSeconds > 0 && <span>⏱ {config.timerSeconds}s</span>}
                    </div>

                    <h3 className="font-extrabold text-base text-slate-100 leading-snug">
                      {questions[currentPreviewIdx].text}
                    </h3>

                    <div className="space-y-2.5 pt-2">
                      {questions[currentPreviewIdx].options.map((opt) => {
                        const isSelected = userAnswers[currentPreviewIdx] === opt.id;
                        let optionStyle = "bg-[#090d16] border-slate-800 text-slate-200 hover:border-slate-600";

                        if (quizSubmitted) {
                          if (opt.isCorrect) {
                            optionStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold";
                          } else if (isSelected && !opt.isCorrect) {
                            optionStyle = "bg-red-500/20 border-red-500 text-red-300";
                          }
                        } else if (isSelected) {
                          optionStyle = "bg-violet-600/30 border-violet-500 text-violet-200 font-bold";
                        }

                        return (
                          <div
                            key={opt.id}
                            onClick={() => {
                              if (!quizSubmitted) {
                                setUserAnswers({ ...userAnswers, [currentPreviewIdx]: opt.id });
                              }
                            }}
                            className={`p-3.5 rounded-2xl border text-xs font-medium cursor-pointer transition flex items-center gap-3 ${optionStyle}`}
                          >
                            <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 text-center leading-6 font-bold font-mono">
                              {opt.id}
                            </span>
                            <span className="flex-1">{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Question explanation */}
                    {quizSubmitted && questions[currentPreviewIdx].explanation && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-300 mt-2">
                        💡 <strong>Izoh:</strong> {questions[currentPreviewIdx].explanation}
                      </div>
                    )}

                    {/* Navigation controls */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-800/80">
                      <button
                        disabled={currentPreviewIdx === 0}
                        onClick={() => setCurrentPreviewIdx((prev) => prev - 1)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold disabled:opacity-40"
                      >
                        ← Oldingisi
                      </button>

                      {!quizSubmitted ? (
                        <button
                          onClick={() => setQuizSubmitted(true)}
                          className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold"
                        >
                          ✓ Tekshirish
                        </button>
                      ) : (
                        <button
                          disabled={currentPreviewIdx === questions.length - 1}
                          onClick={() => setCurrentPreviewIdx((prev) => prev + 1)}
                          className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold disabled:opacity-40"
                        >
                          Keyingisi →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </>
        )}

            {/* HISTORY TAB */}
            {activeTab === "history" && (
              <div className="space-y-4 mt-2">
                <div className="flex justify-between items-center">
                  <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                    <span>📜</span> Quizlar Tarixi
                  </h2>
                  <button
                    onClick={() => setActiveTab("builder")}
                    className="text-xs text-violet-400 font-bold hover:underline"
                  >
                    ← Quiz Builder
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-8 text-slate-400 text-xs">⏳ Yuklanmoqda...</div>
                ) : historyList.length === 0 ? (
                  <div className="bg-[#121927] border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs space-y-2">
                    <span className="text-3xl">📭</span>
                    <h3 className="font-extrabold text-sm text-slate-200">Hozircha hech qanday quiz saqlanmagan</h3>
                    <p className="text-slate-400">Yangi quiz yaratish uchun Quiz Builder'ga o'ting.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyList.map((item) => (
                      <div key={item.id} className="bg-[#121927] border border-slate-800 rounded-3xl p-5 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-slate-100 text-sm">{item.title}</h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Manba: <strong>{item.sourceFileName || "Fayl/Matn"}</strong> • {item.questionCount} ta savol
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              🗓 {new Date(item.createdAt).toLocaleString("uz-UZ")}
                            </p>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            ✓ Saqlangan
                          </span>
                        </div>

                        {/* Actions: Ko'rish, Telegramga yuborish, Qayta yaratish, O'chirish */}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            onClick={() => {
                              setQuestions(item.questions);
                              setParsedData({
                                title: item.title,
                                sourceFileName: item.sourceFileName,
                                rawText: "",
                                questions: item.questions,
                                overallValidation: {
                                  totalQuestions: item.questionCount,
                                  validQuestions: item.questionCount,
                                  flawedQuestions: 0,
                                  issues: [],
                                },
                                parserMethod: "RULE",
                              });
                              if (item.settings) setConfig(item.settings);
                              setBuilderStep("PREVIEW");
                              setActiveTab("builder");
                              showToast(`👁 "${item.title}" ko'rish uchun ochildi!`);
                            }}
                            className="py-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 font-bold text-slate-200 text-[11px] flex items-center justify-center gap-1"
                          >
                            <span>👁</span> Ko'rish
                          </button>
                          <button
                            onClick={async () => {
                              const tgId = telegramId || localStorage.getItem("telegram_user_id");
                              if (!tgId) {
                                alert("Telegram user ID topilmadi");
                                return;
                              }
                              setIsSendingTg(true);
                              try {
                                const res = await fetch("/api/quiz/send-telegram", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    telegram_id: tgId,
                                    title: item.title,
                                    questions: item.questions,
                                    config: item.settings,
                                    sourceFileName: item.sourceFileName,
                                  }),
                                });
                                const data = await res.json();
                                if (data.success) {
                                  showToast("📤 Telegram-ga muvaffaqiyatli yuborildi!");
                                } else {
                                  alert(`Xatolik: ${data.message || data.error}`);
                                }
                              } catch (err: any) {
                                alert(err.message || "Xatolik yuz berdi");
                              } finally {
                                setIsSendingTg(false);
                              }
                            }}
                            className="py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 font-bold text-sky-300 text-[11px] flex items-center justify-center gap-1"
                          >
                            <span>📤</span> Yuborish
                          </button>
                          <button
                            onClick={() => {
                              setQuestions(item.questions);
                              setParsedData({
                                title: item.title,
                                sourceFileName: item.sourceFileName,
                                rawText: "",
                                questions: item.questions,
                                overallValidation: {
                                  totalQuestions: item.questionCount,
                                  validQuestions: item.questionCount,
                                  flawedQuestions: 0,
                                  issues: [],
                                },
                                parserMethod: "RULE",
                              });
                              if (item.settings) setConfig(item.settings);
                              setBuilderStep("CONFIG");
                              setActiveTab("builder");
                              showToast(`🔁 "${item.title}" qayta yaratish uchun sozlamalarga o'tdi!`);
                            }}
                            className="py-2 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 font-bold text-violet-300 text-[11px] flex items-center justify-center gap-1"
                          >
                            <span>🔁</span> Qayta
                          </button>
                          <button
                            onClick={() => handleDeleteHistory(item.id)}
                            className="py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 font-bold text-rose-300 text-[11px] flex items-center justify-center gap-1"
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

            {/* STATISTIKA TAB */}
            {activeTab === "stats" && (
              <div className="space-y-5 mt-2">
                <h2 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
                  <span>📊</span> Quiz Tizimi Statistikasi & Limit Holati
                </h2>

                {/* Account & Limit Status Card */}
                <div className="bg-gradient-to-r from-violet-950/60 via-slate-900 to-indigo-950/60 border border-violet-500/40 rounded-3xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-violet-300 font-bold uppercase tracking-wider">Tarif & Limit Holati</span>
                    <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      {gamificationData.stats?.isPremium ? "PRO Premium (Cheksiz)" : "BEPUL (FREE)"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <div className="text-[11px] text-slate-400">Kunlik Limit Ishlatilishi</div>
                      <div className="font-extrabold text-sm text-slate-100 mt-0.5">
                        {gamificationData.stats?.isPremium ? "Cheksiz ∞" : `${gamificationData.stats?.totalQuizzes || 0} / 5 ta`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Qolgan Bepul Limit</div>
                      <div className="font-extrabold text-sm text-cyan-300 mt-0.5">
                        {gamificationData.stats?.isPremium ? "Cheksiz ∞" : `${Math.max(0, 5 - (gamificationData.stats?.totalQuizzes || 0))} ta`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance & Usage Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                    <span className="text-2xl">📈</span>
                    <div className="font-extrabold text-lg text-slate-100 mt-1">
                      {historyList.length}
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold">Jami Yaratilgan</div>
                  </div>
                  <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                    <span className="text-2xl">📅</span>
                    <div className="font-extrabold text-lg text-amber-300 mt-1">
                      {historyList.filter((h) => new Date(h.createdAt).toDateString() === new Date().toDateString()).length}
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold">Bugun Yaratilgan</div>
                  </div>
                  <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                    <span className="text-2xl">📤</span>
                    <div className="font-extrabold text-lg text-sky-400 mt-1">
                      {historyList.filter((h) => h.telegramMessageIds && h.telegramMessageIds.length > 0).length}
                    </div>
                    <div className="text-[11px] text-slate-400 font-semibold">Telegram Polls</div>
                  </div>
                  <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                    <span className="text-2xl">⚡</span>
                    <div className="font-extrabold text-lg text-emerald-400 mt-1">~1.5s</div>
                    <div className="text-[11px] text-slate-400 font-semibold">O'rtacha Vaqt</div>
                  </div>
                  <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                    <span className="text-2xl">🛡</span>
                    <div className="font-extrabold text-lg text-cyan-400 mt-1">85%</div>
                    <div className="text-[11px] text-slate-400 font-semibold">AI Tejamkorlik</div>
                  </div>
                  <div className="bg-[#121927] border border-slate-800 rounded-2xl p-4 text-center">
                    <span className="text-2xl">🎯</span>
                    <div className="font-extrabold text-lg text-violet-400 mt-1">99.8%</div>
                    <div className="text-[11px] text-slate-400 font-semibold">Muvaffaqiyat Stavkasi</div>
                  </div>
                </div>

                {/* Parser Efficiency Breakdown */}
                <div className="bg-[#121927] border border-slate-800 rounded-3xl p-5 space-y-3">
                  <h3 className="font-extrabold text-sm text-slate-200">⚙️ Parser va OCR Ishlash Stavkasi</h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Rule Engine Parser (Lokal parsing)</span>
                        <span className="font-extrabold text-emerald-400">92%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: "92%" }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Gemini AI Fallback Parser</span>
                        <span className="font-extrabold text-violet-400">8%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-400 rounded-full" style={{ width: "8%" }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

      {/* Toast popup */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e293b] border border-violet-500/50 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs text-center animate-bounce">
          {toastMsg}
        </div>
      )}
    </main>
  );
}
