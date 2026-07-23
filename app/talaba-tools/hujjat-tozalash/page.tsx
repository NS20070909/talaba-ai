"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

interface HujjatStats {
  plan: string;
  used: number;
  limit: number;
  isUnlimited: boolean;
  maxPages: number;
  maxFileMb: number;
}

interface DocumentScores {
  overall: number;
  formatting: number;
  consistency: number;
  structure: number;
  readability: number;
  academic: number;
}

interface CleaningReport {
  beforeScore: DocumentScores;
  afterScore: DocumentScores;
  fixes: {
    fontsUnified: number;
    paragraphsFixed: number;
    spacingCorrected: number;
    marginsCorrected: number;
    tablesImproved: number;
    imagesOptimized: number;
    duplicatesRemoved: number;
    headingsStandardized: number;
    referencesImproved: number;
    emptyParagraphsRemoved: number;
    doubleSpacesFixed: number;
    totalIssuesFixed: number;
  };
  grammarSuggestions: Array<{
    original: string;
    suggestion: string;
    reason: string;
  }>;
  warnings: string[];
  recommendations: string[];
  issues: string[];
  duplicates: Array<{ text: string; duplicateOfIndex: number }>;
  pageCount: number;
  wordCount: number;
  processingTimeMs: number;
}

const PROCESS_STEPS = [
  { label: "Hujjat tekshirilmoqda", icon: "🔍" },
  { label: "Matn o'qilmoqda", icon: "📖" },
  { label: "Gemini AI tahlil qilmoqda", icon: "🤖" },
  { label: "Format tozalanmoqda", icon: "⚙️" },
  { label: "Yangi hujjat yaratilmoqda", icon: "📄" },
];

const AI_FEATURES = [
  "Imlo xatolarini topadi",
  "Grammatika tavsiyalari beradi",
  "Sarlavhalarni tekshiradi",
  "Referat tuzilishini baholaydi",
  "Takroriy matnlarni topadi",
  "Akademik uslubni tekshiradi",
];

const PROGRAM_FEATURES = [
  "Times New Roman, 14 pt",
  "1.5 qator oralig'i",
  "OTM marginlari (3/1.5/2 cm)",
  "Ikki tomondan tekislangan matn",
  "Sarlavhalar standartlashtiriladi",
  "Ortiqcha bo'shliqlar o'chiriladi",
];

function ScoreBar({ label, before, after }: { label: string; before: number; after: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">
          {before} → <span className="text-emerald-400 font-bold">{after}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-400 transition-all duration-700"
          style={{ width: `${after}%` }}
        />
      </div>
    </div>
  );
}

