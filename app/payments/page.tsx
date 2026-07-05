"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Payment {
  id: string;
  telegram_id: number;
  amount: number;
  provider: string;
  plan: string;
  status: "pending" | "paid" | "failed";
  created_at: string;
  signed_proof_url?: string | null;
}

const PLAN_DETAILS: Record<string, { name: string; icon: string }> = {
  FREE: { name: "Tekin", icon: "⚪" },
  DAY: { name: "Starter", icon: "🟢" },
  WEEK: { name: "Weekly", icon: "🔵" },
  MONTH: { name: "Premium", icon: "🟣" },
  QUARTER: { name: "Pro", icon: "🟠" },
  YEAR: { name: "Elite", icon: "👑" },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const userId = localStorage.getItem("telegram_user_id");
        if (!userId) {
          setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/payments/history?telegram_id=${userId}`);
        const data = await res.json();

        if (data.success) {
          setPayments(data.payments || []);
        } else {
          setError(data.message || "Tarixni yuklashda xatolik yuz berdi.");
        }
      } catch (err) {
        console.error("Fetch payments history error:", err);
        setError("Ulanishda xatolik yuz berdi.");
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("uz-UZ", {
        timeZone: "Asia/Tashkent",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("uz-UZ") + " so'm";
  };

  const getStatusBadge = (status: Payment["status"]) => {
    switch (status) {
      case "paid":
        return {
          badgeClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
          statusText: "🟢 paid",
        };
      case "failed":
        return {
          badgeClass: "bg-rose-500/10 border-rose-500/20 text-rose-400",
          statusText: "🔴 failed",
        };
      case "pending":
      default:
        return {
          badgeClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
          statusText: "🟡 pending",
        };
    }
  };

  return (
    <main className="min-h-screen bg-[#070b12] text-white">
      <div className="max-w-md mx-auto px-4 py-5 pb-24">
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/premium" className="text-slate-400 flex items-center gap-1 transition-all active:scale-95">
            <span>←</span> Orqaga
          </Link>
          <span className="text-slate-400 text-xs font-medium">To'lovlar tarixi</span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-xs font-bold mb-3 tracking-wider uppercase">
            📜 To'lovlar tarixi
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Xaridlar tarixi</h1>
          <p className="text-slate-400 mt-2 text-sm max-w-xs mx-auto">
            Barcha to'lovlar va ularning faollashuv holatlarini shu yerdan kuzatishingiz mumkin.
          </p>
        </div>

        {/* List of Payments */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="w-full rounded-3xl border border-slate-800 bg-[#121824]/20 p-5 animate-pulse h-28"></div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-5 text-center text-rose-400 text-sm">
            ⚠️ {error}
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-[#121824]/40 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
            <span className="text-4xl block mb-3">📁</span>
            To'lovlar tarixi bo'sh. Hali hech qanday to'lov amalga oshirilmagan.
            <div className="mt-5">
              <Link
                href="/premium"
                className="inline-block px-5 py-2.5 rounded-xl bg-cyan-400 text-slate-900 font-bold text-sm transition-all active:scale-95"
              >
                👑 Premium Sotib Olish
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => {
              const planInfo = PLAN_DETAILS[payment.plan] || { name: payment.plan, icon: "💎" };
              const badge = getStatusBadge(payment.status);

              return (
                <div
                  key={payment.id}
                  className="bg-[#121824]/40 border border-slate-800 rounded-3xl p-5 relative hover:border-slate-700 transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{planInfo.icon}</span>
                        <h3 className="font-extrabold text-base text-slate-100">{planInfo.name}</h3>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">{formatDate(payment.created_at)}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span className="font-black text-sm text-cyan-400">{formatAmount(payment.amount)}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${badge.badgeClass}`}>
                        {badge.statusText}
                      </span>
                    </div>
                  </div>

                  {payment.signed_proof_url && (
                    <div className="border-t border-slate-800/60 pt-3 mt-3 flex justify-start">
                      <a
                        href={payment.signed_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-300 transition-all active:scale-95"
                      >
                        📸 Chekni ko'rish
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
