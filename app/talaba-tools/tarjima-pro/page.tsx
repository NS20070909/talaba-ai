"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";

type LangCode = "uz" | "en" | "ru";
type InputMode = "text" | "file";

interface TarjimaStats {
  plan: string;
  used: number;
  limit: number;
  isUnlimited: boolean;
  maxPages: number;
  maxFileMb: number;
  maxTextChars: number;
  allowPdf: boolean;
  allowAcademic: boolean;
}

interface TranslationMeta {
  sourceLang: LangCode;
  targetLang: LangCode;
  mode: string;
  academic: boolean;
  model: string;
  processingTimeMs: number;
  wordCount: number;
  pageCount: number;
}

const LANG_OPTIONS: { code: LangCode; label: string; flag: string }[] = [
  { code: "uz", label: "O'zbek", flag: "🇺🇿" },
  { code: "en", label: "Ingliz", flag: "🇬🇧" },
  { code: "ru", label: "Rus", flag: "🇷🇺" },
];

const PROCESS_STEPS = [
  { label: "Matn tahlil qilinmoqda", icon: "🔍" },
  { label: "AI model tanlanmoqda", icon: "🤖" },
  { label: "Professional tarjima", icon: "🌍" },
  { label: "Natija tayyorlanmoqda", icon: "✨" },
];

const FEATURES = [
  "Matn, Word (DOCX) va PDF tarjima",
  "Format saqlangan DOCX chiqish",
  "Akademik uslub (Premium)",
  "UZ ↔ EN ↔ RU yo'nalishlar",
  "Bir bosishda nusxa olish",
  "Yuklab olish (DOCX / PDF)",
];

