// IMPORTLAR O'ZGARMAYDI
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

        if (
          !base64Image
        ) {
          setResult(
            "❌ Rasm tanlanmagan"
          );

          return;
        }

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
                  }
                ),
            }
          );

        const data =
          await res.json();

        setResult(
          data.result ||
            "❌ Javob topilmadi"
        );
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

  return (
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

        {result && (
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
  );
}