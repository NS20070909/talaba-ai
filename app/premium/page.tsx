"use client";

import Link from "next/link";
import { useState } from "react";

export type PlanPeriod = "FREE" | "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR";

export interface PricingPlan {
  id: PlanPeriod;
  name: string;
  icon: string;
  durationText: string;
  priceText: string;
  rawPrice: number;
  badge?: string;
  limits: {
    scan: string | number;
    ppt: string | number;
    pdf: string | number;
    referat: string | number;
  };
  features: string[];
  colorClass: string;
  bgClass: string;
  glowClass: string;
  scaleClass: string;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "DAY",
    name: "Starter",
    icon: "🟢",
    durationText: "1 Kunlik",
    priceText: "2,900 so'm",
    rawPrice: 2900,
    limits: {
      scan: 5,
      ppt: 3,
      pdf: 5,
      referat: 10,
    },
    features: ["Kunlik 5 ta Scan", "Kunlik 3 ta PPT generator", "Kunlik 5 ta PDF vositalari", "Kunlik 10 ta AI Referat"],
    colorClass: "border-emerald-500/30 text-emerald-400",
    bgClass: "bg-[#162520]/40",
    glowClass: "",
    scaleClass: "hover:scale-[1.01]",
  },
  {
    id: "WEEK",
    name: "Weekly",
    icon: "🔵",
    durationText: "7 Kunlik",
    priceText: "11,900 so'm",
    rawPrice: 11900,
    limits: {
      scan: 50,
      ppt: 20,
      pdf: 50,
      referat: 50,
    },
    features: ["Haftalik 50 ta Scan", "Haftalik 20 ta PPT generator", "Haftalik 50 ta PDF vositalari", "Haftalik 50 ta AI Referat"],
    colorClass: "border-sky-500/30 text-sky-400",
    bgClass: "bg-[#112030]/40",
    glowClass: "",
    scaleClass: "hover:scale-[1.01]",
  },
  {
    id: "MONTH",
    name: "Premium",
    icon: "🟣",
    durationText: "30 Kunlik",
    priceText: "29,900 so'm",
    rawPrice: 29900,
    badge: "⭐ ENG MASHHUR",
    limits: {
      scan: 300,
      ppt: 120,
      pdf: 300,
      referat: 120,
    },
    features: [
      "Oylik 300 ta Scan",
      "Oylik 120 ta PPT generator",
      "Oylik 300 ta PDF vositalari",
      "Oylik 120 ta AI Referat (max 15 bet)",
      "Prioritetli server kirishi",
    ],
    colorClass: "border-purple-500 text-purple-400",
    bgClass: "bg-[#1f1530]/40",
    glowClass: "shadow-[0_0_25px_rgba(168,85,247,0.25)] border-purple-500/80",
    scaleClass: "hover:scale-[1.02]",
  },
  {
    id: "QUARTER",
    name: "Pro",
    icon: "🟠",
    durationText: "3 Oylik",
    priceText: "69,900 so'm",
    rawPrice: 69900,
    badge: "🔥 ENG FOYDALI",
    limits: {
      scan: 1000,
      ppt: 400,
      pdf: 1000,
      referat: 400,
    },
    features: [
      "3 oylik 1000 ta Scan",
      "3 oylik 400 ta PPT generator",
      "3 oylik 1000 ta PDF vositalari",
      "3 oylik 400 ta AI Referat (max 15 bet)",
      "Prioritetli server kirishi",
      "Premium qo'llab-quvvatlash",
    ],
    colorClass: "border-orange-500 text-orange-400",
    bgClass: "bg-[#2b1810]/40",
    glowClass: "shadow-[0_0_35px_rgba(249,115,22,0.35)] border-orange-500/90 ring-1 ring-orange-500/50",
    scaleClass: "scale-[1.03] hover:scale-[1.04]",
  },
  {
    id: "YEAR",
    name: "Elite",
    icon: "👑",
    durationText: "1 Yillik",
    priceText: "199,900 so'm",
    rawPrice: 199900,
    limits: {
      scan: "Cheksiz",
      ppt: "Cheksiz",
      pdf: "Cheksiz",
      referat: "Cheksiz",
    },
    features: [
      "Cheksiz Bilet Scan",
      "Cheksiz PPT generator",
      "Cheksiz barcha PDF vositalari",
      "Cheksiz AI Referat yozish",
      "Premium maxsus nishon",
      "Yangi premium funksiyalarga birinchi kirish",
    ],
    colorClass: "border-amber-500/40 text-amber-400",
    bgClass: "bg-[#252010]/30",
    glowClass: "border-amber-500/60",
    scaleClass: "hover:scale-[1.01]",
  },
];

