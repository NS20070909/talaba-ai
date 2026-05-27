"use client";

import Link from "next/link";
import {
  useCallback,
  useState,
} from "react";
import {
  useDropzone,
} from "react-dropzone";

export default function SplitPdfPage() {
  const [file, setFile] =
    useState<File | null>(
      null
    );

  const [
    startPage,
    setStartPage,
  ] = useState("");

  const [
    endPage,
    setEndPage,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  // YANGI TUGMA
  const [
    showTelegramButton,
    setShowTelegramButton,
  ] = useState(false);

  const onDrop = useCallback(
    (
      acceptedFiles: File[]
    ) => {
      const selected =
        acceptedFiles[0];

      if (!selected)
        return;

      if (
        !selected.name
          .toLowerCase()
          .endsWith(
            ".pdf"
          )
      ) {
        alert(
          "Faqat PDF yuklang"
        );
        return;
      }

      setFile(
        selected
      );

      // reset
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
      "application/pdf":
        [".pdf"],
    },
  });

  // PDF BO‘LISH
  const handleSplit =
    async () => {
      if (!file) {
        alert(
          "PDF tanlang"
        );
        return;
      }

      if (
        !startPage ||
        !endPage
      ) {
        alert(
          "Bet oralig‘ini kiriting"
        );
        return;
      }

      try {
        setLoading(
          true
        );

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        formData.append(
          "startPage",
          startPage
        );

        formData.append(
          "endPage",
          endPage
        );

        const response =
          await fetch(
            "/api/split-pdf",
            {
              method:
                "POST",
              body:
                formData,
            }
          );

        if (
          !response.ok
        ) {
          const data =
            await response.json();

          throw new Error(
            data.error ||
              "Xatolik"
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
          `split-${file.name}`;

        document.body.appendChild(
          a
        );

        a.click();
        a.remove();

        window.URL.revokeObjectURL(
          url
        );

        // YANGI TUGMA
        setShowTelegramButton(
          true
        );

        alert(
          "✅ PDF bo‘lindi"
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          error instanceof
            Error
            ? error.message
            : "Xatolik yuz berdi"
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  // TELEGRAMGA YUBORISH
  const handleTelegramSend =
    async () => {
      if (!file) return;

      try {
        setLoading(
          true
        );

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        formData.append(
          "startPage",
          startPage
        );

        formData.append(
          "endPage",
          endPage
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
            "/api/split-pdf",
            {
              method:
                "POST",
              body:
                formData,
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Telegramga yuborishda xatolik"
          );
        }

        alert(
          "✅ PDF Telegram chatga yuborildi"
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "❌ Telegramga yuborilmadi"
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  return (
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
            ✂️ Split PDF
          </h1>

          <p className="text-slate-400 mt-1">
            PDF ni kerakli
            betlarga bo‘ling
          </p>
        </div>

        <div
          {...getRootProps()}
          className="
            rounded-[28px]
            border-2
            border-dashed
            border-cyan-500/20
            bg-[#1A2636]
            p-8
            text-center
          "
        >
          <input
            {...getInputProps()}
          />

          <div className="text-5xl mb-4">
            ✂️
          </div>

          <h2 className="text-xl font-semibold">
            {file
              ? "✅ PDF tanlandi"
              : "PDF yuklang"}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            {file
              ? file.name
              : "Drag & Drop yoki PDF tanlang"}
          </p>

          <button
            onClick={open}
            className="
              mt-5
              rounded-[18px]
              bg-cyan-500
              text-black
              font-semibold
              px-5 py-3
            "
          >
            PDF tanlash
          </button>

          {file && (
            <div className="mt-5 space-y-3">
              <div>
                <label className="text-sm text-slate-400">
                  Boshlanish beti
                </label>

                <input
                  type="number"
                  value={
                    startPage
                  }
                  onChange={(
                    e
                  ) =>
                    setStartPage(
                      e.target
                        .value
                    )
                  }
                  className="
                    mt-1
                    w-full
                    rounded-xl
                    bg-[#243447]
                    px-4 py-3
                    outline-none
                  "
                />
              </div>

              <div>
                <label className="text-sm text-slate-400">
                  Tugash beti
                </label>

                <input
                  type="number"
                  value={
                    endPage
                  }
                  onChange={(
                    e
                  ) =>
                    setEndPage(
                      e.target
                        .value
                    )
                  }
                  className="
                    mt-1
                    w-full
                    rounded-xl
                    bg-[#243447]
                    px-4 py-3
                    outline-none
                  "
                />
              </div>

              <button
                onClick={
                  handleSplit
                }
                disabled={
                  loading
                }
                className="
                  w-full
                  rounded-[18px]
                  bg-emerald-500
                  text-black
                  font-semibold
                  px-5 py-3
                "
              >
                {loading
                  ? "⏳ Bo‘linmoqda..."
                  : "PDF ni bo‘lish"}
              </button>

              {showTelegramButton && (
                <button
                  onClick={
                    handleTelegramSend
                  }
                  disabled={
                    loading
                  }
                  className="
                    w-full
                    rounded-[18px]
                    bg-cyan-500
                    text-black
                    font-semibold
                    px-5 py-3
                  "
                >
                  📨 Telegram chatga
                  yuborish
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}