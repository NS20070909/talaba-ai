"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  useDropzone,
} from "react-dropzone";

export default function MergePdfPage() {
  const [files, setFiles] =
    useState<File[]>([]);

  const [loading, setLoading] =
    useState(false);

  // YANGI TUGMA
  const [
    showTelegramButton,
    setShowTelegramButton,
  ] = useState(false);

  // Drag & Drop
  const onDrop = useCallback(
    (
      acceptedFiles: File[]
    ) => {
      const pdfFiles =
        acceptedFiles.filter(
          (file) =>
            file.name
              .toLowerCase()
              .endsWith(
                ".pdf"
              )
        );

      setFiles(
        (prev) => [
          ...prev,
          ...pdfFiles,
        ]
      );

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
    multiple: true,
    accept: {
      "application/pdf":
        [".pdf"],
    },
  });

  // Ctrl + V
  useEffect(() => {
    const handlePaste = (
      event: ClipboardEvent
    ) => {
      const pastedFiles =
        Array.from(
          event
            .clipboardData
            ?.files || []
        );

      const pdfFiles =
        pastedFiles.filter(
          (file) =>
            file.name
              .toLowerCase()
              .endsWith(
                ".pdf"
              )
        );

      if (
        pdfFiles.length >
        0
      ) {
        setFiles(
          (prev) => [
            ...prev,
            ...pdfFiles,
          ]
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

  // MERGE
  const handleMerge =
    async () => {
      if (
        files.length < 2
      ) {
        alert(
          "Kamida 2 ta PDF tanlang"
        );
        return;
      }

      try {
        setLoading(true);

        const formData =
          new FormData();

        files.forEach(
          (file) => {
            formData.append(
              "files",
              file
            );
          }
        );

        const response =
          await fetch(
            "/api/merge-pdf",
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
          "merged.pdf";

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
          "✅ PDF lar birlashtirildi"
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
      try {
        setLoading(true);

        const formData =
          new FormData();

        files.forEach(
          (file) => {
            formData.append(
              "files",
              file
            );
          }
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
            "/api/merge-pdf",
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
            🧩 Merge PDF
          </h1>

          <p className="text-slate-400 mt-1">
            Bir nechta PDF ni
            birlashtiring
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
            🧩
          </div>

          <h2 className="text-xl font-semibold">
            PDF fayllarni
            yuklang
          </h2>

          <p className="text-slate-400 text-sm mt-2">
            {files.length >
            0
              ? `${files.length} ta PDF tanlandi`
              : "Drag & Drop, Ctrl + V yoki PDF tanlang"}
          </p>

          <button
            onClick={
              open
            }
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

          {files.length >
            0 && (
            <div className="mt-5 text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-slate-400">
                  {files.length} ta
                  PDF
                </span>

                <button
                  onClick={() =>
                    setFiles([])
                  }
                  className="
                    text-red-400
                    text-sm
                    hover:text-red-300
                  "
                >
                  🗑 Tozalash
                </button>
              </div>

              <div className="space-y-2">
                {files.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="
                        flex
                        items-center
                        justify-between
                        rounded-xl
                        bg-[#243447]
                        px-3 py-2
                      "
                    >
                      <span className="text-sm text-slate-300 truncate">
                        📄{" "}
                        {
                          file.name
                        }
                      </span>

                      <button
                        onClick={() =>
                          setFiles(
                            (
                              prev
                            ) =>
                              prev.filter(
                                (
                                  _,
                                  i
                                ) =>
                                  i !==
                                  index
                              )
                          )
                        }
                        className="
                          text-red-400
                          hover:text-red-300
                        "
                      >
                        ✕
                      </button>
                    </div>
                  )
                )}
              </div>

              <button
                onClick={
                  open
                }
                className="
                  mt-3
                  text-cyan-400
                  text-sm
                  hover:text-cyan-300
                "
              >
                + Yana PDF
                qo‘shish
              </button>
            </div>
          )}

          {files.length >
            1 && (
            <>
              <button
                onClick={
                  handleMerge
                }
                disabled={
                  loading
                }
                className="
                  mt-5
                  w-full
                  rounded-[18px]
                  bg-emerald-500
                  text-black
                  font-semibold
                  px-5 py-3
                "
              >
                {loading
                  ? "⏳ Birlashtirilmoqda..."
                  : "PDF larni birlashtirish"}
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
                  📨 Telegram chatga
                  yuborish
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}