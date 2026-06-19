"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";

export default function PdfToWordPage() {
  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  // YANGI TUGMA
  const [
    showTelegramButton,
    setShowTelegramButton,
  ] = useState(false);

  const [limitReached, setLimitReached] = useState(false);
  const [showUpgradeToast, setShowUpgradeToast] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selected =
        acceptedFiles[0];

      if (!selected) return;

      if (
        !selected.name
          .toLowerCase()
          .endsWith(".pdf")
      ) {
        alert(
          "Faqat .pdf fayl yuklang"
        );
        return;
      }

      setFile(selected);

      // yangi fayl tanlansa reset
      setShowTelegramButton(
        false
      );
    },
    []
  );

  const {
    getRootProps,
    getInputProps,
    open,
  } = useDropzone({
    onDrop,
    noClick: true,
    multiple: false,
    accept: {
      "application/pdf": [
        ".pdf",
      ],
    },
  });

  // Ctrl + V support
  useEffect(() => {
    const handlePaste = (
      event: ClipboardEvent
    ) => {
      const items =
        event.clipboardData
          ?.files;

      if (!items?.length)
        return;

      const pastedFile =
        items[0];

      if (
        pastedFile &&
        pastedFile.name
          .toLowerCase()
          .endsWith(".pdf")
      ) {
        setFile(pastedFile);

        setShowTelegramButton(
          false
        );
      }
    };

    window.addEventListener(
      "paste",
      handlePaste
    );

    return () => {
      window.removeEventListener(
        "paste",
        handlePaste
      );
    };
  }, []);

  // ODDIY CONVERT
  const handleConvert =
    async () => {
      if (!file) return;

      try {
        setLoading(true);
        setLimitReached(false);

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const userId =
          localStorage.getItem("telegram_user_id");

        if (userId) {
          formData.append(
            "telegram_user_id",
            userId
          );
        }

        const response =
          await fetch(
            "/api/convert-pdf-to-word",
            {
              method: "POST",
              body: formData,
            }
          );

        if (!response.ok) {
          const data =
            await response.json();

          if (
            response.status === 403 &&
            data.error === "LIMIT_REACHED"
          ) {
            setLimitReached(true);
            return;
          }

          throw new Error(
            data.error ||
              "Convert qilishda xatolik"
          );
        }

        // Browser download
        const blob =
          await response.blob();

        const url =
          window.URL.createObjectURL(
            blob
          );

        const a =
          document.createElement(
            "a"
          );

        a.href = url;

        a.download =
          file.name.replace(
            ".pdf",
            ".docx"
          );

        document.body.appendChild(
          a
        );

        a.click();
        a.remove();

        window.URL.revokeObjectURL(
          url
        );

        // YANGI TUGMA CHIQADI
        setShowTelegramButton(
          true
        );

        alert(
          "✅ PDF Word formatga aylantirildi"
        );
      } catch (error) {
        console.error(error);

        alert(
          error instanceof Error
            ? error.message
            : "Xatolik yuz berdi"
        );
      } finally {
        setLoading(false);
      }
    };

  // TELEGRAMGA YUBORISH
  const handleTelegramSend =
    async () => {
      if (!file) return;

      try {
        setLoading(true);
        setLimitReached(false);

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const userId =
          localStorage.getItem(
            "telegram_user_id"
          );

        if (userId) {
          formData.append(
            "telegram_user_id",
            userId
          );
        }

        formData.append(
          "send_to_telegram",
          "true"
        );

        const response =
          await fetch(
            "/api/convert-pdf-to-word",
            {
              method: "POST",
              body: formData,
            }
          );

        if (!response.ok) {
          const data =
            await response.json();

          if (
            response.status === 403 &&
            data.error === "LIMIT_REACHED"
          ) {
            setLimitReached(true);
            return;
          }

          throw new Error(
            "Telegramga yuborishda xatolik"
          );
        }

        alert(
          "✅ Word fayl Telegram chatga yuborildi"
        );
      } catch (error) {
        console.error(error);

        alert(
          error instanceof Error
            ? error.message
            : "❌ Telegramga yuborilmadi"
        );
      } finally {
        setLoading(false);
      }
    };

  const handleUpgradeClick = () => {
    setShowUpgradeToast(true);
    setTimeout(() => setShowUpgradeToast(false), 3000);
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
      <div className="max-w-md mx-auto px-4 py-4">
        <Link
          href="/file-tools"
          className="text-slate-400 mb-4 inline-block"
        >
          ← Orqaga
        </Link>

        <div className="mb-6">
          <h1 className="text-[24px] font-bold">
            📑 PDF → Word
          </h1>

          <p className="text-slate-400 mt-1">
            Gemini AI yordamida
            PDF faylni Word
            formatga aylantiring
          </p>
        </div>

        <div
          {...getRootProps()}
          className="
            rounded-[28px]
            border-2 border-dashed
            border-cyan-500/20
            bg-[#1A2636]
            p-8
            text-center
            transition-all
            hover:border-cyan-400/40
          "
        >
          <input
            {...getInputProps()}
          />

          <div className="text-5xl mb-4">
            📑
          </div>

          <h2 className="text-xl font-semibold">
            {file
              ? "✅ Fayl tanlandi"
              : "PDF fayl yuklang"}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            {file
              ? file.name
              : "Drag & Drop, Ctrl + V yoki fayl tanlang"}
          </p>

          <button
            onClick={open}
            disabled={loading}
            className="
              mt-5
              rounded-[18px]
              bg-cyan-500
              text-black
              font-semibold
              px-5 py-3
              disabled:opacity-50
            "
          >
            Fayl tanlash
          </button>

          {file && (
            <>
              <button
                onClick={
                  handleConvert
                }
                disabled={loading}
                className="
                  mt-3
                  w-full
                  rounded-[18px]
                  bg-emerald-500
                  text-black
                  font-semibold
                  px-5 py-3
                  disabled:opacity-50
                "
              >
                {loading
                  ? "🤖 Gemini ishlayapti..."
                  : "Word ga aylantirish"}
              </button>

              {showTelegramButton && !limitReached && (
                <button
                  onClick={
                    handleTelegramSend
                  }
                  disabled={
                    loading
                  }
                  className="
                    mt-3
                    w-full
                    rounded-[18px]
                    bg-cyan-500
                    text-black
                    font-semibold
                    px-5 py-3
                    disabled:opacity-50
                  "
                >
                  📨 Telegram chatga
                  yuborish
                </button>
              )}
            </>
          )}
        </div>

        {/* Limit Reached Banner */}
        {limitReached && (
          <div className="mt-5 rounded-[24px] border border-amber-500/30 p-5 space-y-3 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(120,53,15,0.45) 0%, rgba(124,45,18,0.30) 100%)'}}>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 pointer-events-none animate-shimmer" style={{background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.07), transparent)', width:'60%'}} />

            <div className="flex items-center gap-2 font-bold text-lg" style={{color:'#fbbf24'}}>
              ⚠️ Kunlik PDF limiti tugadi
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                📑 PDF: 2/2 ishlatildi
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