function downloadBase64(base64: string, fileName: string, mimeType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function TarjimaProPage() {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [sourceLang, setSourceLang] = useState<LangCode>("uz");
  const [targetLang, setTargetLang] = useState<LangCode>("en");
  const [academic, setAcademic] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TarjimaStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [meta, setMeta] = useState<TranslationMeta | null>(null);
  const [outputFile, setOutputFile] = useState<{ base64: string; name: string } | null>(null);
  const [pdfFile, setPdfFile] = useState<{ base64: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const userId = localStorage.getItem("telegram_user_id");
      if (!userId) {
        setStats(null);
        return;
      }

      const res = await fetch(`/api/tarjima-pro/stats?telegram_id=${userId}&t=${Date.now()}`, {
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

  useEffect(() => {
    if (stats && !stats.allowAcademic && academic) {
      setAcademic(false);
    }
  }, [stats, academic]);

  const limitReached =
    stats !== null && !stats.isUnlimited && stats.used >= stats.limit;

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selected = acceptedFiles[0];
      if (!selected) return;

      const lower = selected.name.toLowerCase();
      const isDocx = lower.endsWith(".docx");
      const isPdf = lower.endsWith(".pdf");

      if (!isDocx && !isPdf) {
        setError("Faqat .docx yoki .pdf fayl yuklang");
        return;
      }

      if (isPdf && stats && !stats.allowPdf) {
        setError("PDF tarjima faqat Premium tarifda mavjud");
        return;
      }

      const maxBytes = (stats?.maxFileMb ?? 5) * 1024 * 1024;
      if (selected.size > maxBytes) {
        setError(`Fayl hajmi ${stats?.maxFileMb ?? 5} MB dan oshmasligi kerak`);
        return;
      }

      setFile(selected);
      setResult(null);
      setOutputFile(null);
      setPdfFile(null);
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
      "application/pdf": [".pdf"],
    },
  });

  const startProgress = () => {
    setProgressStep(0);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgressStep((prev) => (prev < PROCESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 6000);
  };

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgressStep(PROCESS_STEPS.length - 1);
  };

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleTranslate = async () => {
    if (limitReached) return;

    const userId = localStorage.getItem("telegram_user_id");
    if (!userId) {
      setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }

    if (sourceLang === targetLang) {
      setError("Manba va maqsad tillar bir xil bo'lmasligi kerak");
      return;
    }

    if (inputMode === "text" && !text.trim()) {
      setError("Tarjima qilish uchun matn kiriting");
      return;
    }

    if (inputMode === "file" && !file) {
      setError("Fayl tanlang");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setOutputFile(null);
      setPdfFile(null);
      setMeta(null);
      startProgress();

      let response: Response;

      if (inputMode === "file" && file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("telegram_user_id", userId);
        formData.append("source_lang", sourceLang);
        formData.append("target_lang", targetLang);
        formData.append("academic", String(academic));

        response = await fetch("/api/tarjima-pro", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/tarjima-pro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegram_user_id: userId,
            text: text.trim(),
            source_lang: sourceLang,
            target_lang: targetLang,
            academic,
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Xatolik yuz berdi");
      }

      stopProgress();
      setResult(data.translatedText);
      setMeta(data.meta);

      if (data.fileBase64 && data.fileName) {
        setOutputFile({ base64: data.fileBase64, name: data.fileName });
      }
      if (data.pdfBase64 && data.pdfFileName) {
        setPdfFile({ base64: data.pdfBase64, name: data.pdfFileName });
      }

      await fetchStats();
    } catch (err: unknown) {
      stopProgress();
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nusxa olishda xatolik");
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1724] text-white selection:bg-pink-500/30">
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
            <h1 className="text-[24px] font-bold tracking-tight">Tarjima Pro</h1>
            <p className="text-slate-400 text-xs">
              AI yordamida professional tarjima
            </p>
          </div>
        </div>

        {/* Limit badge */}
        {!statsLoading && stats && (
          <div
            className={`rounded-[20px] border px-4 py-3 mb-4 text-xs ${
              limitReached
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-[#243140] border-pink-500/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Bugungi limit:</span>
              <span className={`font-extrabold ${limitReached ? "text-rose-400" : "text-pink-400"}`}>
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

        {/* Language selector */}
        <div className="rounded-[24px] bg-[#243140] border border-pink-500/15 p-4 mb-4">
          <div className="flex items-center gap-2">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LangCode)}
              disabled={loading}
              className="flex-1 rounded-xl bg-[#1a2535] border border-white/10 px-3 py-2.5 text-sm font-semibold outline-none focus:border-pink-400/50"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={swapLanguages}
              disabled={loading}
              className="h-10 w-10 rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-300 font-bold active:scale-95 transition-all disabled:opacity-40"
              aria-label="Tillarni almashtirish"
            >
              ⇄
            </button>

            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as LangCode)}
              disabled={loading}
              className="flex-1 rounded-xl bg-[#1a2535] border border-white/10 px-3 py-2.5 text-sm font-semibold outline-none focus:border-pink-400/50"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Academic toggle */}
          <label
            className={`flex items-center gap-3 mt-3 rounded-xl px-3 py-2.5 cursor-pointer ${
              stats?.allowAcademic
                ? "bg-violet-500/10 border border-violet-500/20"
                : "bg-slate-800/50 border border-slate-700/50 opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={academic}
              onChange={(e) => setAcademic(e.target.checked)}
              disabled={!stats?.allowAcademic || loading}
              className="h-4 w-4 accent-violet-500"
            />
            <div>
              <span className="text-sm font-semibold text-violet-300">🎓 Akademik tarjima</span>
              {!stats?.allowAcademic && (
                <p className="text-[10px] text-slate-500">Premium tarifda ochiladi</p>
              )}
            </div>
          </label>
        </div>

        {/* Input mode tabs */}
        <div className="flex gap-2 mb-4">
          {(["text", "file"] as InputMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setInputMode(mode);
                setError(null);
              }}
              disabled={loading}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                inputMode === mode
                  ? "bg-pink-500 text-black"
                  : "bg-[#243140] text-slate-400 border border-white/5"
              }`}
            >
              {mode === "text" ? "📝 Matn" : "📄 Fayl"}
            </button>
          ))}
        </div>

        {/* Features */}
        <div className="rounded-[20px] bg-[#243140] border border-pink-500/10 p-3 mb-4">
          <h3 className="text-[10px] font-bold text-pink-400 uppercase mb-2">Imkoniyatlar</h3>
          <ul className="grid grid-cols-2 gap-1">
            {FEATURES.map((f, i) => (
              <li key={i} className="text-[10px] text-slate-400 flex gap-1">
                <span className="text-pink-400 shrink-0">•</span>{f}
              </li>
            ))}
          </ul>
        </div>

        {/* Text input */}
        {inputMode === "text" && (
          <div className="rounded-[24px] bg-[#243140] border border-pink-500/15 p-4 mb-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading || limitReached}
              placeholder="Tarjima qilish uchun matn kiriting..."
              rows={6}
              maxLength={stats?.maxTextChars ?? 5000}
              className="w-full rounded-xl bg-[#1a2535] border border-white/10 px-3 py-3 text-sm outline-none focus:border-pink-400/50 resize-none disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-500 mt-1 text-right">
              {text.length.toLocaleString()} / {(stats?.maxTextChars ?? 5000).toLocaleString()}
            </p>
          </div>
        )}

        {/* File upload */}
        {inputMode === "file" && (
          <div
            {...getRootProps()}
            className="rounded-[28px] border-2 border-dashed border-pink-500/20 bg-[#243140] p-8 text-center mb-4"
          >
            <input {...getInputProps()} />

            <div className="text-5xl mb-4">🌍</div>

            <h2 className="text-lg font-semibold">
              {file ? "✅ Fayl tanlandi" : "DOCX yoki PDF yuklang"}
            </h2>

            <p className="text-slate-400 text-sm mt-2">
              {file ? file.name : "Drag & Drop yoki fayl tanlang"}
            </p>

            <p className="text-slate-500 text-[11px] mt-1">
              {stats?.allowPdf
                ? `DOCX / PDF · maks ${stats.maxFileMb} MB · ${stats.maxPages} bet`
                : `Faqat DOCX (FREE) · maks ${stats?.maxFileMb ?? 5} MB · ${stats?.maxPages ?? 5} bet`}
            </p>

            <button
              type="button"
              onClick={open}
              disabled={limitReached || loading}
              className="mt-5 rounded-[18px] bg-pink-500 text-black font-semibold px-5 py-3 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              Fayl tanlash
            </button>
          </div>
        )}

        {/* Translate button */}
        {!loading && (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={
              limitReached ||
              (inputMode === "text" && !text.trim()) ||
              (inputMode === "file" && !file)
            }
            className="w-full rounded-[18px] bg-gradient-to-r from-pink-500 to-rose-500 text-black font-bold px-5 py-3.5 mb-4 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_0_20px_rgba(236,72,153,0.2)]"
          >
            🌍 Tarjima qilish
          </button>
        )}

        {/* Progress */}
        {loading && (
          <div className="rounded-[24px] bg-[#243140] border border-pink-500/20 p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />
              <span className="text-sm font-semibold text-pink-400">
                {PROCESS_STEPS[progressStep]?.icon} {PROCESS_STEPS[progressStep]?.label}...
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-400 transition-all duration-1000"
                style={{ width: `${((progressStep + 1) / PROCESS_STEPS.length) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              AI tarjima 15–60 soniya davom etishi mumkin
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-xs mb-4">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="rounded-[24px] bg-gradient-to-br from-[#243140] to-[#1a2535] border border-pink-500/25 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-pink-400">✨ Tarjima natijasi</h3>
                {meta && (
                  <span className="text-[10px] text-slate-500">
                    {(meta.processingTimeMs / 1000).toFixed(1)}s · {meta.model.split("-").slice(0, 2).join("-")}
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-[#1a2535] border border-white/5 p-3 max-h-64 overflow-y-auto">
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{result}</p>
              </div>

              {meta && (
                <p className="text-[10px] text-slate-500 mt-2">
                  {meta.wordCount} so&apos;z · {meta.pageCount} bet ·{" "}
                  {meta.academic ? "Akademik" : "Standart"} uslub
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-[18px] bg-[#1b2635] border border-white/10 text-white font-semibold px-4 py-3 active:scale-95 transition-all"
              >
                {copied ? "✅ Nusxa olindi" : "📋 Copy"}
              </button>

              {outputFile && (
                <button
                  type="button"
                  onClick={() =>
                    downloadBase64(
                      outputFile.base64,
                      outputFile.name,
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    )
                  }
                  className="rounded-[18px] bg-emerald-500 text-black font-bold px-4 py-3 active:scale-95 transition-all"
                >
                  📥 DOCX
                </button>
              )}
            </div>

            {pdfFile && (
              <button
                type="button"
                onClick={() =>
                  downloadBase64(pdfFile.base64, pdfFile.name, "application/pdf")
                }
                className="w-full rounded-[18px] bg-violet-500 text-black font-bold px-5 py-3.5 active:scale-95 transition-all"
              >
                📥 PDF yuklab olish
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
