"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import UsageStatsWidget from "@/components/UsageStatsWidget";

const features = [
  {
    icon: "📸",
    title: "Bilet Scan",
    desc: "Rasm orqali savollarni aniqlash",
    color: "from-sky-500/20 to-cyan-500/10",
    link: "/scan",
  },
  {
    icon: "📄",
    title: "File Tools",
    desc: "PDF, Word va PPTX converterlar",
    color:
      "from-emerald-500/20 to-green-500/10",
    link: "/file-tools",
  },
   {
  icon: "🛠",
  title: "Talaba Yordamchi",
  desc: "GPA, PPT va hujjat vositalari",
  color:
    "from-cyan-500/20 to-blue-500/10",
  link: "/talaba-tools"
},
  {
    icon: "🧠",
    title: "Quiz",
    desc: "PDF yoki test fayldan quiz",
    color:
      "from-violet-500/20 to-fuchsia-500/10",
    link: "/quiz",
  },
  {
    icon: "🤖",
    title: "AI Chat",
    desc: "Fanlardan AI yordamchi",
    color:
      "from-orange-500/20 to-amber-500/10",
    link: "#",
  },
 
  {
    icon: "📝",
    title: "5 Daqiqada Tayyor",
desc: "Qisqa konspekt va tayyorlash",
    color:
      "from-pink-500/20 to-rose-500/10",
    link: "#",
  },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    // Telegram user id save
    const tg =
      (
        window as typeof window & {
          Telegram?: {
            WebApp?: {
              initDataUnsafe?: {
                user?: {
                  id?: number;
                };
              };
            };
          };
        }
      ).Telegram?.WebApp;

    const userId =
      tg?.initDataUnsafe
        ?.user?.id;

    if (userId) {
      localStorage.setItem(
        "telegram_user_id",
        String(userId)
      );
    }

    if (
      params.get("tab") ===
      "scan"
    ) {
      router.push("/scan");
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-[#0f1724] text-white">
      <div className="max-w-md mx-auto px-4 py-4">

        {/* Header */}
        <div className="rounded-[26px] border border-cyan-500/10 bg-gradient-to-b from-[#1a2635] to-[#16202d] p-3 mb-3 shadow-[0_0_30px_rgba(0,180,255,0.06)]">

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="
                  h-14 w-14 rounded-[18px]
                  bg-[#121c29]
                  border border-cyan-400
                  flex items-center justify-center
                  text-2xl
                  shadow-[0_0_20px_rgba(0,170,255,0.20)]
                  shrink-0
                "
              >
                🎓
              </div>

              <div>
                <h1 className="text-[28px] font-bold leading-none">
                  Talaba AI
                </h1>

                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />

                  <p className="text-slate-400 text-sm whitespace-nowrap">
                    AI Student Assistant
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/premium"
              className="
                flex items-center gap-1
                px-2.5 py-1.5
                rounded-xl
                bg-gradient-to-r from-cyan-500/10 to-blue-500/10
                border border-cyan-500/20
                text-[11px] font-bold tracking-wide
                text-cyan-300 uppercase
                transition-all
                active:scale-95
                shadow-[0_0_15px_rgba(6,182,212,0.15)]
              "
            >
              💎 Tariflar
            </Link>
          </div>

        </div>

        <UsageStatsWidget />

        {/* Feature Cards */}
        <div className="space-y-3">
          {features.map(
            (item, index) =>
              item.link !== "#" ? (
                <Link
                  key={index}
                  href={item.link}
                  className="
                    block w-full
                    rounded-[28px]
                    bg-[#243140]
                    border border-cyan-500/10
                    px-4 py-3
                    transition-all
                    active:scale-[0.98]
                  "
                >
                  <div className="flex items-center gap-4">

                    <div
                      className={`
                        h-14 w-14 rounded-[18px]
                        bg-gradient-to-br ${item.color}
                        flex items-center justify-center
                        text-2xl
                        shrink-0
                      `}
                    >
                      {item.icon}
                    </div>

                    <div className="text-left flex-1">
                      <h2 className="font-bold text-[16px]">
                        {item.title}
                      </h2>

                      <p className="text-[13px] text-slate-400 mt-0.5">
                        {item.desc}
                      </p>
                    </div>

                    <div className="text-cyan-400 text-xl shrink-0">
                      →
                    </div>
                  </div>
                </Link>
              ) : (
                <div
                  key={index}
                  className="
                    w-full
                    rounded-[28px]
                    bg-[#243140]
                    border border-cyan-500/10
                    px-4 py-3
                    opacity-80
                  "
                >
                  <div className="flex items-center gap-4">

                    <div
                      className={`
                        h-14 w-14 rounded-[18px]
                        bg-gradient-to-br ${item.color}
                        flex items-center justify-center
                        text-2xl
                        shrink-0
                      `}
                    >
                      {item.icon}
                    </div>

                    <div className="text-left flex-1">
                      <h2 className="font-bold text-[16px]">
                        {item.title}
                      </h2>

                      <p className="text-[13px] text-slate-400 mt-0.5">
                        {item.desc}
                      </p>
                    </div>

                    <div className="text-slate-500 text-xl shrink-0">
                      →
                    </div>
                  </div>
                </div>
              )
          )}
        </div>
      </div>
    </main>
  );
}