export default function PremiumPage() {
  const [selectedPlan, setSelectedPlan] = useState<PlanPeriod>("MONTH");
  const [showUpgradeToast, setShowUpgradeToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [createdPaymentId, setCreatedPaymentId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePurchase = async () => {
    const telegramIdStr = localStorage.getItem("telegram_user_id");
    if (!telegramIdStr) {
      alert("Foydalanuvchi identifikatori topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }
    const telegramId = parseInt(telegramIdStr, 10);

    const activePlan = PRICING_PLANS.find((plan) => plan.id === selectedPlan);
    if (!activePlan) return;

    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telegram_id: telegramId,
          amount: activePlan.rawPrice,
          plan: activePlan.id,
        }),
      });

      if (!res.ok) {
        throw new Error("To'lov so'rovi xatosi");
      }
      
      const data = await res.json();
      if (data.success && data.payment?.id) {
        setCreatedPaymentId(data.payment.id);
        setShowUploadModal(true);
      }
    } catch (error) {
      console.error(error);
      alert("Xatolik yuz berdi. Qayta urinib ko'ring.");
    }
  };

  const handleUploadProof = async () => {
    if (!createdPaymentId || !selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("payment_id", createdPaymentId);
      formData.append("image", selectedFile);

      const res = await fetch("/api/payments/upload-proof", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Fayl yuklashda xatolik");
      }

      setShowUploadModal(false);
      setToastMessage("✅ Chek yuborildi\n⏳ Admin tasdiqlashini kuting");
      setShowUpgradeToast(true);
      setTimeout(() => setShowUpgradeToast(false), 5000);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally {
      setUploading(false);
    }
  };

  const activePlanDetails = PRICING_PLANS.find((plan) => plan.id === selectedPlan);

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.3s ease forwards; }
      `}</style>

      <main className="min-h-screen bg-[#070b12] text-white">
        <div className="max-w-md mx-auto px-4 py-5 pb-24">
          {/* Navigation header */}
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-slate-400 flex items-center gap-1 transition-all active:scale-95">
              <span>←</span> Orqaga
            </Link>
            <Link href="/payments" className="text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-1">
              📜 To'lovlar tarixi
            </Link>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-bold mb-3 tracking-wider">
              👑 PREMIUM A'ZOLIK
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Talaba AI Premium</h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xs mx-auto">
              Kunlik cheklovlardan xalos bo'ling va ta'limda AI kuchidan to'liq foydalaning.
            </p>
          </div>

          {/* Pricing Cards List */}
          <div className="space-y-4">
            {PRICING_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const isHighlited = plan.id === "MONTH" || plan.id === "QUARTER";

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`
                    relative rounded-3xl p-5 cursor-pointer border transition-all duration-300
                    ${plan.bgClass}
                    ${plan.glowClass || "border-slate-800 bg-[#121824]/40"}
                    ${plan.scaleClass}
                    ${isSelected ? "ring-2 ring-cyan-400 border-transparent bg-[#142032]" : "border-slate-800"}
                  `}
                >
                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-cyan-400 text-slate-900 rounded-full w-6 h-6 flex items-center justify-center text-xs font-extrabold shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                      ✓
                    </div>
                  )}

                  {/* Badge top */}
                  {plan.badge && (
                    <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 border border-violet-500 text-white shadow-md">
                      {plan.badge}
                    </span>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{plan.icon}</span>
                        <h3 className="font-extrabold text-lg text-slate-100">{plan.name}</h3>
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">{plan.durationText} muddat</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xl text-cyan-400">{plan.priceText}</span>
                    </div>
                  </div>

                  {/* Limits summary inline */}
                  <div className="grid grid-cols-4 gap-1 border-t border-slate-800/60 pt-3 mt-1 text-center">
                    <div>
                      <span className="text-[9px] text-slate-500 block font-semibold">📸 Scan</span>
                      <span className="text-xs font-bold text-slate-300">{plan.limits.scan}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-semibold">📊 PPT</span>
                      <span className="text-xs font-bold text-slate-300">{plan.limits.ppt}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-semibold">📄 PDF</span>
                      <span className="text-xs font-bold text-slate-300">{plan.limits.pdf}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 block font-semibold">⚡ Ref</span>
                      <span className="text-xs font-bold text-slate-300">{plan.limits.referat}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Premium Comparison Section */}
          <div className="mt-10 bg-[#101622]/60 rounded-3xl border border-slate-800 p-5 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <h3 className="text-base font-extrabold text-center mb-4 text-cyan-400 flex items-center justify-center gap-1.5">
              <span>⚖️</span> FREE vs PREMIUM solishtirish
            </h3>
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 font-bold border-b border-slate-800 pb-2 text-slate-500">
                <div>Imkoniyat</div>
                <div className="text-center">FREE</div>
                <div className="text-right text-purple-400">PREMIUM</div>
              </div>

              <div className="grid grid-cols-3 border-b border-slate-800/40 pb-2 text-slate-300">
                <div>📸 Bilet Scan</div>
                <div className="text-center text-slate-500">2 / kuniga</div>
                <div className="text-right font-extrabold text-purple-300">Ko'proq / Cheksiz</div>
              </div>

              <div className="grid grid-cols-3 border-b border-slate-800/40 pb-2 text-slate-300">
                <div>📊 AI Slayd</div>
                <div className="text-center text-slate-500">2 / kuniga</div>
                <div className="text-right font-extrabold text-purple-300">Ko'proq / Cheksiz</div>
              </div>

              <div className="grid grid-cols-3 border-b border-slate-800/40 pb-2 text-slate-300">
                <div>📄 PDF Tools</div>
                <div className="text-center text-slate-500">2 / kuniga</div>
                <div className="text-right font-extrabold text-purple-300">Ko'proq / Cheksiz</div>
              </div>

              <div className="grid grid-cols-3 border-b border-slate-800/40 pb-2 text-slate-300">
                <div>⚡ AI Referat</div>
                <div className="text-center text-slate-500">2 / kuniga (max 4 bet)</div>
                <div className="text-right font-extrabold text-purple-300">Ko'proq (max 15 bet) / Cheksiz</div>
              </div>

              <div className="grid grid-cols-3 border-b border-slate-800/40 pb-2 text-slate-300">
                <div>⚡ Tezlik</div>
                <div className="text-center text-slate-500">Oddiy</div>
                <div className="text-right font-extrabold text-purple-300">Prioritetli tezkor</div>
              </div>

              <div className="grid grid-cols-3 text-slate-300">
                <div>⭐ Premium nishon</div>
                <div className="text-center text-slate-500">Yo'q</div>
                <div className="text-right font-extrabold text-purple-300">Bor ✅</div>
              </div>
            </div>
          </div>

          {/* CTA Footer Section */}
          <div className="mt-8 border-t border-slate-800/80 pt-6 text-center space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-100 flex items-center justify-center gap-1.5">
                <span>🚀</span> Upgrade Talaba AI
              </h2>
              {activePlanDetails && (
                <p className="text-slate-400 text-xs mt-1">
                  Tanlangan plan: <strong className="text-cyan-400">{activePlanDetails.name}</strong> ({activePlanDetails.durationText} — {activePlanDetails.priceText})
                </p>
              )}
            </div>

            <button
              onClick={handlePurchase}
              className="w-full py-4 rounded-[22px] font-extrabold text-slate-900 transition-all duration-200 active:scale-[0.98] bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 shadow-[0_4px_25px_rgba(6,182,212,0.35)]"
              style={{ fontSize: "16px" }}
            >
              👑 Sotib olish
            </button>
          </div>
        </div>
      </main>

      {/* Upload Proof Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#101622] border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              📸 To'lov chekini yuklang
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              Premium tarifni faollashtirish uchun to'lov qilinganligini tasdiqlovchi chek rasmini yuklang.
            </p>
            
            <div className="mb-5">
              <label className="block w-full text-sm text-slate-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-cyan-400 file:text-slate-900
                hover:file:bg-cyan-300 file:cursor-pointer cursor-pointer border border-dashed border-slate-700 rounded-2xl p-4 text-center">
                Fayl tanlash...
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
              {selectedFile && (
                <p className="text-xs text-emerald-400 mt-2 text-center">
                  ✅ {selectedFile.name} tanlandi
                </p>
              )}
            </div>

            <button
              onClick={handleUploadProof}
              disabled={!selectedFile || uploading}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                !selectedFile || uploading 
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                  : "bg-cyan-400 text-slate-900 hover:bg-cyan-300"
              }`}
            >
              {uploading ? "⏳ Yuklanmoqda..." : "Yuborish"}
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Toast */}
      {showUpgradeToast && (
        <div
          className="animate-fade-in-up"
          style={{
            position: "fixed",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: "#1a2535",
            border: "1px solid rgba(6,182,212,0.3)",
            borderRadius: "18px",
            padding: "12px 22px",
            fontSize: "14px",
            color: "#fff",
            whiteSpace: "pre-line",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            textAlign: "center",
          }}
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
