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
  const [isOpen, setIsOpen] = useState(false);

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
      <div className="w-full rounded-2xl border border-cyan-500/10 bg-gradient-to-b from-[#1a2635] to-[#16202d] p-3 animate-pulse mb-3 h-[50px] flex items-center justify-between">
        <div className="h-4 w-20 bg-slate-700/50 rounded"></div>
        <div className="flex gap-2.5">
          <div className="h-4 w-10 bg-slate-700/30 rounded"></div>
          <div className="h-4 w-10 bg-slate-700/30 rounded"></div>
          <div className="h-4 w-10 bg-slate-700/30 rounded"></div>
        </div>
      </div>
    );
  }

  // Graceful fail
  if (error || !stats) {
    return null;
  }

  const getPercent = (used: number, limit: number) => {
    if (stats.isUnlimited) return 100;
    if (limit <= 0) return 0;
    return Math.min(100, (used / limit) * 100);
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-scale-up { animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* Compact Horizontal Card */}
      <div 
        onClick={() => setIsOpen(true)}
        className="w-full h-[50px] rounded-2xl border border-cyan-500/15 bg-gradient-to-r from-[#1a2635] to-[#121c29] px-4 flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-[0.98] shadow-[0_4px_20px_rgba(0,180,255,0.04)] hover:border-cyan-500/30 mb-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <span className="font-extrabold text-xs text-slate-300">Limit:</span>
          <span className={`text-[9px] tracking-wider uppercase font-black px-2 py-0.5 rounded-md border ${
            stats.isUnlimited 
              ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
              : "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
          }`}>
            {stats.plan}
          </span>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
          <div className="flex items-center gap-1">
            <span>📸</span>
            <span>{stats.scanUsed}/{stats.isUnlimited ? "∞" : stats.scanLimit}</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-1">
            <span>📄</span>
            <span>{stats.pdfUsed}/{stats.isUnlimited ? "∞" : stats.pdfLimit}</span>
          </div>
          <div className="w-px h-3 bg-slate-800" />
          <div className="flex items-center gap-1">
            <span>📊</span>
            <span>{stats.pptUsed}/{stats.isUnlimited ? "∞" : stats.pptLimit}</span>
          </div>
        </div>
      </div>

      {/* Interactive Expandable Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="relative w-full max-w-[300px] rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-[#1a2635] to-[#16202d] p-5 shadow-[0_0_40px_rgba(0,180,255,0.15)] animate-scale-up"
            onClick={(e) => e.stopPropagation()} // Prevent close on modal body click
          >
            {/* Close button */}
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-all text-base p-1"
            >
              ✕
            </button>

            {/* Title */}
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl">📊</span>
              <h3 className="font-extrabold text-sm text-slate-200">Bugungi limit</h3>
              <span className={`text-[9px] tracking-wider uppercase font-black px-2 py-0.5 rounded-full border ml-auto ${
                stats.isUnlimited 
                  ? "bg-amber-500/15 border-amber-500/35 text-amber-400"
                  : "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
              }`}>
                {stats.plan}
              </span>
            </div>

            {/* Details with progress indicators */}
            <div className="space-y-4">
              {/* Scan */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span>📸 Scan</span>
                  <span>{stats.scanUsed}/{stats.isUnlimited ? "∞" : stats.scanLimit}</span>
                </div>
                <div className="h-1.5 w-full bg-[#121c29] rounded-full overflow-hidden border border-slate-800">
                  <div 
                    style={{ width: `${getPercent(stats.scanUsed, stats.scanLimit)}%` }} 
                    className={`h-full rounded-full transition-all duration-500 ${
                      !stats.isUnlimited && stats.scanUsed >= stats.scanLimit
                        ? "bg-gradient-to-r from-rose-500 to-red-400"
                        : "bg-gradient-to-r from-sky-500 to-cyan-400"
                    }`}
                  />
                </div>
              </div>

              {/* PDF */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span>📄 PDF</span>
                  <span>{stats.pdfUsed}/{stats.isUnlimited ? "∞" : stats.pdfLimit}</span>
                </div>
                <div className="h-1.5 w-full bg-[#121c29] rounded-full overflow-hidden border border-slate-800">
                  <div 
                    style={{ width: `${getPercent(stats.pdfUsed, stats.pdfLimit)}%` }} 
                    className={`h-full rounded-full transition-all duration-500 ${
                      !stats.isUnlimited && stats.pdfUsed >= stats.pdfLimit
                        ? "bg-gradient-to-r from-rose-500 to-red-400"
                        : "bg-gradient-to-r from-emerald-500 to-teal-400"
                    }`}
                  />
                </div>
              </div>

              {/* PPT */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                  <span>📊 PPT</span>
                  <span>{stats.pptUsed}/{stats.isUnlimited ? "∞" : stats.pptLimit}</span>
                </div>
                <div className="h-1.5 w-full bg-[#121c29] rounded-full overflow-hidden border border-slate-800">
                  <div 
                    style={{ width: `${getPercent(stats.pptUsed, stats.pptLimit)}%` }} 
                    className={`h-full rounded-full transition-all duration-500 ${
                      !stats.isUnlimited && stats.pptUsed >= stats.pptLimit
                        ? "bg-gradient-to-r from-rose-500 to-red-400"
                        : "bg-gradient-to-r from-violet-500 to-fuchsia-400"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Upgrade CTA */}
            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = "/premium";
              }}
              className="w-full mt-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 font-extrabold text-slate-900 text-xs shadow-md active:scale-95 transition-all"
            >
              🚀 Upgrade Premium
            </button>
          </div>
        </div>
      )}
    </>
  );
}
