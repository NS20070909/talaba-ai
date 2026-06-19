"use client";

import { useEffect, useState } from "react";

interface UsageStats {
  plan: string;
  isUnlimited: boolean;
  pptUsed: number;
  pptLimit: number;
  pdfUsed: number;
  pdfLimit: number;
  scanUsed: number;
  scanLimit: number;
}

export default function UsageStatsWidget() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const userId = localStorage.getItem("telegram_user_id");
        if (!userId) {
          setError("Telegram ID topilmadi");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/user-stats?telegram_id=${userId}`);
        const data = await res.json();
        
        if (data.success) {
          setStats(data.stats);
        } else {
          setError(data.message || "Xatolik yuz berdi");
        }
      } catch (err) {
        console.error("Widget fetch error:", err);
        setError("Ulanishda xatolik");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="w-full rounded-[26px] border border-cyan-500/10 bg-gradient-to-b from-[#1a2635] to-[#16202d] p-4 animate-pulse mb-3">
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 w-24 bg-slate-700/50 rounded-lg"></div>
          <div className="h-5 w-16 bg-slate-700/50 rounded-full"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="flex justify-between mb-1">
                <div className="h-3 w-16 bg-slate-700/30 rounded"></div>
                <div className="h-3 w-8 bg-slate-700/30 rounded"></div>
              </div>
              <div className="h-1.5 w-full bg-slate-800/40 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Graceful fail - render nothing if there is an error or no stats found
  if (error || !stats) {
    return null;
  }

  const getPercent = (used: number, limit: number) => {
    if (stats.isUnlimited) return 100;
    if (limit <= 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  return (
    <div className="w-full rounded-[26px] border border-cyan-500/10 bg-gradient-to-b from-[#1a2635] to-[#16202d] p-4 shadow-[0_0_30px_rgba(0,180,255,0.06)] mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className="font-bold text-sm text-slate-200">Bugungi limit</h3>
        </div>
        <span className={`text-[10px] tracking-wider uppercase font-extrabold px-2.5 py-1 rounded-full border ${
          stats.isUnlimited 
            ? "bg-amber-500/15 border-amber-500/35 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            : "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
        }`}>
          {stats.plan}
        </span>
      </div>

      {/* Progress Bars */}
      <div className="space-y-4">
        {/* Scan Usage */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <span>📸</span> Scan
            </span>
            <span>
              {stats.scanUsed}/{stats.isUnlimited ? "∞" : stats.scanLimit}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#121c29] rounded-full overflow-hidden border border-slate-800">
            <div 
              style={{ width: `${getPercent(stats.scanUsed, stats.scanLimit)}%` }} 
              className={`h-full rounded-full transition-all duration-500 ${
                !stats.isUnlimited && stats.scanUsed >= stats.scanLimit
                  ? "bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                  : "bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
              }`}
            />
          </div>
        </div>

        {/* PDF Usage */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <span>📄</span> PDF
            </span>
            <span>
              {stats.pdfUsed}/{stats.isUnlimited ? "∞" : stats.pdfLimit}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#121c29] rounded-full overflow-hidden border border-slate-800">
            <div 
              style={{ width: `${getPercent(stats.pdfUsed, stats.pdfLimit)}%` }} 
              className={`h-full rounded-full transition-all duration-500 ${
                !stats.isUnlimited && stats.pdfUsed >= stats.pdfLimit
                  ? "bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                  : "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
              }`}
            />
          </div>
        </div>

        {/* PPT Usage */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <span>📊</span> PPT
            </span>
            <span>
              {stats.pptUsed}/{stats.isUnlimited ? "∞" : stats.pptLimit}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#121c29] rounded-full overflow-hidden border border-slate-800">
            <div 
              style={{ width: `${getPercent(stats.pptUsed, stats.pptLimit)}%` }} 
              className={`h-full rounded-full transition-all duration-500 ${
                !stats.isUnlimited && stats.pptUsed >= stats.pptLimit
                  ? "bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                  : "bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-[0_0_8px_rgba(168,85,247,0.3)]"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
