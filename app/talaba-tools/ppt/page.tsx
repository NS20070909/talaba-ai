"use client";

import Link from "next/link";
import { useState } from "react";


export default function PPTPage() {
  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState(10);
  const [language, setLanguage] =
    useState("uz");
  const [style, setStyle] =
    useState("professional");

  const [loading, setLoading] =
    useState(false);
    const [generatedOutline,
setGeneratedOutline] =
useState<any[]>([]);

  const [outline, setOutline] =
  useState<any[]>([]);
  const [
  showTelegramButton,
  setShowTelegramButton,
] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [showUpgradeToast, setShowUpgradeToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate =
async () => {
  if (!topic.trim())
    return;

  setLoading(true);
  setOutline([]);
  setShowTelegramButton(false);
  setLimitReached(false);
  setErrorMsg("");

  try {
    const telegram_user_id = localStorage.getItem("telegram_user_id");
    const response =
      await fetch(
        "/api/generate-ppt",
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              topic,
              slides,
              language,
              style,
              telegram_user_id,
            }),
        }
      );

    const data =
      await response.json();

    if (
      data.success
    ) {
      setDownloadUrl(
        data.downloadUrl
      );

      setShowTelegramButton(
        true
      );

      setOutline(
        data.outline ||
          []
      );

      setGeneratedOutline(
        data.outline ||
          []
      );
    } else if (data.error === "LIMIT_REACHED") {
      setLimitReached(true);
    } else if (data.code === "BANNED" || data.message) {
      setErrorMsg(data.message);
    }
  } catch (
    error
  ) {
    console.error(
      "PPT Error:",
      error
    );
  } finally {
    setLoading(
      false
    );
  }
};

  const handleUpgradeClick = () => {
    window.location.href = "/premium";
  };

