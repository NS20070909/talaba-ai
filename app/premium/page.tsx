"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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
    format: string | number;
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
    limits: { scan: 5, ppt: 3, pdf: 5, referat: 10, format: 10 },
    features: [
      "Kunlik 5 ta Scan",
      "Kunlik 3 ta PPT generator",
      "Kunlik 5 ta PDF",
      "Kunlik 10 ta AI Referat yozish",
      "Kunlik 10 ta OTM Referat formatlash",
      "Maksimal 5–8 bet referat",
    ],
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
    limits: { scan: 50, ppt: 20, pdf: 50, referat: 50, format: 50 },
    features: [
      "Kunlik 50 ta Scan",
      "Kunlik 20 ta PPT generator",
      "Kunlik 50 ta PDF",
      "Kunlik 50 ta AI Referat yozish",
      "Kunlik 50 ta OTM Referat formatlash",
      "Maksimal 5–15 bet referat",
    ],
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
    limits: { scan: 300, ppt: 120, pdf: 300, referat: 120, format: 120 },
    features: [
      "Kunlik 300 ta Scan",
      "Kunlik 120 ta PPT generator",
      "Kunlik 300 ta PDF",
      "Kunlik 120 ta AI Referat yozish",
      "Kunlik 120 ta OTM Referat formatlash",
      "Maksimal 5–20 bet referat",
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
    limits: { scan: 1000, ppt: 400, pdf: 1000, referat: 400, format: 400 },
    features: [
      "Kunlik 1000 ta Scan",
      "Kunlik 400 ta PPT generator",
      "Kunlik 1000 ta PDF",
      "Kunlik 400 ta AI Referat yozish",
      "Kunlik 400 ta OTM Referat formatlash",
      "Maksimal 5–30 bet referat",
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
      format: "Cheksiz",
    },
    features: [
      "Cheksiz Bilet Scan",
      "Cheksiz PPT generator",
      "Cheksiz PDF",
      "Cheksiz AI Referat yozish",
      "Cheksiz OTM Referat formatlash",
      "Cheksiz bet (referat hajmi)",
      "Premium maxsus nishon",
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
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<"CARD_INFO" | "UPLOAD_PROOF">("CARD_INFO");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<{ card_holder: string; card_number: string }>({
    card_holder: "",
    card_number: "",
  });

  const fetchPaymentSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/payments/settings", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.settings) {
        setPaymentSettings({
          card_holder: data.settings.card_holder || "",
          card_number: data.settings.card_number || "",
        });
      }
    } catch (err) {
      console.error("Failed to fetch payment settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchPaymentSettings();
  }, [fetchPaymentSettings]);

  const activePlanDetails = PRICING_PLANS.find((plan) => plan.id === selectedPlan);

  const openPurchaseModal = () => {
    const telegramIdStr = localStorage.getItem("telegram_user_id");
    if (!telegramIdStr) {
      alert("Foydalanuvchi identifikatori topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }
    fetchPaymentSettings();
    setModalStep("CARD_INFO");
    setSelectedFile(null);
    setShowModal(true);
  };

  const copyCardNumber = () => {
    if (!paymentSettings.card_number) return;
    navigator.clipboard.writeText(paymentSettings.card_number.replace(/\s+/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleUploadProof = async () => {
    const telegramIdStr = localStorage.getItem("telegram_user_id");
    if (!telegramIdStr || !selectedFile || !activePlanDetails) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("telegram_id", telegramIdStr);
      formData.append("plan", activePlanDetails.id);
      formData.append("amount", String(activePlanDetails.rawPrice));
      formData.append("image", selectedFile);

      const res = await fetch("/api/payments/upload-proof", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Chek yuklashda xatolik yuz berdi");
      }

      setShowModal(false);
      setToastMessage("✅ Chek yuborildi!\n⏳ Admin tasdiqlashini kuting");
      setShowUpgradeToast(true);
      setTimeout(() => setShowUpgradeToast(false), 5000);
    } catch (error: any) {
      alert(error?.message || "Xatolik yuz berdi. Qayta urinib ko'ring.");
    } finally {
      setUploading(false);
    }
  };

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
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-slate-400 flex items-center gap-1 transition-all active:scale-95">
              <span>←</span> Orqaga
            </Link>
            <Link href="/payments" className="text-cyan-400 hover:text-cyan-300 text-xs font-bold transition-all active:scale-95 flex items-center gap-1">
              📜 To'lovlar tarixi
            </Link>
          </div>

          <div className="text-center mb-6">
            <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-xs font-bold mb-3 tracking-wider">
              👑 PREMIUM A'ZOLIK
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Talaba AI Premium</h1>
            <p className="text-slate-400 mt-2 text-sm max-w-xs mx-auto">
              Kunlik cheklovlardan xalos bo'ling va ta'limda AI kuchidan to'liq foydalaning.
            </p>
          </div>

          <div className="space-y-4">
            {PRICING_PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
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
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 bg-cyan-400 text-slate-900 rounded-full w-6 h-6 flex items-center justify-center text-xs font-extrabold shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                      ✓
                    </div>
                  )}

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

                  <div className="grid grid-cols-5 gap-1 border-t border-slate-800/60 pt-3 mt-1 text-center">
                    {[
                      { label: "📸", key: "scan"    as const, title: "Scan" },
                      { label: "📊", key: "ppt"     as const, title: "PPT" },
                      { label: "📄", key: "pdf"     as const, title: "PDF" },
                      { label: "✍️", key: "referat" as const, title: "Referat" },
                      { label: "📋", key: "format"  as const, title: "Format" },
                    ].map(({ label, key, title }) => (
                      <div key={key}>
                        <span className="text-[8px] text-slate-500 block font-semibold" title={title}>{label}</span>
                        <span className="text-[10px] font-bold text-slate-300">{plan.limits[key]}</span>
                      </div>
                    ))}
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs text-slate-300 border-t border-slate-800/40 pt-3">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="text-cyan-400">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t border-slate-800/80 pt-6 text-center space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-100 flex items-center justify-center gap-1.5">
                <span>🚀</span> Upgrade Talaba AI
              </h2>
              {activePlanDetails && (
                <p className="text-slate-400 text-xs mt-1">
                  Tanlangan plan:{" "}
                  <strong className="text-cyan-400">{activePlanDetails.name}</strong> (
                  {activePlanDetails.durationText} — {activePlanDetails.priceText})
                </p>
              )}
            </div>

            <button
              onClick={openPurchaseModal}
              className="w-full py-4 rounded-[22px] font-extrabold text-slate-900 transition-all duration-200 active:scale-[0.98] bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 shadow-[0_4px_25px_rgba(6,182,212,0.35)]"
              style={{ fontSize: "16px" }}
            >
              👑 Sotib olish
            </button>
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-[#101622] border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              ✕
            </button>

            {modalStep === "CARD_INFO" && (
              <div>
                <h3 className="text-xl font-extrabold mb-1 text-slate-100 flex items-center gap-2">
                  💳 To'lov rekvizitlari
                </h3>
                <p className="text-slate-400 text-xs mb-4">
                  Pastdagi karta raqamiga to'lovni amalga oshiring va chekni yuklang.
                </p>

                {activePlanDetails && (
                  <div className="bg-[#182232] border border-slate-700/60 rounded-2xl p-4 mb-4 text-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-400 text-xs">Tarif:</span>
                      <span className="font-bold text-cyan-400">{activePlanDetails.name} ({activePlanDetails.durationText})</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-slate-400 text-xs">To'lov summasi:</span>
                      <span className="font-extrabold text-lg text-emerald-400">{activePlanDetails.priceText}</span>
                    </div>

                    <div className="border-t border-slate-700/60 pt-3">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Karta raqami (Humo / Uzcard)</span>
                      <div className="flex items-center justify-between bg-[#101622] px-3 py-2 rounded-xl border border-slate-700">
                        <span className="font-mono font-black text-base text-amber-400 tracking-wider">{paymentSettings.card_number}</span>
                        <button
                          onClick={copyCardNumber}
                          className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded-lg text-xs font-bold transition-all active:scale-95"
                        >
                          {copied ? "✓ Nusxalandi" : "📋 Nusxalash"}
                        </button>
                      </div>
                      <span className="text-slate-500 text-[10px] block mt-1">Qabul qiluvchi: {paymentSettings.card_holder}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setModalStep("UPLOAD_PROOF")}
                  className="w-full py-3.5 rounded-2xl font-extrabold text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-all active:scale-95 text-sm shadow-lg shadow-cyan-400/20"
                >
                  💳 To'lov qildim (Chek yuklash)
                </button>
              </div>
            )}

            {modalStep === "UPLOAD_PROOF" && (
              <div>
                <button
                  onClick={() => setModalStep("CARD_INFO")}
                  className="text-xs text-cyan-400 font-bold mb-3 inline-block hover:underline"
                >
                  ← Rekvizitlarga qaytish
                </button>
                <h3 className="text-xl font-extrabold mb-1 text-slate-100 flex items-center gap-2">
                  📸 To'lov chekini yuklang
                </h3>
                <p className="text-slate-400 text-xs mb-4">
                  To'lov muvaffaqiyatli amalga oshirilganini tasdiqlovchi chek (skrinshot) rasmini tanlang.
                </p>

                <div className="mb-5">
                  <label className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-400 file:text-slate-900 hover:file:bg-cyan-300 file:cursor-pointer cursor-pointer border border-dashed border-slate-700 rounded-2xl p-5 text-center bg-[#182232]/40 hover:bg-[#182232]/80 transition-all">
                    📁 Chek rasmini tanlang...
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) setSelectedFile(e.target.files[0]);
                      }}
                    />
                  </label>
                  {selectedFile && (
                    <p className="text-xs text-emerald-400 mt-2.5 text-center font-bold">
                      ✅ {selectedFile.name} tanlandi
                    </p>
                  )}
                </div>

                <button
                  onClick={handleUploadProof}
                  disabled={!selectedFile || uploading}
                  className={`w-full py-3.5 rounded-2xl font-extrabold transition-all text-sm shadow-lg ${
                    !selectedFile || uploading
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 hover:opacity-90 active:scale-95 shadow-emerald-400/20"
                  }`}
                >
                  {uploading ? "⏳ Chek yuklanmoqda..." : "🚀 Chekni yuborish"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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

