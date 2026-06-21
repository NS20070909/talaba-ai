"use client";
import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";

export default function ScanPage() {
  const [image, setImage] =
    useState<string | null>(
      null
    );

  const [
    base64Image,
    setBase64Image,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [result, setResult] =
    useState("");

  const [limitReached, setLimitReached] = useState(false);
  const [showUpgradeToast, setShowUpgradeToast] = useState(false);

  // IMAGE HANDLE
  const handleImage = (
    file: File
  ) => {
    const imageUrl =
      URL.createObjectURL(
        file
      );

    setImage(imageUrl);

    const reader =
      new FileReader();

    reader.readAsDataURL(
      file
    );

    reader.onloadend = () => {
      const base64 =
        reader.result
          ?.toString()
          .split(",")[1] || "";

      setBase64Image(
        base64
      );
    };
  };

  // DROPZONE
  const {
    getRootProps,
    getInputProps,
  } = useDropzone({
    accept: {
      "image/*": [],
    },

    multiple: false,

    onDrop: (
      acceptedFiles
    ) => {
      const file =
        acceptedFiles[0];

      if (!file) return;

      handleImage(file);
    },
  });

  // CTRL + V IMAGE
  useEffect(() => {
    const handlePaste = (
      e: ClipboardEvent
    ) => {
      const items =
        e.clipboardData
          ?.items;

      if (!items) return;

      for (const item of items) {
        if (
          item.type.startsWith(
            "image/"
          )
        ) {
          const file =
            item.getAsFile();

          if (file) {
            handleImage(
              file
            );
          }
        }
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

  // AI ANALYZE
  const analyzeImage =
    async () => {
      try {
        setLoading(true);
        setResult("");
        setLimitReached(false);

        if (
          !base64Image
        ) {
          setResult(
            "❌ Rasm tanlanmagan"
          );

          return;
        }

        const telegram_user_id =
          localStorage.getItem("telegram_user_id");

        const res =
          await fetch(
            "/api/analyze",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    image:
                      base64Image,
                    telegram_user_id,
                  }
                ),
            }
          );

        const data =
          await res.json();

        if (res.status === 403 && data.error === "LIMIT_REACHED") {
          setLimitReached(true);
          return;
        } else if (data.message) {
          setResult(data.message);
        } else if (data.result) {
          setResult(data.result);
        } else {
          setResult("❌ Javob topilmadi");
        }
      } catch (
        error
      ) {
        console.log(
          error
        );

        setResult(
          "❌ Xatolik yuz berdi."
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  // DOWNLOAD
  const exportWord =
    async () => {
      try {
        const response =
          await fetch(
            "/api/export-word",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    text:
                      result,
                  }
                ),
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Word export error"
          );
        }

        const blob =
          await response.blob();

        const file =
          new File(
            [blob],
            "TalabaAI-Shpargalka.docx",
            {
              type:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            }
          );

        const url =
          URL.createObjectURL(
            file
          );

        const a =
          document.createElement(
            "a"
          );

        a.href = url;

        a.download =
          "TalabaAI-Shpargalka.docx";

        document.body.appendChild(
          a
        );

        a.click();

        document.body.removeChild(
          a
        );

        setTimeout(() => {
          URL.revokeObjectURL(
            url
          );
        }, 2000);
      } catch (
        error
      ) {
        console.log(
          error
        );

        alert(
          "Word yuklashda xatolik"
        );
      }
    };

  // TELEGRAMGA YUBORISH
  const sendToTelegram =
    async () => {
      try {
        const userId =
          localStorage.getItem(
            "telegram_user_id"
          );

        const response =
          await fetch(
            "/api/export-word",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    text:
                      result,

                    telegram_user_id:
                      userId,

                    send_to_telegram:
                      true,
                  }
                ),
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Telegram error"
          );
        }

        alert(
          "✅ Telegramga yuborildi"
        );
      } catch (
        error
      ) {
        console.log(
          error
        );

        alert(
          "❌ Telegramga yuborilmadi"
        );
      }
    };

  const handleUpgradeClick = () => {
    window.location.href = "/premium";
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
    <main className="min-h-screen bg-[#071424] text-white">
      <div className="max-w-md mx-auto px-4 py-5">
        <button
          onClick={() =>
            window.history.back()
          }
          className="text-slate-400 mb-5"
        >
          ← Orqaga
        </button>

        <div className="mb-5">
          <h1 className="text-4xl font-bold">
            📸 Bilet Scan
          </h1>

          <p className="text-slate-400 mt-2 text-lg">
            Bilet yoki savol
            rasmini yuklang.
            AI sizga mazmunli
            shpargalka
            tayyorlaydi.
          </p>
        </div>

        <div
          {...getRootProps()}
          className="
            border-2
            border-dashed
            border-cyan-500/30
            rounded-[34px]
            bg-[#1b2a3a]
            p-5
            text-center
            cursor-pointer
          "
        >
          <input
            {...getInputProps()}
          />

          {!image ? (
            <>
              <div className="text-6xl mb-3">
                📷
              </div>

              <h2 className="text-2xl font-bold">
                Rasm yuklash
              </h2>

              <p className="text-slate-400 mt-3">
                Rasm tashlang
                yoki Ctrl + V
                qiling
              </p>
            </>
          ) : (
            <img
              src={image}
              alt="uploaded"
              className="
                rounded-[28px]
                w-full
                max-h-[320px]
                object-contain
                bg-black/20
              "
            />
          )}
        </div>

        {image && (
          <button
            onClick={
              analyzeImage
            }
            disabled={
              loading
            }
            className="
              mt-4
              w-full
              rounded-[28px]
              bg-cyan-500
              text-black
              font-bold
              py-4
              text-xl
            "
          >
            {loading
              ? "⏳ Tahlil..."
              : "🚀 AI tahlil qilish"}
          </button>
        )}

        {/* Limit Reached Banner */}
        {limitReached && (
          <div className="mt-5 rounded-[24px] border border-amber-500/30 p-5 space-y-3 relative overflow-hidden" style={{background: 'linear-gradient(135deg, rgba(120,53,15,0.45) 0%, rgba(124,45,18,0.30) 100%)'}}>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 pointer-events-none animate-shimmer" style={{background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.07), transparent)', width:'60%'}} />

            <div className="flex items-center gap-2 font-bold text-lg" style={{color:'#fbbf24'}}>
              ⚠️ Kunlik Scan limiti tugadi
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                📸 Scan: 2/2 ishlatildi
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

        {result && !limitReached && (
          <div
            className="
              mt-5
              rounded-[30px]
              bg-[#1d2a3a]
              border
              border-cyan-500/10
              p-5
            "
          >
            <p className="text-center text-sm text-slate-400 mb-3">
              Faylni yuklash
            </p>

            <div className="flex gap-2 mb-5">
              <button
                onClick={
                  exportWord
                }
                className="
                  flex-1
                  rounded-[18px]
                  bg-blue-600
                  py-2.5
                  text-sm
                  font-bold
                "
              >
                ⬇️ Download
              </button>

              <button
                onClick={
                  sendToTelegram
                }
                className="
                  flex-1
                  rounded-[18px]
                  bg-cyan-500
                  text-black
                  py-2.5
                  text-sm
                  font-bold
                "
              >
                📨 Telegram
              </button>
            </div>

            <h2 className="font-bold text-2xl mb-4">
              📚 Shpargalka
            </h2>

            <div
              className="
                text-slate-300
                whitespace-pre-wrap
                leading-8
              "
            >
              {result}
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