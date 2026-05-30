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
const [
downloadUrl,
setDownloadUrl,
] = useState("");

  const handleGenerate =
async () => {
  if (!topic.trim())
    return;

  setLoading(true);
  setOutline([]);
  setShowTelegramButton(
    false
  );

  try {
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

    const response =
      await fetch(
        "/api/generate-ppt",
        {
          method: "POST",
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
              send_to_telegram:
                true,
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
  );
}