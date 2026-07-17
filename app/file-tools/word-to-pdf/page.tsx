"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";

export default function WordToPdfPage() {
  const [file, setFile] =
    useState<File | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [
    showTelegramButton,
    setShowTelegramButton,
  ] = useState(false);

  const onDrop =
    useCallback(
      (
        acceptedFiles: File[]
      ) => {
        const selected =
          acceptedFiles[0];

        if (!selected) return;

        if (
          !selected.name.endsWith(
            ".docx"
          )
        ) {
          alert(
            "Faqat .docx fayl yuklang"
          );
          return;
        }

        setFile(selected);
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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
  });

  // CTRL + V
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
        pastedFile.name.endsWith(
          ".docx"
        )
      ) {
        setFile(
          pastedFile
        );

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

  // TELEGRAM USER ID SAVE
useEffect(() => {
  const tg =
    (window as any)
      ?.Telegram
      ?.WebApp;

  tg?.ready();

  const userId =
    tg?.initDataUnsafe
      ?.user?.id;

  if (userId) {
    localStorage.setItem(
      "telegram_user_id",
      String(userId)
    );

    console.log(
      "Telegram User ID:",
      userId
    );
  } else {
    console.log(
      "Telegram user id topilmadi"
    );
  }
}, []);

  // PDF GA AYLANTIRISH
  const handleDownload =
    async () => {
      if (!file) return;

      try {
        setLoading(true);

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        const userId = localStorage.getItem("telegram_user_id");
        if (userId) {
          formData.append("telegram_user_id", userId);
        }

        const response =
          await fetch(
            "/api/convert-word-to-pdf",
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
            "Conversion failed"
          );
        }

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
          "talaba-ai.pdf";

        document.body.appendChild(
          a
        );

        a.click();
        a.remove();

        window.URL.revokeObjectURL(
          url
        );

        // TELEGRAM TUGMASI CHIQADI
        setShowTelegramButton(
          true
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        alert(
          "Xatolik yuz berdi"
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
        setLoading(true);

        const formData =
          new FormData();

        formData.append(
          "file",
          file
        );

        formData.append(
          "send_to_telegram",
          "true"
        );

        const userId =
          localStorage.getItem(
            "telegram_user_id"
          );

        if (
          !userId
        ) {
          alert(
            "Telegram user id topilmadi. /scan orqali qayta kiring."
          );
          return;
        }

        formData.append(
          "telegram_user_id",
          userId
        );

        const response =
          await fetch(
            "/api/convert-word-to-pdf",
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
            "Telegram send failed"
          );
        }

        alert(
          "✅ Fayl Telegram chatga yuborildi"
        );
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
      <div className="max-w-md mx-auto px-4 py-4">

        <Link
          href="/file-tools"
          className="text-slate-400 mb-4 inline-block"
        >
          ← Orqaga
        </Link>

        <div className="mb-6">
          <h1 className="text-[24px] font-bold">
            📄 Word → PDF
          </h1>

          <p className="text-slate-400 mt-1">
            DOCX faylni PDF formatga
            aylantiring
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
            📄
          </div>

          <h2 className="text-xl font-semibold">
            {file
              ? "✅ Fayl tanlandi"
              : "DOCX fayl yuklang"}
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            {file
              ? file.name
              : "Drag & Drop, Ctrl + V yoki fayl tanlang"}
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
            Fayl tanlash
          </button>

          {file && (
            <>
              <button
                onClick={
                  handleDownload
                }
                disabled={
                  loading
                }
                className="
                  mt-3
                  w-full
                  rounded-[18px]
                  bg-emerald-500
                  text-black
                  font-semibold
                  px-5 py-3
                "
              >
                {loading
                  ? "⏳ Aylantirilmoqda..."
                  : "PDF ga aylantirish"}
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
                    mt-3
                    w-full
                    rounded-[18px]
                    bg-cyan-500
                    text-black
                    font-semibold
                    px-5 py-3
                  "
                >
                  📨 Telegram chatga yuborish
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}