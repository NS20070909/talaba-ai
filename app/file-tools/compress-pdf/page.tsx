"use client";

import Link from "next/link";

export default function CompressPdfPage() {
  return (
    <main className="min-h-screen bg-[#071120] text-white">
      <div className="max-w-md mx-auto px-4 py-4">

        <Link
          href="/file-tools"
          className="text-slate-400 mb-4 inline-block"
        >
          ← Orqaga
        </Link>

        <div
          className="
            rounded-[28px]
            bg-[#1A2636]
            p-8
            text-center
            mt-10
          "
        >
          <div className="text-6xl mb-4">
            🚧
          </div>

          <h1 className="text-[28px] font-bold">
            Beta Version
          </h1>

          <p className="text-slate-400 mt-3 leading-7">
            Compress PDF
            hozir test
            rejimida.
            <br />
            Production
            server
            chiqqach real
            compression
            qo‘shiladi.
          </p>

          <div
            className="
              mt-6
              rounded-2xl
              bg-yellow-500/10
              border
              border-yellow-500/20
              p-4
              text-sm
              text-yellow-300
            "
          >
            Telegram bot
            deploy
            bo‘lgach
            production
            versiya
            ishlaydi.
          </div>

          <Link
            href="/file-tools"
            className="
              mt-6
              inline-flex
              items-center
              justify-center
              rounded-[18px]
              bg-cyan-500
              text-black
              font-semibold
              px-6 py-3
            "
          >
            🔙 Orqaga
          </Link>
        </div>
      </div>
    </main>
  );
}