function downloadBase64Docx(base64: string, fileName: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function HujjatTozalashPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<HujjatStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [report, setReport] = useState<CleaningReport | null>(null);
  const [outputFile, setOutputFile] = useState<{ base64: string; name: string } | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const userId = localStorage.getItem("telegram_user_id");
      if (!userId) {
        setStats(null);
        return;
      }

      const res = await fetch(`/api/hujjat-tozalash/stats?telegram_id=${userId}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Stats fetch error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [fetchStats]);

  const limitReached =
    stats !== null && !stats.isUnlimited && stats.used >= stats.limit;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selected = acceptedFiles[0];
      if (!selected) return;

      if (!selected.name.toLowerCase().endsWith(".docx")) {
        setError("Faqat .docx fayl yuklang");
        return;
      }

      const maxBytes = (stats?.maxFileMb ?? 5) * 1024 * 1024;
      if (selected.size > maxBytes) {
        setError(`Fayl hajmi ${stats?.maxFileMb ?? 5} MB dan oshmasligi kerak`);
        return;
      }

      setFile(selected);
      setReport(null);
      setOutputFile(null);
      setError(null);
    },
    [stats]
  );

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    noClick: true,
    multiple: false,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  const startProgressAnimation = () => {
    setProgressStep(0);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgressStep((prev) => (prev < PROCESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 8000);
  };

  const stopProgressAnimation = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgressStep(PROCESS_STEPS.length - 1);
  };

  const getUserId = (): string | null => localStorage.getItem("telegram_user_id");

  const handleClean = async (delivery: "download" | "telegram" = "download") => {
    if (!file || limitReached) return;

    const userId = getUserId();
    if (!userId) {
      setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setReport(null);
      setOutputFile(null);
      startProgressAnimation();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("telegram_user_id", userId);
      formData.append("delivery", delivery);

      const response = await fetch("/api/hujjat-tozalash", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Xatolik yuz berdi");
      }

      stopProgressAnimation();
      setReport(data.report);

      if (data.fileBase64) {
        setOutputFile({ base64: data.fileBase64, name: data.fileName });
        if (delivery === "download") {
          downloadBase64Docx(data.fileBase64, data.fileName);
        }
      }

      if (delivery === "telegram") {
        alert("✅ Tozalangan hujjat Telegram chatga yuborildi");
      }

      await fetchStats();
    } catch (err: unknown) {
      stopProgressAnimation();
      const message = err instanceof Error ? err.message : "Xatolik yuz berdi";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1724] text-white selection:bg-orange-500/30">
      <div className="max-w-md mx-auto px-4 py-4 pb-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/talaba-tools"
            className="h-11 w-11 rounded-[16px] bg-[#243140] border border-white/5 flex items-center justify-center text-lg hover:bg-slate-700 transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Hujjat Tozalash</h1>
            <p className="text-slate-400 text-xs">
              AI tahlil + OTM formatiga avtomatik tayyorlash
            </p>
          </div>
        </div>

        {/* Limit badge */}
        {!statsLoading && stats && (
          <div
            className={`rounded-[20px] border px-4 py-3 mb-4 text-xs ${
              limitReached
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-[#243140] border-orange-500/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Bugungi limit:</span>
              <span className={`font-extrabold ${limitReached ? "text-rose-400" : "text-orange-400"}`}>
                {stats.isUnlimited ? "Cheksiz" : `${stats.used}/${stats.limit}`}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-500">Maks. hajm / bet:</span>
              <span className="text-slate-300 font-bold">
                {stats.maxFileMb} MB · {stats.maxPages} bet
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-500">Tarif:</span>
              <span className="text-slate-300 font-bold uppercase">{stats.plan}</span>
            </div>
          </div>
        )}

        {limitReached && (
          <div className="rounded-[20px] bg-amber-500/10 border border-amber-500/25 px-4 py-3 mb-4 text-xs space-y-2">
            <p className="text-amber-400 font-semibold">
              ⚠️ Bugungi limit tugagan. Ertaga qayting yoki tarifni yangilang.
            </p>
            <Link
              href="/premium"
              className="block w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-center active:scale-95 transition-all"
            >
              👑 Tarifni yangilash
            </Link>
          </div>
        )}

        {/* Process flow */}
        <div className="rounded-[24px] bg-[#243140] border border-orange-500/15 p-4 mb-4">
          <h2 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-3">
            📋 Jarayon
          </h2>
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            {["📤 Yuklash", "🤖 AI", "⚙️ Tozalash", "📥 Yuklab olish"].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-base">{step.split(" ")[0]}</span>
                <span className="text-center leading-tight">{step.split(" ").slice(1).join(" ")}</span>
                {i < 3 && <span className="hidden" />}
              </div>
            ))}
          </div>
        </div>

        {/* AI + Program features */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-[20px] bg-[#243140] border border-violet-500/15 p-3">
            <h3 className="text-[10px] font-bold text-violet-400 uppercase mb-2">🤖 AI tahlil</h3>
            <ul className="space-y-1">
              {AI_FEATURES.map((f, i) => (
                <li key={i} className="text-[10px] text-slate-400 flex gap-1">
                  <span className="text-violet-400 shrink-0">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[20px] bg-[#243140] border border-emerald-500/15 p-3">
            <h3 className="text-[10px] font-bold text-emerald-400 uppercase mb-2">⚙️ Dastur</h3>
            <ul className="space-y-1">
              {PROGRAM_FEATURES.map((f, i) => (
                <li key={i} className="text-[10px] text-slate-400 flex gap-1">
                  <span className="text-emerald-400 shrink-0">•</span>{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Upload zone */}
        <div
          {...getRootProps()}
          className="rounded-[28px] border-2 border-dashed border-orange-500/20 bg-[#243140] p-8 text-center"
        >
          <input {...getInputProps()} />

          <div className="text-5xl mb-4">📝</div>

          <h2 className="text-lg font-semibold">
            {file ? "✅ Fayl tanlandi" : "Word hujjat (.docx) yuklang"}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            {file ? file.name : "Drag & Drop yoki fayl tanlang"}
          </p>

          <p className="text-slate-500 text-[11px] mt-1">
            Maks: {stats?.maxFileMb ?? 5} MB · {stats?.maxPages ?? 5} betgacha
          </p>

          <button
            type="button"
            onClick={open}
            disabled={limitReached || loading}
            className="mt-5 rounded-[18px] bg-orange-500 text-black font-semibold px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            Fayl tanlash
          </button>

          {file && !loading && !report && (
            <button
              type="button"
              onClick={() => handleClean("download")}
              disabled={limitReached}
              className="mt-3 w-full rounded-[18px] bg-cyan-500 text-black font-bold px-5 py-3.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              ✨ Hujjatni tozalash
            </button>
          )}
        </div>

        {/* Progress */}
        {loading && (
          <div className="mt-4 rounded-[24px] bg-[#243140] border border-cyan-500/20 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span className="text-sm font-semibold text-cyan-400">
                {PROCESS_STEPS[progressStep]?.icon} {PROCESS_STEPS[progressStep]?.label}...
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-cyan-400 transition-all duration-1000"
                style={{ width: `${((progressStep + 1) / PROCESS_STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              AI tahlil 30–60 soniya davom etishi mumkin
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-xs">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {report && (
          <div className="mt-4 space-y-3">
            {/* Score card */}
            <div className="rounded-[24px] bg-gradient-to-br from-[#243140] to-[#1a2535] border border-emerald-500/25 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-emerald-400">📊 Hujjat sifati</h3>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400">
                    {report.beforeScore.overall}
                  </span>
                  <span className="text-slate-500 mx-1">→</span>
                  <span className="text-3xl font-black text-emerald-300">
                    {report.afterScore.overall}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <ScoreBar label="Format" before={report.beforeScore.formatting} after={report.afterScore.formatting} />
                <ScoreBar label="Tuzilma" before={report.beforeScore.structure} after={report.afterScore.structure} />
                <ScoreBar label="Akademik uslub" before={report.beforeScore.academic} after={report.afterScore.academic} />
                <ScoreBar label="O'qilish" before={report.beforeScore.readability} after={report.afterScore.readability} />
              </div>
            </div>

            {/* Fixes summary */}
            <div className="rounded-[20px] bg-[#243140] border border-orange-500/15 p-4">
              <h3 className="text-xs font-bold text-orange-400 uppercase mb-2">
                🔧 Tuzatilgan ({report.fixes.totalIssuesFixed})
              </h3>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                {report.fixes.fontsUnified > 0 && <span>✓ Shrift birlashtirildi</span>}
                {report.fixes.marginsCorrected > 0 && <span>✓ Marginlar tuzatildi</span>}
                {report.fixes.headingsStandardized > 0 && (
                  <span>✓ {report.fixes.headingsStandardized} sarlavha</span>
                )}
                {report.fixes.doubleSpacesFixed > 0 && (
                  <span>✓ {report.fixes.doubleSpacesFixed} ortiqcha bo'shliq</span>
                )}
                {report.fixes.duplicatesRemoved > 0 && (
                  <span>✓ {report.fixes.duplicatesRemoved} takroriy matn</span>
                )}
                {report.fixes.emptyParagraphsRemoved > 0 && (
                  <span>✓ {report.fixes.emptyParagraphsRemoved} bo'sh qator</span>
                )}
                {report.fixes.paragraphsFixed > 0 && (
                  <span>✓ {report.fixes.paragraphsFixed} paragraf</span>
                )}
                {report.fixes.tablesImproved > 0 && (
                  <span>✓ {report.fixes.tablesImproved} jadval</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                {report.pageCount} bet · {report.wordCount} so'z ·{" "}
                {(report.processingTimeMs / 1000).toFixed(1)}s
              </p>
            </div>

            {/* Grammar suggestions */}
            {report.grammarSuggestions.length > 0 && (
              <div className="rounded-[20px] bg-[#243140] border border-violet-500/15 p-4">
                <h3 className="text-xs font-bold text-violet-400 uppercase mb-2">
                  ✏️ Grammatika tavsiyalari
                </h3>
                <ul className="space-y-2">
                  {report.grammarSuggestions.slice(0, 5).map((g, i) => (
                    <li key={i} className="text-[11px] text-slate-300 border-l-2 border-violet-500/40 pl-2">
                      <span className="line-through text-slate-500">{g.original}</span>
                      <br />
                      <span className="text-violet-300">→ {g.suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues & recommendations */}
            {(report.issues.length > 0 || report.recommendations.length > 0) && (
              <div className="rounded-[20px] bg-[#243140] border border-slate-600/30 p-4">
                {report.issues.length > 0 && (
                  <>
                    <h3 className="text-xs font-bold text-amber-400 uppercase mb-2">⚠️ Aniqlangan muammolar</h3>
                    <ul className="space-y-1 mb-3">
                      {report.issues.map((issue, i) => (
                        <li key={i} className="text-[11px] text-slate-400">• {issue}</li>
                      ))}
                    </ul>
                  </>
                )}
                {report.recommendations.length > 0 && (
                  <>
                    <h3 className="text-xs font-bold text-cyan-400 uppercase mb-2">💡 Tavsiyalar</h3>
                    <ul className="space-y-1">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="text-[11px] text-slate-400">• {rec}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Download actions */}
            <div className="space-y-2">
              {outputFile && (
                <button
                  type="button"
                  onClick={() => downloadBase64Docx(outputFile.base64, outputFile.name)}
                  className="w-full rounded-[18px] bg-emerald-500 text-black font-bold px-5 py-3.5 active:scale-95 transition-all"
                >
                  📥 Tozalangan DOCX yuklab olish
                </button>
              )}
              <button
                type="button"
                onClick={() => handleClean("telegram")}
                disabled={loading || limitReached}
                className="w-full rounded-[18px] bg-[#1b2635] border border-white/10 text-white font-semibold px-5 py-3.5 disabled:opacity-40 active:scale-95 transition-all"
              >
                📨 Telegram chatga yuborish
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
