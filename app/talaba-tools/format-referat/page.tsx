"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

interface ReferatStats {
  plan: string;
  referatUsed: number;
  referatLimit: number;
  isUnlimited: boolean;
}

const FORMAT_RULES = [
  "Times New Roman, 14pt asosiy matn",
  "1.5 qator oralig'i (interval)",
  "Chap 3 cm, o'ng 1.5 cm, yuqori/past 2 cm",
  "Asosiy matn ikki tomondan tekislangan",
  "Birinchi qator chetki 1.25 cm",
  "Sarlavhalar qalin shrift bilan",
  "Sahifa raqamlari pastki markazda",
];

export default function FormatReferatPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTelegramButton, setShowTelegramButton] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferatStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const userId = localStorage.getItem("telegram_user_id");
      if (!userId) {
        setStats(null);
        return;
      }

      const res = await fetch(`/api/user-stats?telegram_id=${userId}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (data.success && data.stats) {
        setStats({
          plan: data.stats.plan,
          referatUsed: data.stats.referatUsed,
          referatLimit: data.stats.referatLimit,
          isUnlimited: data.stats.isUnlimited,
        });
      }
    } catch (err) {
      console.error("Stats fetch error:", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const limitReached =
    stats !== null && !stats.isUnlimited && stats.referatUsed >= stats.referatLimit;

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selected = acceptedFiles[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith(".docx")) {
      setError("Faqat .docx fayl yuklang");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError("Fayl hajmi 5 MB dan oshmasligi kerak");
      return;
    }

    setFile(selected);
    setShowTelegramButton(false);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, open } = useDropzone({
    onDrop,
    noClick: true,
    multiple: false,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.files;
      if (!items?.length) return;

      const pastedFile = items[0];
      if (pastedFile && pastedFile.name.toLowerCase().endsWith(".docx")) {
        if (pastedFile.size > 5 * 1024 * 1024) {
          setError("Fayl hajmi 5 MB dan oshmasligi kerak");
          return;
        }
        setFile(pastedFile);
        setShowTelegramButton(false);
        setError(null);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const getUserId = (): string | null => {
    return localStorage.getItem("telegram_user_id");
  };

  const handleApiError = async (response: Response) => {
    let message = "Xatolik yuz berdi";
    try {
      const data = await response.json();
      message = data.error || data.message || message;

      if (data.code === "LIMIT_REACHED") {
        await fetchStats();
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  };

  const handleFormat = async () => {
    if (!file || limitReached) return;

    const userId = getUserId();
    if (!userId) {
      setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("telegram_user_id", userId);

      const response = await fetch("/api/format-referat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name.replace(/\.docx$/i, "") + "_OTM.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setShowTelegramButton(true);
      await fetchStats();
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Xatolik yuz berdi";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTelegramSend = async () => {
    if (!file || limitReached) return;

    const userId = getUserId();
    if (!userId) {
      setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("telegram_user_id", userId);
      formData.append("send_to_telegram", "true");

      const response = await fetch("/api/format-referat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      alert("✅ Formatlangan referat Telegram chatga yuborildi");
      setShowTelegramButton(false);
      await fetchStats();
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Telegramga yuborishda xatolik";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0f1724] text-white selection:bg-emerald-500/30">
      <div className="max-w-md mx-auto px-4 py-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
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
              Referat Formatlash
            </h1>
            <p className="text-slate-400 text-xs">
              Word hujjatni OTM standartiga moslashtirish
            </p>
          </div>
        </div>

        {/* Limit badge */}
        {!statsLoading && stats && (
          <div
            className={`rounded-[20px] border px-4 py-3 mb-4 text-xs ${
              limitReached
                ? "bg-rose-500/10 border-rose-500/30"
                : "bg-[#243140] border-cyan-500/15"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Bugungi referat limiti:</span>
              <span
                className={`font-extrabold ${
                  limitReached ? "text-rose-400" : "text-cyan-400"
                }`}
              >
                {stats.isUnlimited
                  ? "Cheksiz"
                  : `${stats.referatUsed}/${stats.referatLimit}`}
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
              ⚠️ Bugungi referat limiti tugagan. Formatlash uchun ertaga qayting yoki tarifni yangilang.
            </p>
            <Link
              href="/premium"
              className="block w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-center active:scale-95 transition-all"
            >
              👑 Tarifni yangilash
            </Link>
          </div>
        )}

        {/* OTM rules */}
        <div className="rounded-[24px] bg-[#243140] border border-emerald-500/15 p-4 mb-4">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
            📋 OTM format qoidalari
          </h2>
          <ul className="space-y-1.5 text-[12px] text-slate-300">
            {FORMAT_RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">✓</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Upload zone */}
        <div
          {...getRootProps()}
          className="
            rounded-[28px]
            border-2 border-dashed border-emerald-500/20
            bg-[#243140]
            p-8 text-center
          "
        >
          <input {...getInputProps()} />

          <div className="text-5xl mb-4">📄</div>

          <h2 className="text-lg font-semibold">
            {file ? "✅ Fayl tanlandi" : "Referat (.docx) yuklang"}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            {file ? file.name : "Drag & Drop, Ctrl+V yoki fayl tanlang"}
          </p>

          <p className="text-slate-500 text-[11px] mt-1">Maksimal hajm: 5 MB</p>

          <button
            type="button"
            onClick={open}
            disabled={limitReached}
            className="
              mt-5 rounded-[18px]
              bg-emerald-500 text-black font-semibold
              px-5 py-3
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-95 transition-all
            "
          >
            Fayl tanlash
          </button>

          {file && (
            <>
              <button
                type="button"
                onClick={handleFormat}
                disabled={loading || limitReached}
                className="
                  mt-3 w-full rounded-[18px]
                  bg-cyan-500 text-black font-bold
                  px-5 py-3.5
                  disabled:opacity-40 disabled:cursor-not-allowed
                  active:scale-95 transition-all
                "
              >
                {loading ? "⏳ Formatlanmoqda..." : "✨ OTM formatiga moslashtirish"}
              </button>

              {showTelegramButton && (
                <button
                  type="button"
                  onClick={handleTelegramSend}
                  disabled={loading || limitReached}
                  className="
                    mt-3 w-full rounded-[18px]
                    bg-[#1b2635] border border-white/10 text-white font-semibold
                    px-5 py-3.5
                    disabled:opacity-40 disabled:cursor-not-allowed
                    active:scale-95 transition-all
                  "
                >
                  📨 Telegram chatga yuborish
                </button>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-xs">
            ⚠️ {error}
          </div>
        )}
      </div>
    </main>
  );
}
