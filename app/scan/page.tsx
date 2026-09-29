"use client";
import { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { getTelegramContext } from "@/lib/client/telegram";

async function compressImage(
  file: File,
  maxDimension = 1920,
  quality = 0.82
): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = dataUrl.split(",")[1] || "";
        resolve({ dataUrl, base64 });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ScanPage() {
  const [image, setImage] = useState<string | null>(null);
  const [base64Image, setBase64Image] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [userBanned, setUserBanned] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const prevImageUrlRef = useRef<string | null>(null);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (prevImageUrlRef.current) {
        URL.revokeObjectURL(prevImageUrlRef.current);
      }
    };
  }, []);

  // IMAGE HANDLE with client-side compression
  const handleImage = async (file: File) => {
    if (!file) return;

    try {
      setCompressing(true);
      setErrorMessage("");
      setLimitReached(false);
      setUserBanned(false);

      if (prevImageUrlRef.current) {
        URL.revokeObjectURL(prevImageUrlRef.current);
      }

      // Fast client-side compression to avoid 413 and 504 timeouts
      const { dataUrl, base64 } = await compressImage(file, 1920, 0.82);
      prevImageUrlRef.current = dataUrl;
      setImage(dataUrl);
      setBase64Image(base64);
    } catch (err) {
      console.error("Image processing error:", err);
      // Fallback to standard reader
      const reader = new FileReader();
      reader.onloadend = () => {
        const full = reader.result?.toString() || "";
        setImage(full);
        setBase64Image(full.split(",")[1] || "");
      };
      reader.readAsDataURL(file);
    } finally {
      setCompressing(false);
    }
  };

  // DROPZONE
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "image/*": [],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) handleImage(file);
    },
  });

  // CTRL + V IMAGE
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleImage(file);
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // AI ANALYZE
  const analyzeImage = async () => {
    try {
      setLoading(true);
      setResult("");
      setErrorMessage("");
      setLimitReached(false);
      setUserBanned(false);

      if (!base64Image) {
        setErrorMessage("❌ Rasm tanlanmagan");
        return;
      }

      const tgCtx = getTelegramContext();
      const telegram_user_id = tgCtx.user?.id || (typeof window !== "undefined" ? localStorage.getItem("telegram_user_id") : null);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (tgCtx.initData) {
        headers["x-telegram-init-data"] = tgCtx.initData;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers,
        body: JSON.stringify({
          image: base64Image,
          telegram_user_id,
          init_data: tgCtx.initData || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        if (data.code === "BANNED" || data.banned) {
          setUserBanned(true);
          setErrorMessage(data.result || data.message || "🚫 Sizning profilingiz bloklangan.");
          return;
        }
        if (data.error === "LIMIT_REACHED") {
          setLimitReached(true);
          return;
        }
      }

      if (res.status === 401) {
        setErrorMessage("❌ Avtorizatsiya talab qilinadi. Iltimos, Telegram orqali qayta kiring.");
        return;
      }

      if (res.status === 413) {
        setErrorMessage("❌ Rasm hajmi juda katta. Iltimos, boshqa rasm tanlang.");
        return;
      }

      if (res.status === 504) {
        setErrorMessage("⏳ AI javob berish vaqti tugadi (server band). Iltimos, qayta urinib ko'ring.");
        return;
      }

      if (!res.ok) {
        setErrorMessage(data.result || data.message || `❌ Xatolik yuz berdi (${res.status})`);
        return;
      }

      if (data.result) {
        setResult(data.result);
      } else if (data.message) {
        setResult(data.message);
      } else {
        setResult("❌ Javob topilmadi");
      }
    } catch (error) {
      console.error("Analyze request error:", error);
      setErrorMessage("❌ Tarmoq xatosi yoki serverga ulanib bo'lmadi. Internet aloqangizni tekshiring.");
    } finally {
      setLoading(false);
    }
  };

  // DOWNLOAD WORD
  const exportWord = async () => {
    try {
      const response = await fetch("/api/export-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result }),
      });

      if (!response.ok) throw new Error("Word export error");

      const blob = await response.blob();
      const file = new File([blob], "TalabaAI-Shpargalka.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = "TalabaAI-Shpargalka.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error(error);
      alert("Word yuklashda xatolik yuz berdi");
    }
  };

  // TELEGRAMGA YUBORISH
  const sendToTelegram = async () => {
    try {
      const tgCtx = getTelegramContext();
      const userId = tgCtx.user?.id || (typeof window !== "undefined" ? localStorage.getItem("telegram_user_id") : null);

      const response = await fetch("/api/export-word", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(tgCtx.initData ? { "x-telegram-init-data": tgCtx.initData } : {}),
        },
        body: JSON.stringify({
          text: result,
          telegram_user_id: userId,
          send_to_telegram: true,
          init_data: tgCtx.initData || undefined,
        }),
      });

      if (!response.ok) throw new Error("Telegram error");

      alert("✅ Shpargalka Telegram botingizga yuborildi");
    } catch (error) {
      console.error(error);
      alert("❌ Telegramga yuborilmadi");
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
            onClick={() => window.history.back()}
            className="text-slate-400 mb-5 text-sm hover:text-white transition-colors"
          >
            ← Orqaga
          </button>

          <div className="mb-5">
            <h1 className="text-4xl font-bold">📸 Bilet Scan</h1>
            <p className="text-slate-400 mt-2 text-lg">
              Bilet yoki savol rasmini yuklang. AI sizga mazmunli shpargalka tayyorlaydi.
            </p>
          </div>

          {/* Hidden direct camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImage(file);
            }}
          />

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
              hover:border-cyan-400/50
              transition-colors
            "
          >
            <input {...getInputProps()} />

            {!image ? (
              <>
                <div className="text-6xl mb-3">📷</div>
                <h2 className="text-2xl font-bold">Rasm yuklash</h2>
                <p className="text-slate-400 mt-3 text-sm">
                  Rasm tashlang yoki Ctrl + V qiling
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

          {/* Action buttons under upload box */}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-[18px] bg-[#1d2a3a] border border-cyan-500/20 text-cyan-300 text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-[#24354a] transition-colors"
            >
              <span>📸</span> Kameradan olish
            </button>
            {image && (
              <button
                type="button"
                onClick={() => {
                  if (prevImageUrlRef.current) URL.revokeObjectURL(prevImageUrlRef.current);
                  setImage(null);
                  setBase64Image("");
                  setResult("");
                  setErrorMessage("");
                }}
                className="py-2.5 px-4 rounded-[18px] bg-red-950/40 border border-red-500/20 text-red-300 text-sm font-medium hover:bg-red-900/40 transition-colors"
              >
                O'chirish
              </button>
            )}
          </div>

          {compressing && (
            <p className="text-cyan-400 text-xs text-center mt-2 animate-pulse">
              ⚡ Rasm optimallashtirilmoqda...
            </p>
          )}

          {errorMessage && (
            <div className="mt-4 p-4 rounded-[20px] bg-red-950/50 border border-red-500/30 text-red-200 text-sm">
              {errorMessage}
            </div>
          )}

          {userBanned && (
            <div className="mt-4 p-4 rounded-[20px] bg-red-900/60 border border-red-500 text-white text-sm font-medium">
              🚫 Sizning profilingiz bloklangan. Iltimos, ma'muriyat bilan bog'laning.
            </div>
          )}

          {image && !userBanned && (
            <button
              onClick={analyzeImage}
              disabled={loading || compressing}
              className="
                mt-4
                w-full
                rounded-[28px]
                bg-cyan-500
                text-black
                font-bold
                py-4
                text-xl
                disabled:opacity-60
                disabled:cursor-not-allowed
                hover:bg-cyan-400
                active:scale-[0.99]
                transition-all
              "
            >
              {loading ? "⏳ Tahlil qilinmoqda..." : "🚀 AI tahlil qilish"}
            </button>
          )}

          {/* Limit Reached Banner */}
          {limitReached && (
            <div
              className="mt-5 rounded-[24px] border border-amber-500/30 p-5 space-y-3 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, rgba(120,53,15,0.45) 0%, rgba(124,45,18,0.30) 100%)",
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none animate-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(251,191,36,0.07), transparent)",
                  width: "60%",
                }}
              />

              <div
                className="flex items-center gap-2 font-bold text-lg"
                style={{ color: "#fbbf24" }}
              >
                ⚠️ Kunlik Scan limiti tugadi
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  📸 Scan: Limit tugagan
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  ⏰ Limit ertaga avtomatik yangilanadi
                </div>
                <div
                  className="flex items-center gap-2 font-medium"
                  style={{ color: "#fcd34d" }}
                >
                  ⭐ Premium versiyada cheksiz foydalanish mumkin
                </div>
              </div>

              <button
                onClick={handleUpgradeClick}
                className="w-full mt-2 py-3 rounded-[18px] font-bold text-black transition-all active:scale-95"
                style={{
                  background: "linear-gradient(90deg, #f59e0b, #ea580c)",
                  boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.filter = "brightness(1.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.filter = "brightness(1)")
                }
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
                  onClick={exportWord}
                  className="
                    flex-1
                    rounded-[18px]
                    bg-blue-600
                    hover:bg-blue-500
                    py-2.5
                    text-sm
                    font-bold
                    transition-colors
                  "
                >
                  ⬇️ Download
                </button>

                <button
                  onClick={sendToTelegram}
                  className="
                    flex-1
                    rounded-[18px]
                    bg-cyan-500
                    hover:bg-cyan-400
                    text-black
                    py-2.5
                    text-sm
                    font-bold
                    transition-colors
                  "
                >
                  📨 Telegram
                </button>
              </div>

              <h2 className="font-bold text-2xl mb-4">📚 Shpargalka</h2>

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
    </>
  );
}