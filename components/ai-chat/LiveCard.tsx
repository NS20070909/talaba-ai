"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface LiveCardProps {
  onStartLive: () => void;
  personaName?: string;
  isLiveActive?: boolean;
  remainingSeconds?: number;
  liveLimitMinutes?: number;
}

export default function LiveCard({
  onStartLive,
  personaName = "Olim",
  isLiveActive = false,
  remainingSeconds,
  liveLimitMinutes = 20,
}: LiveCardProps) {
  const router = useRouter();
  const isExhausted = remainingSeconds !== undefined && remainingSeconds <= 0;
  const remainingMins = remainingSeconds !== undefined ? Math.floor(remainingSeconds / 60) : liveLimitMinutes;

  return (
    <section className="relative overflow-hidden mb-2.5 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#111e2e] via-[#142337] to-[#121c29] p-3 sm:p-3.5 shadow-[0_0_25px_rgba(6,182,212,0.10)]">
      {/* Background soft glow blobs */}
      <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-3">
          {/* Animated Microphone Icon with waveform rings */}
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 font-black text-xl shadow-md shadow-cyan-500/25">
            <span className="relative z-10">🎙️</span>
            <span className="absolute inset-0 rounded-xl bg-cyan-400 animate-ping opacity-25" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1">
                JONLI OVOZLI SUHBAT
              </h2>
              <span className="rounded-full bg-cyan-400/20 px-1.5 py-0.2 text-[9px] font-bold text-cyan-300 uppercase tracking-wide border border-cyan-400/30">
                Gemini Live
              </span>
              <span className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold border ${
                isExhausted 
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/30" 
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              }`}>
                {isExhausted ? "Bugun tugadi" : `⏱️ Bugun: ${remainingMins} daq qoldi`}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
              AI bilan kechikishsiz, real vaqtda gaplashing. So‘zini bemalol bo‘lish mumkin.
            </p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                👤 {personaName === "zilola" ? "👩 Zilola (Do‘stona)" : "👨 Olim (Akademik)"}
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">Barcha fanlar & IELTS</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={isExhausted ? () => router.push("/premium") : onStartLive}
            className={`rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 active:scale-95 shadow-md flex items-center gap-1.5 ${
              isLiveActive
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                : isExhausted
                ? "bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-500/50 hover:text-amber-300"
                : "bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 shadow-cyan-500/25"
            }`}
          >
            <span>
              {isLiveActive
                ? "■ Davom etmoqda"
                : isExhausted
                ? "⭐ Premiumga o'tish"
                : "⚡ Gaplashish"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
