import Link from "next/link";

export default function FileToolsPage() {
  const tools = [
    {
      title: "Word → PDF",
      description:
        "DOCX faylni PDF ga aylantirish",
      icon: "📄",
      link:
        "/file-tools/word-to-pdf",
    },

    {
      title: "PDF → Word",
      description:
        "PDF ni DOCX ga aylantirish",
      icon: "📑",
      link:
        "/file-tools/pdf-to-word",
    },

    {
      title: "PPTX → PDF",
  description:
    "PPTX ni PDF ga aylantirish",
  icon: "📊",
  link:
    "/file-tools/pptx-to-pdf",
    },



    {
       title: "Merge PDF",
  description:
    "Bir nechta PDF ni birlashtirish",
  icon: "🧩",
  link:
    "/file-tools/merge-pdf",

    },

    {
      title: "Split PDF",
  description:
    "PDF ni bo‘lish",
  icon: "✂️",
  link:
    "/file-tools/split-pdf",
    },

    {
      title: "Compress PDF",
      description:
        "PDF hajmini kamaytirish",
      icon: "🗜️",
      link: "/file-tools/compress-pdf"
    },

  ];

  return (
    <main className="min-h-screen bg-[#071120] text-white">
      <div className="max-w-md mx-auto px-4 py-4">

        {/* Back Button */}
        <Link
          href="/"
          className="
            inline-flex
            items-center
            gap-2
            text-slate-400
            hover:text-cyan-400
            transition-colors
            mb-4
          "
        >
          ← Orqaga
        </Link>

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-[22px] font-bold text-white">
            📂 File Tools
          </h1>

          <p className="text-slate-400 text-[13px] mt-1">
            PDF, Word va PPTX converterlar
          </p>
        </div>

        {/* Tools */}
        <div className="space-y-2.5">
          {tools.map(
            (tool, index) =>
              tool.link ? (
                <Link
                  key={index}
                  href={tool.link}
                  className="
                    block
                    w-full
                    rounded-[22px]
                    bg-[#1A2636]
                    border border-cyan-500/10
                    px-4 py-2.5
                    text-left
                    transition-all
                    active:scale-[0.98]
                    hover:border-cyan-400/20
                    hover:shadow-[0_0_20px_rgba(0,180,255,0.08)]
                  "
                >
                  <div className="flex items-center gap-3">

                    {/* Icon */}
                    <div
                      className="
                        w-11 h-11
                        rounded-[14px]
                        bg-[#243447]
                        flex items-center justify-center
                        text-lg
                        shrink-0
                      "
                    >
                      {tool.icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-[15px]">
                        {tool.title}
                      </h3>

                      <p className="text-slate-400 text-[12px] mt-0.5">
                        {tool.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="text-cyan-400 text-base shrink-0">
                      →
                    </div>
                  </div>
                </Link>
              ) : (
                <button
                  key={index}
                  className="
                    w-full
                    rounded-[22px]
                    bg-[#1A2636]
                    border border-cyan-500/10
                    px-4 py-2.5
                    text-left
                    opacity-80
                  "
                >
                  <div className="flex items-center gap-3">

                    <div
                      className="
                        w-11 h-11
                        rounded-[14px]
                        bg-[#243447]
                        flex items-center justify-center
                        text-lg
                        shrink-0
                      "
                    >
                      {tool.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-[15px]">
                        {tool.title}
                      </h3>

                      <p className="text-slate-400 text-[12px] mt-0.5">
                        {tool.description}
                      </p>
                    </div>

                    <div className="text-slate-500 text-base shrink-0">
                      →
                    </div>
                  </div>
                </button>
              )
          )}
        </div>
      </div>
    </main>
  );
}