const handleTelegramSend =
  async () => {
    try {
      setLoading(true);

      const tg =
        (window as any)
          ?.Telegram
          ?.WebApp;

      tg?.ready();

      const userId =
        tg?.initDataUnsafe
          ?.user?.id;

      if (!userId) {
        alert(
          "Telegram ichidan oching"
        );
        return;
      }

      if (!downloadUrl) {
        alert(
          "Avval PPT yarating"
        );
        return;
      }

      const response =
        await fetch(
          "/api/send-ppt-telegram",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                fileUrl:
                  downloadUrl,
                telegram_user_id:
                  userId,
              }),
          }
        );

      const data =
        await response.json();

      if (
        data.success
      ) {
        alert(
          "✅ PPT Telegram chatga yuborildi"
        );
      } else {
        alert(
          "❌ Telegramga yuborishda xatolik"
        );
      }
    } catch (
      error
    ) {
      console.error(
        error
      );

      alert(
        "❌ Telegramga yuborishda xatolik"
      );
    } finally {
      setLoading(
        false
      );
    }
  };
  return (
    <>
    <style>{`
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translate(-50%, 12px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }
      .animate-shimmer { animation: shimmer 2.5s infinite; }
      .animate-fade-in-up { animation: fadeInUp 0.3s ease forwards; }
    `}</style>
    <main className="min-h-screen bg-[#071120] text-white">
      <div className="max-w-md mx-auto px-4 py-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <Link
            href="/talaba-tools"
            className="
              h-11 w-11 rounded-[16px]
              bg-[#243140]
              flex items-center justify-center
              text-lg
            "
          >
            ←
          </Link>

          <div>
            <h1 className="text-[28px] font-bold">
              Slayd Tayyorlash
            </h1>

            <p className="text-slate-400 text-sm">
              AI orqali professional PPT yaratish
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-[30px] bg-[#243140] border border-cyan-500/10 p-5 space-y-5">

          {/* Topic */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Mavzu
            </label>

            <input
              type="text"
              placeholder="Masalan: Kiber xavfsizlik"
              value={topic}
              onChange={(e) =>
                setTopic(e.target.value)
              }
              className="
                w-full
                rounded-[18px]
                bg-[#0f1724]
                border border-white/10
                px-4 py-4
                outline-none
                focus:border-cyan-400
                transition-all
              "
            />
          </div>

          {/* Slide Count */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Slayd soni
            </label>

            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={slides}
              onChange={(e) =>
                setSlides(
                  Number(e.target.value)
                )
              }
              className="
                w-full
                rounded-[18px]
                bg-[#0f1724]
                border border-white/10
                px-4 py-4
                outline-none
                focus:border-cyan-400
                appearance-none
                [-moz-appearance:textfield]
                [&::-webkit-outer-spin-button]:appearance-none
                [&::-webkit-inner-spin-button]:appearance-none
              "
            />
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Til
            </label>

            <select
              value={language}
              onChange={(e) =>
                setLanguage(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-[18px]
                bg-[#0f1724]
                border border-white/10
                px-4 py-4
                outline-none
                focus:border-cyan-400
              "
            >
              <option value="uz">
                O'zbek
              </option>

              <option value="ru">
                Русский
              </option>

              <option value="en">
                English
              </option>
            </select>
          </div>

          {/* Style */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Dizayn uslubi
            </label>

            <select
              value={style}
              onChange={(e) =>
                setStyle(
                  e.target.value
                )
              }
              className="
                w-full
                rounded-[18px]
                bg-[#0f1724]
                border border-white/10
                px-4 py-4
                outline-none
                focus:border-cyan-400
              "
            >
              <option value="professional">
                Professional
              </option>

              <option value="modern">
                Modern
              </option>

              <option value="minimal">
                Minimal
              </option>

              <option value="dark">
                Dark Premium
              </option>
            </select>
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={
            !topic.trim() || loading
          }
          className={`
            mt-5 w-full
            rounded-[24px]
            py-4
            font-semibold
            transition-all
            ${
              !topic.trim() ||
              loading
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-cyan-500 hover:bg-cyan-400"
            }
          `}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              AI tayyorlanmoqda...
            </div>
          ) : (
            "✨ AI Slayd Yaratish"
          )}
        </button>

        {/* Limit Reached Banner */}
        {limitReached && (
          <div className="mt-5 rounded-[24px] border border-amber-500/30 p-5 space-y-3 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(120,53,15,0.45) 0%, rgba(124,45,18,0.30) 100%)'}}>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 pointer-events-none animate-shimmer" style={{background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.07), transparent)', width:'60%'}} />

            <div className="flex items-center gap-2 font-bold text-lg" style={{color:'#fbbf24'}}>
              ⚠️ Kunlik PPT limiti tugadi
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                📊 PPT: 2/2 ishlatildi
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                ⏰ Limit ertaga avtomatik yangilanadi
              </div>
              <div className="flex items-center gap-2 font-medium" style={{color:'#fcd34d'}}>
                ⭐ Premium versiyada cheksiz foydalanish mumkin
              </div>
            </div>

            <button
              onClick={handleUpgradeClick}
              className="w-full mt-2 py-3 rounded-[18px] font-bold text-black transition-all active:scale-95"
              style={{background: 'linear-gradient(90deg, #f59e0b, #ea580c)', boxShadow:'0 4px 20px rgba(245,158,11,0.3)'}}
              onMouseEnter={e => (e.currentTarget.style.filter='brightness(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.filter='brightness(1)')}
            >
              ⭐ Upgrade Plan
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="mt-5 rounded-[24px] border border-red-500/30 bg-red-500/10 p-5 text-center text-red-400 font-bold">
            {errorMsg}
          </div>
        )}

        {/* Download + Telegram */}
{showTelegramButton && (
  <div className="mt-4 flex gap-3">

    <a
      href={downloadUrl}
      download
      className="
        flex-1
        rounded-[24px]
        py-4
        bg-white
        text-black
        text-center
        font-semibold
      "
    >
      📥 Download
    </a>

    <button
      onClick={
        handleTelegramSend
      }
      disabled={
        loading
      }
      className="
        flex-1
        rounded-[24px]
        py-4
        bg-cyan-500
        text-black
        font-semibold
      "
    >
      📨 Telegram
    </button>

  </div>
)}


        {/* Outline Result */}
        
        {Array.isArray(outline) &&
  outline.length > 0 && (
          <div className="mt-5 rounded-[30px] bg-[#243140] border border-cyan-500/10 p-5">
            <h3 className="font-semibold text-lg mb-4">
              AI Reja
            </h3>

            <div className="space-y-2">
              {outline.map(
  (
    item,
    index
  ) => (
    <div
      key={index}
      className="
        rounded-2xl
        bg-[#0f1724]
        border border-white/10
        p-4
        mb-3
      "
    >
      <div className="text-cyan-400 text-sm mb-2">
        Slayd {index + 1}
      </div>

      <h2 className="text-lg font-bold">
        {item.title}
      </h2>

      {item.subtitle && (
        <p className="text-slate-400 text-sm mt-1">
          {item.subtitle}
        </p>
      )}

      {item.content && (
        <p className="text-slate-300 mt-3">
          {item.content}
        </p>
      )}

      {item.imageQuery && (
        <div className="mt-3 text-cyan-300 text-sm">
          🖼 Rasm:
          {" "}
          {item.imageQuery}
        </div>
      )}

      {item.designIdea && (
        <div className="text-yellow-300 text-sm mt-1">
          🎨 Dizayn:
          {" "}
          {item.designIdea}
        </div>
      )}
    </div>
  )
)}
            </div>
          </div>
        )}

      </div>
    </main>

    {/* Upgrade Toast */}
    {showUpgradeToast && (
      <div
        className="animate-fade-in-up"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#1a2535',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: '18px',
          padding: '12px 22px',
          fontSize: '14px',
          color: '#fff',
          whiteSpace: 'nowrap',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        🚀 Premium tizimi tez orada ishga tushadi
      </div>
    )}
    </>
  );
}