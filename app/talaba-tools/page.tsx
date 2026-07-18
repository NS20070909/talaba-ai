"use client";

import Link from "next/link";

const tools = [
  {
    icon: "🧮",
    title: "GPA Hisoblagich",
    desc: "GPA va stipendiya hisoblash",
    color: "from-cyan-500/20 to-sky-500/10",
    link: "/talaba-tools/gpa",
    active: true,
  },
  {
  icon: "📊",
  title: "Slayd Tayyorlash",
  desc: "AI orqali PPT va prezentatsiya",
  color:
    "from-violet-500/20 to-fuchsia-500/10",
  link: "/talaba-tools/ppt",
  active: true,
},
  {
    icon: "⚡",
    title: "Referat Yozish",
    desc:
      "AI yordamida referat yaratish",
    color:
      "from-blue-500/20 to-indigo-500/10",
    link: "/talaba-tools/write-referat",
    active: true,
  },
  {
    icon: "📄",
    title: "Referat Formatlash",
    desc: "OTM formatiga moslash",
    color:
      "from-emerald-500/20 to-green-500/10",
    link: "/talaba-tools/format-referat",
    active: true,
  },
  {
    icon: "📝",
    title: "Hujjat Tozalash",
    desc: "Shrift va formatni tuzatish",
    color:
      "from-orange-500/20 to-amber-500/10",
    link: "#",
    active: false,
  },
  {
    icon: "🌍",
    title: "Tarjima Pro",
    desc: "UZ, RU va EN tarjima",
    color:
      "from-pink-500/20 to-rose-500/10",
    link: "#",
    active: false,
  },
];

export default function TalabaToolsPage() {
  return (
    <main className="min-h-screen bg-[#0f1724] text-white">
      <div className="max-w-md mx-auto px-4 py-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/"
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
            <h1 className="text-[26px] font-bold">
              Talaba Yordamchi
            </h1>

            <p className="text-slate-400 text-sm">
              Foydali vositalar
            </p>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {tools.map(
            (tool, index) => {
              const isActive =
                tool.active;

              return (
                <Link
                  key={index}
                  href={tool.link}
                  className={`
                    block
                    rounded-[28px]
                    px-4 py-3
                    transition-all
                    ${
                      isActive
                        ? "bg-[#243140] border border-cyan-400/40 shadow-[0_0_25px_rgba(34,211,238,0.12)]"
                        : "bg-[#243140] border border-cyan-500/10 opacity-90"
                    }
                  `}
                >
                  <div className="flex items-center gap-4">

                    <div
                      className={`
                        h-14 w-14 rounded-[18px]
                        ${
                          isActive
                            ? "bg-cyan-500/20"
                            : `bg-gradient-to-br ${tool.color}`
                        }
                        flex items-center justify-center
                        text-2xl
                        shrink-0
                      `}
                    >
                      {tool.icon}
                    </div>

                    <div className="flex-1">
                      <h2 className="font-bold text-[16px]">
                        {tool.title}
                      </h2>

                      <p className="text-[13px] text-slate-400 mt-0.5">
                        {tool.desc}
                      </p>
                    </div>

                    <div
                      className={`text-2xl font-bold transition-all ${
                        isActive
                          ? "text-cyan-400 drop-shadow-[0_0_8px_#22d3ee]"
                          : "text-slate-500"
                      }`}
                    >
                      →
                    </div>

                  </div>
                </Link>
              );
            }
          )}
        </div>

      </div>
    </main>
  );
}