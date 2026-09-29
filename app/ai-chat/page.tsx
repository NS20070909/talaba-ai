"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import LiveCard from "@/components/ai-chat/LiveCard";
import LiveRoomModal from "@/components/ai-chat/LiveRoomModal";
import { getTelegramContext } from "@/lib/client/telegram";

type ChatAttachment = {
  name: string;
  type: string;
  size: number;
  base64: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  mode?: string;
  sources?: Array<{ title: string; url: string }>;
  searchNotice?: string;
  attachment?: {
    name: string;
    type: string;
    size: number;
  };
  timestamp?: number;
};

type FlashAudioData = {
  audioUrl?: string;
  durationSeconds?: number;
  script?: string;
  loading: boolean;
  error?: string;
};



const QUICK_PROMPTS = [
  { label: "⚡ 5 daqiqada tayyorlash", text: "Menga ushbu mavzu bo'yicha 5 daqiqada o'qib tugatish mumkin bo'lgan eng muhim qisqa konspekt, asosiy formulalar va tayyor imtihon savol-javoblarini tuzib bering: " },
  { label: "💡 Mavzuni sodda tushuntir", text: "Menga ushbu mavzuni eng oddiy va qiziqarli hayotiy misollar orqali tushuntirib ber: " },
  { label: "🎯 Meni imtihonga tayyorla", text: "Ertaga ushbu fan bo'yicha imtihonim bor, meni tayyorlash uchun eng muhim savollarni bering: " },
  { label: "🇬🇧 Ingliz tilida suhbatlashamiz", text: "Let's practice English speaking together! Ask me a thought-provoking question." },
  { label: "💻 Kod xatosini top", text: "Quyidagi kodimdagi xatoni toping, tahlil qiling va to'g'rilangan variantini bering:\n\n```python\n# Kodingizni shu yerga yozing\n```" },
  { label: "🧮 Masalani bosqichma-bosqich yech", text: "Ushbu masalani 1-qadam, 2-qadam formatida, har bir qadam sababini tushuntirib yechib bering:\n\n" },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Markdown and Code Formatter Component ──
function FormattedMessageText({ text }: { text: string }) {
  // Check for code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : "code";
          const codeContent = hasLang ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={index} className="my-2.5 rounded-xl overflow-hidden border border-slate-700/80 bg-[#0c121b]">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#151f2d] border-b border-slate-700/60 text-[11px] font-mono text-cyan-400">
                <span>{lang}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(codeContent);
                  }}
                  className="text-slate-400 hover:text-white transition active:scale-95"
                >
                  📋 Nusxalash
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        // Standard text lines
        // 1. Escape HTML for safety
        let safeText = part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        
        // 2. Bold: **text**
        safeText = safeText.replace(/\*\*(.*?)\*\*/g, "<strong class='text-cyan-50 font-bold'>$1</strong>");
        
        // 3. Italic: *text* (excluding those that are start of lines which are lists)
        safeText = safeText.replace(/(?<!^|\n)\*(.*?)\*(?!\*)/g, "<em>$1</em>");
        
        // 4. Headings
        safeText = safeText.replace(/^### (.*)$/gm, "<h3 class='text-xs font-bold text-cyan-400 uppercase tracking-wide mt-3 mb-1 block'>$1</h3>");
        safeText = safeText.replace(/^## (.*)$/gm, "<h2 class='text-sm font-black text-cyan-300 mt-3 mb-1 block'>$1</h2>");
        safeText = safeText.replace(/^# (.*)$/gm, "<h1 class='text-base font-black text-cyan-300 mt-3 mb-1 block'>$1</h1>");

        // 5. Lists (unordered & ordered)
        safeText = safeText.replace(/^[-*]\s+(.*)$/gm, "<li class='ml-5 list-disc my-0.5'>$1</li>");
        safeText = safeText.replace(/^(\d+)\.\s+(.*)$/gm, "<li class='ml-5 list-decimal my-0.5'>$2</li>");

        return (
          <div 
            key={index} 
            className="whitespace-pre-wrap font-sans" 
            dangerouslySetInnerHTML={{ __html: safeText }} 
          />
        );
      })}
    </div>
  );
}

// ── Flash Audio Player Component ──
function FlashAudioPlayer({
  audioUrl,
  durationSeconds,
  script,
  onClose,
}: {
  audioUrl: string;
  durationSeconds: number;
  script?: string;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (!isNaN(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="mt-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#141f2d] to-[#1a283b] p-3.5 shadow-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300 text-sm">
            🔊
          </span>
          <span className="text-xs font-bold text-cyan-300">Flash Review (Qisqa audio)</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs px-1"
        >
          ✕
        </button>
      </div>

      {/* Controls and Seekbar */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-black hover:bg-cyan-300 transition active:scale-95 shadow-md shadow-cyan-400/20"
        >
          {isPlaying ? "❚❚" : "▶"}
        </button>

        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || 60}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="h-1.5 w-full appearance-none rounded-lg bg-slate-700 accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration || durationSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Toggle Script */}
      {script && (
        <div className="mt-2.5 pt-2 border-t border-slate-700/60">
          <button
            onClick={() => setShowScript(!showScript)}
            className="text-[11px] text-slate-400 hover:text-cyan-300 font-medium transition"
          >
            {showScript ? "▲ Skriptni berkitish" : "▼ Audio matnini ko'rish"}
          </button>
          {showScript && (
            <p className="mt-1.5 text-xs text-slate-300 italic bg-[#0d141e] p-2.5 rounded-xl border border-slate-800 leading-relaxed">
              &ldquo;{script}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to detect if user prompt explicitly requests a live internet / web / google search
function isExplicitSearchIntent(text: string): boolean {
  const t = text.trim().toLowerCase();

  // 1. Exclude general concept questions where "internet" is the subject matter
  // e.g.: "Internet nima?", "Internet qanday ishlaydi?", "Internet tarixi haqida tushuntir"
  if (/^internet\s+(nima\b|qanday|tarixi|haqida|mohiyati|tushunchasi|arxitekturasi|tarmog'i|protokollari)/i.test(t)) {
    return false;
  }
  if (/internet\s+(nima\b|qanday ishlaydi|tarixi|haqida tushuntir)/i.test(t)) {
    return false;
  }

  // 2. Explicit ablative search keywords (searching FROM the internet):
  // "internetdan", "internetan", "webdan", "vebdan", "googledan", "saytlardan"
  if (/\b(internetdan|internetan|webdan|vebdan|googledan|saytlardan)\b/i.test(t)) {
    return true;
  }

  // 3. Phrasing with platform + search verbs:
  // "internetda qidir", "google'dan top", "web orqali izla", "internetdan ma'lumot top"
  if (/(internet|web|veb|google)\s*(da|dan|orqali|yordamida|bilan)?\s*(qidir|izla|top|topib|topish|tekshir)/i.test(t)) {
    return true;
  }

  // 4. "Google'dan" / "Google dan"
  if (/google['`]?dan/i.test(t)) {
    return true;
  }

  return false;
}

// Helper to determine whether Google Search should be attached to the request
function shouldPerformWebSearch(text: string, webSearchEnabled: boolean): boolean {
  // If toggle is OFF, NEVER perform web search
  if (!webSearchEnabled) return false;

  const t = text.trim().toLowerCase();

  // If user explicitly asked for internet search
  if (isExplicitSearchIntent(t)) return true;

  // Real-time or current temporal triggers (2025, 2026, recent news, grants, stats)
  const hasRecentYear = /\b(2025|2026|2027)\b/.test(t);
  const hasRealtimeKeywords = /(yangilik|bugungi|kechagi|so'nggi|oxirgi|hozirgi|stipendiya|grant|deadline|muddat|kursi|narxi|reyting|vakansiya|farmon|qaror|qonun|natija)/i.test(t);
  const hasSearchVerbs = /(qidir|izla|top|topib|tekshir)/i.test(t);

  if (hasRecentYear || (hasRealtimeKeywords && hasSearchVerbs) || (hasRecentYear && hasRealtimeKeywords)) {
    return true;
  }

  // Specific requests to find/lookup
  if (/(topib ber|qidirib ber|yangiliklarini top)/i.test(t)) {
    return true;
  }

  return false;
}

export default function AiChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [activeMode, setActiveMode] = useState<string>("general");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Internal Shell Navigation Handler
  const handleBackNavigation = () => {
    if (showCheckModal) {
      setShowCheckModal(false);
      return;
    }
    if (showLiveModal) {
      setShowLiveModal(false);
      return;
    }
    if (activeMode !== "general") {
      setActiveMode("general");
      return;
    }
    if (messages.length > 0) {
      setMessages([]);
      return;
    }
    router.push("/");
  };
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [livePersona, setLivePersona] = useState("olim");
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState<number | undefined>(undefined);
  const [liveLimitMinutes, setLiveLimitMinutes] = useState<number>(20);
  const [flashReviewRemaining, setFlashReviewRemaining] = useState<number | undefined>(undefined);
  const [flashReviewUsed, setFlashReviewUsed] = useState<number>(0);
  const [flashReviewLimit, setFlashReviewLimit] = useState<number>(5);

  // Flash Review Audio state map { [messageId]: FlashAudioData }
  const [flashAudioMap, setFlashAudioMap] = useState<Record<string, FlashAudioData>>({});

  // Voice Note State (Web Speech API)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // "Meni Tekshir" Modal State
  const [showCheckModal, setShowCheckModal] = useState(false);
  const [checkTab, setCheckTab] = useState<"ai_generate" | "file_upload">("ai_generate");
  const [checkSubject, setCheckSubject] = useState("Informatika");
  const [checkTopic, setCheckTopic] = useState("Algoritmlar");
  const [checkDifficulty, setCheckDifficulty] = useState("O'rta");
  const [checkCount, setCheckCount] = useState(5);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkQuestions, setCheckQuestions] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [checkEvaluation, setCheckEvaluation] = useState<any>(null);

  // "Meni Tekshir" Modal File Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileAnswersText, setFileAnswersText] = useState("");
  const checkFileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = checkFileInputRef;

  // Independent Chat Attachment State (📎 button)
  const [chatAttachment, setChatAttachment] = useState<ChatAttachment | null>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending, flashAudioMap]);

  // Load Telegram user ID, fetch daily usage stats and saved persona
  useEffect(() => {
    const fetchUserStats = async (uid: string | number) => {
      try {
        const res = await fetch(`/api/user-stats?telegram_id=${uid}&t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            if (data.stats.liveSecondsRemaining !== undefined) {
              setLiveRemainingSeconds(data.stats.liveSecondsRemaining);
            }
            if (data.stats.liveMinutesLimit !== undefined) {
              setLiveLimitMinutes(data.stats.liveMinutesLimit);
            }
            const flLimit = data.stats.flashReviewLimit ?? 5;
            const flUsed = data.stats.flashReviewUsed ?? 0;
            setFlashReviewLimit(flLimit);
            setFlashReviewUsed(flUsed);
            setFlashReviewRemaining(Math.max(0, flLimit - flUsed));
          }
        }
      } catch {
        // Non-fatal
      }
    };

    const initAndFetch = () => {
      try {
        const tgCtx = getTelegramContext();
        const resolvedId = tgCtx.user?.id ? String(tgCtx.user.id) : (typeof window !== "undefined" ? localStorage.getItem("telegram_user_id") : null);

        if (resolvedId) {
          fetchUserStats(resolvedId);
        }

        const savedPersona = typeof window !== "undefined" ? localStorage.getItem("talaba_live_persona") : null;
        if (savedPersona === "zilola" || savedPersona === "olim") {
          setLivePersona(savedPersona);
        }
      } catch {
        // Ignore
      }
    };

    initAndFetch();
    window.addEventListener("telegram-user-ready", initAndFetch);

    return () => {
      window.removeEventListener("telegram-user-ready", initAndFetch);
    };
  }, []);

  const showToast = (msg: string, duration = 3000) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), duration);
  };

  // Voice Note handler via Web Speech Recognition
  const toggleVoiceNote = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Brauzeringiz ovozli yozishni qo'llab-quvvatlamaydi.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "uz-UZ";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        showToast("Ovoz yozilmoqda... Gapiring.");
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          showToast("Mikrofonga ruxsat berilmadi.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start voice note:", err);
      setIsListening(false);
      showToast("Mikrofonni ishga tushirib bo'lmadi.");
    }
  };

  // ── Flash Review (40-60 second Audio Generator) ──
  const handleFlashReview = async (message: Message) => {
    const msgId = message.id;

    // Toggle off if already active
    if (flashAudioMap[msgId]?.audioUrl) {
      setFlashAudioMap((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      return;
    }

    if (flashReviewLimit > 0 && flashReviewUsed >= flashReviewLimit) {
      showToast(`Bugungi Flash Review limitingiz (${flashReviewLimit}/${flashReviewLimit}) tugagan. Ko'proq audio uchun Premium tarifga o'ting ⭐`);
      return;
    }

    setFlashAudioMap((prev) => ({
      ...prev,
      [msgId]: { loading: true },
    }));

    try {
      const tgCtx = getTelegramContext();
      const telegramId = tgCtx.user?.id || (typeof window !== "undefined" ? localStorage.getItem("telegram_user_id") : null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tgCtx.initData) {
        headers["x-telegram-init-data"] = tgCtx.initData;
      }
      const res = await fetch("/api/ai-chat/flash-review", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: message.text,
          topic: activeMode,
          telegram_id: telegramId ? Number(telegramId) : undefined,
          init_data: tgCtx.initData || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Flash Review yaratib bo'lmadi.");
      }

      setFlashReviewUsed((prev) => Math.min(flashReviewLimit, prev + 1));
      if (data.remaining !== undefined) {
        setFlashReviewRemaining(data.remaining);
      }

      setFlashAudioMap((prev) => ({
        ...prev,
        [msgId]: {
          loading: false,
          audioUrl: data.audioUrl,
          durationSeconds: data.durationSeconds || 45,
          script: data.script,
        },
      }));
    } catch (err: any) {
      setFlashAudioMap((prev) => ({
        ...prev,
        [msgId]: {
          loading: false,
          error: err?.message || "Audio tayyorlashda xatolik yuz berdi.",
        },
      }));
    }
  };

  // Save message to localStorage
  const handleSaveMessage = (message: Message) => {
    try {
      const saved = JSON.parse(localStorage.getItem("talaba_saved_notes") || "[]");
      saved.push({
        id: message.id,
        text: message.text,
        savedAt: new Date().toISOString(),
        mode: message.mode || activeMode,
      });
      localStorage.setItem("talaba_saved_notes", JSON.stringify(saved));
      showToast("Xabar saqlandi! 🔖");
    } catch {
      showToast("Saqlashda xatolik yuz berdi.");
    }
  };

  // Copy text to clipboard
  const handleCopyText = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast("Nusxalandi! 📋");
    }
  };

  // Send message to AI Chat API
  async function sendMessage(textToSend: string, modeOverride?: string) {
    const currentAttachment = chatAttachment;
    const trimmed = textToSend.trim() || (currentAttachment ? `Ushbu biriktirilgan faylni tahlil qiling: ${currentAttachment.name}` : "");
    if (!trimmed || isSending) return;

    // Check if user's prompt explicitly requests internet search
    const isExplicitSearch = isExplicitSearchIntent(trimmed);

    // RULE 2: If toggle is OFF and user explicitly asks to search the internet:
    // → Do NOT send Google Search request.
    // → Do NOT let AI answer with standard fallback.
    // → Show non-blocking toast:
    //   🌐 Internetdan qidirish yopiq
    //   Iltimos, "Internetdan tekshirish"ni yoqing.
    // → Toggle stays strictly OFF (never automatically toggled ON).
    if (!webSearchEnabled && isExplicitSearch) {
      showToast("🌐 Internetdan qidirish yopiq\nIltimos, \"Internetdan tekshirish\"ni yoqing.", 3500);
      return;
    }

    // Determine whether to attach live Google Search grounding (only when toggle is ON)
    const useSearch = shouldPerformWebSearch(trimmed, webSearchEnabled);

    const currentMode = modeOverride || activeMode;
    const userMsg: Message = {
      id: makeId(),
      role: "user",
      text: trimmed,
      mode: currentMode,
      attachment: currentAttachment
        ? {
            name: currentAttachment.name,
            type: currentAttachment.type,
            size: currentAttachment.size,
          }
        : undefined,
      timestamp: Date.now(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setChatAttachment(null);
    setError("");
    setIsSending(true);
    setIsSearchingWeb(useSearch);

    try {
      const tgCtx = getTelegramContext();
      const telegramId = tgCtx.user?.id || (typeof window !== "undefined" ? localStorage.getItem("telegram_user_id") : null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (tgCtx.initData) {
        headers["x-telegram-init-data"] = tgCtx.initData;
      }

      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: nextMessages.map(({ role, text }) => ({ role, text })),
          mode: currentMode,
          webSearch: useSearch,
          telegram_id: telegramId ? Number(telegramId) : undefined,
          init_data: tgCtx.initData || undefined,
          attachment: currentAttachment
            ? {
                name: currentAttachment.name,
                mimeType: currentAttachment.type,
                data: currentAttachment.base64,
              }
            : undefined,
        }),
      });

      const body = await response.json();
      if (!response.ok || !body.text) {
        const errorMsg = body.message || body.error || (useSearch ? "⚠️ Internet qidiruvida vaqtinchalik xatolik yuz berdi. Keyinroq qayta urinib ko‘ring." : "AI javob bera olmadi.");
        throw new Error(errorMsg);
      }

      const assistantMsg: Message = {
        id: makeId(),
        role: "assistant",
        text: body.text,
        mode: currentMode,
        sources: body.sources,
        searchNotice: body.searchNotice,
        timestamp: Date.now(),
      };

      setMessages([...nextMessages, assistantMsg]);
    } catch (err: any) {
      const displayMsg = err?.message || (useSearch ? "⚠️ Internet qidiruvida vaqtinchalik xatolik yuz berdi. Keyinroq qayta urinib ko‘ring." : "Xabar yuborilmadi. Qayta urinib ko'ring.");
      setError(displayMsg);
      showToast(displayMsg, 4000);
    } finally {
      setIsSending(false);
      setIsSearchingWeb(false);
    }
  }

  // Retry last message
  const handleRetry = () => {
    if (messages.length === 0 || isSending) return;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      sendMessage(lastUserMessage.text);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() || chatAttachment) {
      sendMessage(input);
    }
  };

  // ── Dedicated Chat Attachment Handlers (Independent from Meni Tekshir) ──
  const handleAttachment = () => {
    chatAttachmentInputRef.current?.click();
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Faqat PDF, PNG, JPG yoki JPEG formatidagi fayllar qabul qilinadi.");
      e.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("Fayl hajmi 10 MB dan oshmasligi kerak.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setChatAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        base64,
      });
      showToast(`📎 Fayl biriktirildi: ${file.name}`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeChatAttachment = () => {
    setChatAttachment(null);
  };

  // ── Dedicated Quick Action Handlers ──
  const handleTeach = () => {
    setActiveMode("socratic");
    showToast("🎓 Sokratik O'qituvchi rejimi yoqildi");
    const teachPrompt = "Men bilan Sokratik usulda yangi mavzu o'rganamiz. Menga savollar berib, bosqichma-bosqich yo'naltiring. Qaysi mavzudan boshlaymiz?";
    sendMessage(teachPrompt, "socratic");
  };

  const handleCheck = () => {
    setShowCheckModal(true);
  };

  const handleSpeaking = () => {
    setActiveMode("ielts");
    showToast("🇬🇧 IELTS Speaking mashg'uloti yoqildi");
    const prompt = "Salom! IELTS Speaking bo'yicha mashq qilamiz. Qaysi mavzuda suhbatlashamiz?";
    sendMessage(prompt, "ielts");
  };

  const handleInterview = () => {
    setActiveMode("interview");
    showToast("💼 Interview tayyorgarligi yoqildi");
    const prompt = "Karyera va interviewga tayyorlanamiz. Qaysi lavozim yoki grant uchun tayyorgarlik ko'rmoqchisiz?";
    sendMessage(prompt, "interview");
  };

  const handleResearch = () => {
    setActiveMode("research");
    showToast("🌐 Chuqur tadqiqot rejimi yoqildi");
    const prompt = "Ilmiy tadqiqot yoki dars mavzusi bo'yicha qanday masalani chuqur tahlil qilamiz?";
    sendMessage(prompt, "research");
  };

  // Quick Prompt chip click
  const handleQuickPrompt = (prompt: { label: string; text: string }) => {
    if (prompt.text.endsWith(": ") || prompt.text.endsWith("\n\n")) {
      setInput(prompt.text);
    } else {
      sendMessage(prompt.text);
    }
  };

  // Switch to Socratic mode from response action preserving conversation context
  const handleTeachMeThis = (contextText: string) => {
    setActiveMode("socratic");
    showToast("🎓 Sokratik O'qituvchi rejimi yoqildi");
    const teachPrompt = `Menga aynan shu tushuntirilgan mavzuni yaxshiroq anglashim uchun Sokratik usulda o'rgat. Tayyor javob berma, yo'naltiruvchi savollar orqali bosqichma-bosqich yetakla.`;
    sendMessage(teachPrompt, "socratic");
  };

  // ── "Meni Tekshir" Logic ──

  const handleGenerateQuestions = async () => {
    if (!checkSubject.trim() || !checkTopic.trim()) {
      showToast("Fan va mavzuni kiriting.");
      return;
    }

    setCheckLoading(true);
    setCheckQuestions([]);
    setUserAnswers({});
    setCheckEvaluation(null);

    try {
      const telegramId = localStorage.getItem("telegram_user_id");
      const res = await fetch("/api/ai-chat/check-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_questions",
          subject: checkSubject,
          topic: checkTopic,
          difficulty: checkDifficulty,
          count: checkCount,
          telegram_id: telegramId ? Number(telegramId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Savollarni tuzishda xatolik yuz berdi.");
      }
      setCheckQuestions(data.data.questions || []);
    } catch (err: any) {
      showToast(err.message || "Xatolik yuz berdi.");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleEvaluateAnswers = async () => {
    if (Object.keys(userAnswers).length === 0) {
      showToast("Iltimos, kamida bitta savolga javob tanlang.");
      return;
    }

    setCheckLoading(true);
    try {
      const telegramId = localStorage.getItem("telegram_user_id");
      const res = await fetch("/api/ai-chat/check-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate_answers",
          subject: checkSubject,
          topic: checkTopic,
          questions: checkQuestions,
          userAnswers,
          telegram_id: telegramId ? Number(telegramId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Natijani hisoblashda xatolik yuz berdi.");
      }
      setCheckEvaluation(data.evaluation);
    } catch (err: any) {
      showToast(err.message || "Xatolik yuz berdi.");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleFileUploadAndCheck = async () => {
    if (!uploadedFile) {
      showToast("Iltimos, PDF yoki rasm faylini tanlang.");
      return;
    }

    setCheckLoading(true);
    try {
      const telegramId = localStorage.getItem("telegram_user_id");
      const formData = new FormData();
      formData.append("file", uploadedFile);
      if (fileAnswersText.trim()) {
        formData.append("userAnswers", fileAnswersText.trim());
      }
      if (telegramId) {
        formData.append("telegram_id", telegramId);
      }

      const res = await fetch("/api/ai-chat/check-material", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Faylni tahlil qilishda xatolik yuz berdi.");
      }

      const fileReportMsg: Message = {
        id: makeId(),
        role: "assistant",
        text: `📄 **${uploadedFile.name}** tahlili va tekshiruv natijasi:\n\n${data.result}`,
        mode: "general",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, fileReportMsg]);
      setShowCheckModal(false);
      setUploadedFile(null);
      setFileAnswersText("");
      showToast("Material muvaffaqiyatli tekshirildi! Natija chatga qo'shildi.");
    } catch (err: any) {
      showToast(err.message || "Fayl tekshirishda xatolik yuz berdi.");
    } finally {
      setCheckLoading(false);
    }
  };

  const sendTestResultToChat = () => {
    if (!checkEvaluation) return;
    const summaryText = `🧠 **"Meni tekshir" natijasi** (${checkSubject} — ${checkTopic}):
• Natija: **${checkEvaluation.scorePercent}%** (${checkEvaluation.grade})
• To'g'ri javoblar: ${checkEvaluation.correctCount} / ${checkEvaluation.totalQuestions}
• Zaif mavzular: ${checkEvaluation.weakTopics?.join(", ") || "Yo'q"}
• Tavsiya: ${checkEvaluation.recommendation}`;

    sendMessage(summaryText);
    setShowCheckModal(false);
    setCheckEvaluation(null);
    setCheckQuestions([]);
  };

  const isInnerView = showCheckModal || showLiveModal || activeMode !== "general" || messages.length > 0;

  return (
    <main className="min-h-screen bg-[#0f1724] text-slate-100 flex flex-col justify-between">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#121c29]/95 border border-cyan-400/50 text-cyan-200 font-bold px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md text-xs sm:text-sm flex items-center justify-center gap-2 pointer-events-none transition-all duration-300 animate-in fade-in max-w-[90vw] text-center whitespace-pre-line leading-relaxed">
          {toastMessage}
        </div>
      )}

      {/* Main Container */}
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-3 py-2 sm:px-4 sm:py-3">
        {/* Header */}
        <header className="mb-2 flex items-center justify-between rounded-xl border border-cyan-500/15 bg-[#16202d]/90 backdrop-blur-md px-3.5 py-2 shadow-md">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBackNavigation}
              aria-label={isInnerView ? "AI Chatga qaytish" : "Bosh sahifaga qaytish"}
              className="flex h-8 items-center gap-1.5 px-2.5 rounded-lg bg-slate-800/80 text-cyan-400 hover:bg-cyan-500/20 border border-slate-700/50 transition active:scale-95 text-xs font-bold shrink-0"
            >
              <span>←</span>
              <span>{isInnerView ? "AI Chat" : "Asosiy"}</span>
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white">Talaba AI</h1>
                <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.2 text-[10px] font-bold text-cyan-300 border border-cyan-400/20">
                  {activeMode === "socratic"
                    ? "🎓 Sokratik"
                    : activeMode === "ielts"
                    ? "🇬🇧 Speaking"
                    : activeMode === "interview"
                    ? "💼 Interview"
                    : activeMode === "research"
                    ? "🌐 Tadqiqot"
                    : "AI O‘quv Mentor"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                {activeMode === "socratic"
                  ? "Sokratik savol-javob o‘qituvchisi"
                  : activeMode === "ielts"
                  ? "IELTS Speaking mashg‘uloti"
                  : activeMode === "interview"
                  ? "Ish va grant suhbati tayyorgarligi"
                  : activeMode === "research"
                  ? "Ilmiy tadqiqot va chuqur tahlil yordamchisi"
                  : "Dars, imtihon va amaliy fan yordamchisi"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
          </div>
        </header>

        {/* Active Mode Banner */}
        {activeMode !== "general" && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-300">
            <div className="flex items-center gap-2">
              <span>
                {activeMode === "socratic"
                  ? "🎓 Sokratik O'qituvchi rejimi: AI to'g'ridan-to'g'ri javob bermaydi, yo'naltiradi"
                  : activeMode === "ielts"
                  ? "🇬🇧 Speaking rejimi faol"
                  : activeMode === "interview"
                  ? "💼 Interview Coach rejimi faol"
                  : activeMode === "research"
                  ? "🌐 Chuqur tadqiqot rejimi faol"
                  : "Maxsus rejim"}
              </span>
            </div>
            <button
              onClick={() => setActiveMode("general")}
              className="rounded-lg bg-slate-800/80 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition active:scale-95"
            >
              ✕ Standartga qaytish
            </button>
          </div>
        )}

        {/* Live Voice Card */}
        {messages.length === 0 && (
          <LiveCard
            onStartLive={() => setShowLiveModal(true)}
            personaName={livePersona}
            isLiveActive={showLiveModal}
            remainingSeconds={liveRemainingSeconds}
            liveLimitMinutes={liveLimitMinutes}
          />
        )}

        {/* Chat Body */}
        <div
          ref={scrollRef}
          className="flex min-h-[45vh] flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-cyan-500/10 bg-[#141d2a]/80 p-2.5 sm:p-4 shadow-inner"
        >
          {/* EMPTY STATE */}
          {messages.length === 0 ? (
            <div className="my-auto flex flex-col items-center text-center py-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-sky-400/10 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.12)] text-2xl">
                🎓
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mb-0.5">
                👋 Bugun nimada yordam beray?
              </h2>
              <p className="max-w-md text-xs text-slate-400 mb-3">
                Talaba AI sizning shaxsiy o‘quv mentoringiz. Yangi mavzuni tushunish, bilimlarni tekshirish yoki imtihonga tayyorlanish uchun tanlang:
              </p>

              {/* Dedicated Quick Actions Grid */}
              <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-left">
                {/* 1. Menga o'rgat -> Socratic Mode ONLY */}
                <button
                  type="button"
                  onClick={handleTeach}
                  className="group relative flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#1a2536]/80 p-2.5 hover:border-cyan-500/40 hover:bg-[#1f2d42] transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-cyan-500/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-lg border border-cyan-500/20 group-hover:scale-105 transition-transform">
                    🎓
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-100 group-hover:text-cyan-300 transition-colors">
                      Menga o‘rgat
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      Sokratik usulda, bosqichma-bosqich tushuntirish
                    </p>
                  </div>
                </button>

                {/* 2. Meni tekshir -> Test / File Modal ONLY */}
                <button
                  type="button"
                  onClick={handleCheck}
                  className="group relative flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#1a2536]/80 p-2.5 hover:border-cyan-500/40 hover:bg-[#1f2d42] transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-cyan-500/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-lg border border-purple-500/20 group-hover:scale-105 transition-transform">
                    🧠
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-100 group-hover:text-purple-300 transition-colors">
                      Meni tekshir
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      AI test yoki PDF/rasm orqali bilimlarni sinash
                    </p>
                  </div>
                </button>

                {/* 3. Speaking -> IELTS Speaking Coach */}
                <button
                  type="button"
                  onClick={handleSpeaking}
                  className="group relative flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#1a2536]/80 p-2.5 hover:border-cyan-500/40 hover:bg-[#1f2d42] transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-cyan-500/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-lg border border-emerald-500/20 group-hover:scale-105 transition-transform">
                    🇬🇧
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-100 group-hover:text-emerald-300 transition-colors">
                      Speaking
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      IELTS va erkin ingliz tili suhbati
                    </p>
                  </div>
                </button>

                {/* 4. Interview -> Career Coach */}
                <button
                  type="button"
                  onClick={handleInterview}
                  className="group relative flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#1a2536]/80 p-2.5 hover:border-cyan-500/40 hover:bg-[#1f2d42] transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-cyan-500/5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-lg border border-amber-500/20 group-hover:scale-105 transition-transform">
                    💼
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-100 group-hover:text-amber-300 transition-colors">
                      Interview
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      Ish, grant yoki amaliyot suhbatiga tayyorgarlik
                    </p>
                  </div>
                </button>

                {/* 5. Tadqiqot -> Academic Research */}
                <button
                  type="button"
                  onClick={handleResearch}
                  className="group relative flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#1a2536]/80 p-2.5 hover:border-cyan-500/40 hover:bg-[#1f2d42] transition-all duration-200 active:scale-[0.98] shadow-sm hover:shadow-cyan-500/5 sm:col-span-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-lg border border-blue-500/20 group-hover:scale-105 transition-transform">
                    🌐
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-100 group-hover:text-blue-300 transition-colors">
                      Tadqiqot
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      Ilmiy mavzular va chuqur tahlil
                    </p>
                  </div>
                </button>
              </div>

              {/* Quick Prompts Label */}
              <div className="w-full text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5 px-1">
                  Tezkor so‘rovlar:
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition active:scale-95"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* CONVERSATION VIEW */
            <div className="flex flex-col gap-3">
              {messages.map((message) => {
                const isUser = message.role === "user";
                const flashAudio = flashAudioMap[message.id];

                return (
                  <div
                    key={message.id}
                    className={`flex flex-col max-w-[95%] sm:max-w-[88%] ${
                      isUser ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    {/* Role Label */}
                    <span className="text-[11px] font-semibold text-slate-400 mb-1 px-1">
                      {isUser ? "Siz" : "Talaba AI Mentor"}
                    </span>

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? "bg-gradient-to-br from-cyan-500 to-sky-600 text-slate-950 font-medium shadow-md shadow-cyan-500/20 rounded-tr-sm"
                          : "bg-[#1c293a] border border-cyan-500/15 text-slate-100 shadow-md rounded-tl-sm w-full"
                      }`}
                    >
                      {/* Attached File Indicator */}
                      {message.attachment && (
                        <div className={`mb-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs ${
                          isUser
                            ? "bg-black/20 border border-black/15 text-slate-950 font-bold"
                            : "bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 font-semibold"
                        }`}>
                          <span>📎</span>
                          <span className="truncate max-w-[200px]">{message.attachment.name}</span>
                          <span className="text-[10px] opacity-80">({(message.attachment.size / 1024).toFixed(0)} KB)</span>
                        </div>
                      )}

                      <FormattedMessageText text={message.text} />

                      {/* Google Search Grounding Notice or Sources */}
                      {message.searchNotice && (
                        <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                          ℹ️ {message.searchNotice}
                        </div>
                      )}

                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-700/60 text-xs">
                          <span className="font-bold text-cyan-300 flex items-center gap-1 mb-1">
                            🔗 Haqiqiy internet manbalari:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {message.sources.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-800/90 border border-slate-700 px-2 py-0.5 text-[10px] text-cyan-200 hover:text-white hover:border-cyan-400 transition"
                              >
                                <span className="truncate max-w-[180px]">{src.title}</span>
                                <span className="text-[9px] text-slate-400">↗</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Flash Review Player inline */}
                      {flashAudio?.loading && (
                        <div className="mt-2 flex items-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-xs text-cyan-300">
                          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                          <span>40-60 soniyalik Flash Review audio generatsiya qilinmoqda...</span>
                        </div>
                      )}

                      {flashAudio?.error && (
                        <div className="mt-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-300">
                          {flashAudio.error}
                        </div>
                      )}

                      {flashAudio?.audioUrl && (
                        <FlashAudioPlayer
                          audioUrl={flashAudio.audioUrl}
                          durationSeconds={flashAudio.durationSeconds || 45}
                          script={flashAudio.script}
                          onClose={() => {
                            setFlashAudioMap((prev) => {
                              const next = { ...prev };
                              delete next[message.id];
                              return next;
                            });
                          }}
                        />
                      )}
                    </div>

                    {/* Assistant Context-Aware Actions */}
                    {!isUser && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1">
                        <button
                          onClick={() => handleTeachMeThis(message.text)}
                          className="rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20 transition active:scale-95 flex items-center gap-1"
                        >
                          🎓 Menga o‘rgat
                        </button>
                        <button
                          onClick={() => handleFlashReview(message)}
                          className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition active:scale-95 flex items-center gap-1 ${
                            flashAudio?.audioUrl
                              ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                              : flashReviewUsed >= flashReviewLimit
                              ? "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-amber-300"
                              : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          🔊 Flash Review {flashReviewLimit ? `(${flashReviewUsed}/${flashReviewLimit})` : ""}
                        </button>
                        <button
                          onClick={() => handleSaveMessage(message)}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition active:scale-95 flex items-center gap-1"
                        >
                          🔖 Saqlash
                        </button>
                        <button
                          onClick={() => handleCopyText(message.text)}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition active:scale-95 flex items-center gap-1"
                        >
                          📋 Nusxalash
                        </button>
                        <button
                          onClick={handleRetry}
                          className="rounded-lg bg-slate-800/80 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition active:scale-95 flex items-center gap-1"
                          title="Qayta generatsiya qilish"
                        >
                          🔄 Qayta urinish
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="self-start rounded-2xl bg-[#1c293a] border border-cyan-500/20 px-3.5 py-2 text-xs sm:text-sm text-cyan-300 flex items-center gap-2 shadow-md">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>
                    {isSearchingWeb
                      ? "🔎 Internetdan ma'lumot qidirilmoqda..."
                      : "Talaba AI o‘ylamoqda..."}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-rose-400 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Horizontal Quick Prompts Bar (when chat is active) */}
        {messages.length > 0 && (
          <div className="my-1.5 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickPrompt(prompt)}
                className="shrink-0 rounded-full border border-slate-800 bg-[#16202d] px-2.5 py-0.5 text-[10px] font-medium text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300 transition active:scale-95"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        )}

        {/* Modern Input Panel with Web Search Toggle */}
        <footer className="mt-1.5 rounded-xl border border-cyan-500/20 bg-[#16202d] p-1.5 sm:p-2 shadow-lg">
          {/* Top toolbar inside input panel: Web Search toggle */}
          <div className="flex items-center justify-between pb-1.5 px-1 border-b border-slate-800/80 mb-1.5">
            <button
              type="button"
              onClick={() => {
                const next = !webSearchEnabled;
                setWebSearchEnabled(next);
                showToast(next ? "🌐 Internetdan qidirish yoqildi" : "🌐 Internetdan qidirish o‘chirildi");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-bold transition active:scale-95 border ${
                webSearchEnabled
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>🌐</span>
              <span>Internetdan tekshirish</span>
              <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded ${webSearchEnabled ? "bg-cyan-400 text-slate-950" : "bg-slate-700 text-slate-300"}`}>
                {webSearchEnabled ? "ON" : "OFF"}
              </span>
            </button>

            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Enter — yuborish, Shift+Enter — yangi qator
            </span>
          </div>

          {/* Chat Attachment Preview Chip */}
          {chatAttachment && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-300">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">📎</span>
                <div className="truncate">
                  <span className="font-bold text-white truncate block">{chatAttachment.name}</span>
                  <span className="text-[10px] text-cyan-400">{(chatAttachment.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              <button
                type="button"
                onClick={removeChatAttachment}
                title="Faylni olib tashlash"
                className="rounded-lg p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 text-xs font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="flex items-end gap-1.5">
            {/* Native Hidden File Input for Chat Attachment */}
            <input
              ref={chatAttachmentInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleAttachmentChange}
              className="hidden"
            />

            {/* Chat Attachment Button */}
            <button
              type="button"
              onClick={handleAttachment}
              title="Fayl biriktirish (PDF, PNG, JPG)"
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg transition active:scale-95 border text-sm ${
                chatAttachment
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-slate-700"
              }`}
            >
              📎
            </button>

            {/* Voice Note Button */}
            <button
              type="button"
              onClick={toggleVoiceNote}
              title={isListening ? "Yozishni to'xtatish" : "Ovozli xabar yozish"}
              className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg transition active:scale-95 border text-sm ${
                isListening
                  ? "bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse shadow-md shadow-rose-500/20"
                  : "bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-cyan-300 hover:bg-slate-700"
              }`}
            >
              🎤
            </button>

            {/* Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                isListening
                  ? "Tinglayapman, gapiring..."
                  : activeMode === "socratic"
                  ? "Savol yoki fikringizni yozing (Sokratik)..."
                  : webSearchEnabled
                  ? "Internetdan qidirish uchun savol yozing (masalan: 2026 stipendiya)..."
                  : "Savol, mavzu yoki topshiriqni yozing..."
              }
              rows={1}
              maxLength={6000}
              className="max-h-28 min-h-9 sm:min-h-10 flex-1 resize-none rounded-lg bg-[#101722] px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-cyan-400 border border-slate-800/80 transition"
            />

            {/* Send Button with Icon */}
            <button
              type="submit"
              disabled={(!input.trim() && !chatAttachment) || isSending}
              aria-label="Xabar yuborish"
              className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-400 to-sky-500 text-slate-950 transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 shadow-md shadow-cyan-500/20"
            >
              <svg
                className="h-4 w-4 fill-current translate-x-0.5"
                viewBox="0 0 24 24"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </footer>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* "MENI TEKSHIR" MODAL (AI o'zi tekshiradi & PDF/Rasm yuklash) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showCheckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-3xl border border-cyan-500/25 bg-[#121b27] p-5 sm:p-6 shadow-2xl my-auto">
            {/* Close Modal */}
            <button
              onClick={() => {
                setShowCheckModal(false);
                setCheckEvaluation(null);
                setCheckQuestions([]);
              }}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            >
              ✕
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-xl">
                🧠
              </span>
              <div>
                <h3 className="text-lg font-black text-white">Meni tekshir</h3>
                <p className="text-xs text-slate-400">Bilimingizni sinash va mustahkamlash</p>
              </div>
            </div>

            {/* Tab Selection */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#0b111a] p-1 mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCheckTab("ai_generate");
                  setCheckEvaluation(null);
                }}
                className={`rounded-xl py-2 text-xs sm:text-sm font-bold transition ${
                  checkTab === "ai_generate"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🤖 AI o‘zi tekshirsin
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckTab("file_upload");
                  setCheckEvaluation(null);
                }}
                className={`rounded-xl py-2 text-xs sm:text-sm font-bold transition ${
                  checkTab === "file_upload"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                📄 Fayl / Surat yuklash
              </button>
            </div>

            {/* TAB A: AI O'ZI TEKSHIRSIN */}
            {checkTab === "ai_generate" && (
              <div>
                {!checkEvaluation && checkQuestions.length === 0 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Fan:</label>
                      <input
                        type="text"
                        value={checkSubject}
                        onChange={(e) => setCheckSubject(e.target.value)}
                        placeholder="Masalan: Fizika, Ingliz tili, Tarix..."
                        className="w-full rounded-xl bg-[#192433] border border-slate-700 px-3.5 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Mavzu:</label>
                      <input
                        type="text"
                        value={checkTopic}
                        onChange={(e) => setCheckTopic(e.target.value)}
                        placeholder="Masalan: Nyuton qonunlari, Present Perfect..."
                        className="w-full rounded-xl bg-[#192433] border border-slate-700 px-3.5 py-2 text-sm text-white outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Qiyinlik darajasi:</label>
                        <select
                          value={checkDifficulty}
                          onChange={(e) => setCheckDifficulty(e.target.value)}
                          className="w-full rounded-xl bg-[#192433] border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                        >
                          <option value="Oson">Oson</option>
                          <option value="O'rta">O‘rta</option>
                          <option value="Qiyin">Qiyin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Savollar soni:</label>
                        <select
                          value={checkCount}
                          onChange={(e) => setCheckCount(Number(e.target.value))}
                          className="w-full rounded-xl bg-[#192433] border border-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                        >
                          <option value={5}>5 ta savol</option>
                          <option value={10}>10 ta savol</option>
                          <option value={15}>15 ta savol</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={checkLoading}
                      onClick={handleGenerateQuestions}
                      className="w-full mt-4 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3 text-sm font-black text-slate-950 transition active:scale-95 disabled:opacity-40 shadow-lg shadow-cyan-500/20"
                    >
                      {checkLoading ? "Savollar tuzilmoqda..." : "🚀 Testni boshlash"}
                    </button>
                  </div>
                )}

                {/* QUESTIONS LIST */}
                {!checkEvaluation && checkQuestions.length > 0 && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-cyan-400">{checkSubject} — {checkTopic}</span>
                      <span className="text-xs text-slate-400">{checkQuestions.length} ta savol</span>
                    </div>

                    {checkQuestions.map((q, idx) => (
                      <div key={q.id || idx} className="rounded-2xl border border-slate-800 bg-[#172230] p-3.5">
                        <p className="font-bold text-sm text-slate-100 mb-2.5">
                          {idx + 1}. {q.question}
                        </p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {q.options?.map((opt: string, optIdx: number) => {
                            const optLetter = opt.charAt(0).toUpperCase();
                            const isSelected = userAnswers[q.id] === optLetter;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => setUserAnswers({ ...userAnswers, [q.id]: optLetter })}
                                className={`text-left rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition border ${
                                  isSelected
                                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                                    : "bg-[#111924] border-slate-800 text-slate-300 hover:bg-[#1a2636]"
                                }`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      disabled={checkLoading}
                      onClick={handleEvaluateAnswers}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-3 text-sm font-black text-slate-950 transition active:scale-95 disabled:opacity-40 shadow-lg shadow-emerald-500/20"
                    >
                      {checkLoading ? "Tekshirilmoqda..." : "✅ Javoblarni tekshirish"}
                    </button>
                  </div>
                )}

                {/* EVALUATION RESULT */}
                {checkEvaluation && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="rounded-2xl bg-gradient-to-tr from-cyan-500/15 to-emerald-500/15 border border-cyan-500/30 p-4 text-center">
                      <span className="text-3xl font-black text-cyan-300 block mb-1">
                        {checkEvaluation.scorePercent}%
                      </span>
                      <p className="text-sm font-bold text-white">
                        {checkEvaluation.grade} — {checkEvaluation.correctCount} ta to‘g‘ri, {checkEvaluation.wrongCount} ta xato
                      </p>
                    </div>

                    {/* Weak topics */}
                    {checkEvaluation.weakTopics?.length > 0 && (
                      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wide block mb-1">
                          ⚠️ Takrorlash kerak bo‘lgan mavzular:
                        </span>
                        <ul className="list-disc list-inside text-xs text-amber-100 space-y-0.5">
                          {checkEvaluation.weakTopics.map((topic: string, i: number) => (
                            <li key={i}>{topic}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Mistakes List */}
                    {checkEvaluation.mistakes?.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">
                          Xatolar tahlili:
                        </span>
                        {checkEvaluation.mistakes.map((m: any, idx: number) => (
                          <div key={idx} className="rounded-xl bg-[#172230] border border-rose-500/20 p-3 text-xs">
                            <p className="font-bold text-slate-200 mb-1">{m.question}</p>
                            <p className="text-rose-300">Sizning javobingiz: {m.userAnswer}</p>
                            <p className="text-emerald-300 font-semibold">To‘g‘ri javob: {m.correctAnswer}</p>
                            <p className="text-slate-400 mt-1 italic">{m.explanation}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommendations */}
                    {checkEvaluation.recommendation && (
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-slate-300">
                        <strong className="text-cyan-300 block mb-1">💡 Murabbiy tavsiyasi:</strong>
                        {checkEvaluation.recommendation}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={sendTestResultToChat}
                        className="flex-1 rounded-xl bg-cyan-400 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300 transition"
                      >
                        💬 Chatga yuborish
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckEvaluation(null);
                          setCheckQuestions([]);
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                      >
                        Qayta boshlash
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB B: PDF / RASM YUKLASH */}
            {checkTab === "file_upload" && (
              <div className="space-y-3">
                <input
                  ref={checkFileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => checkFileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-500/30 bg-[#16202d]/80 p-6 text-center cursor-pointer hover:border-cyan-400 transition"
                >
                  <span className="text-3xl mb-2">📁</span>
                  <p className="font-bold text-sm text-slate-100">
                    {uploadedFile ? uploadedFile.name : "PDF yoki rasmni tanlang"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Qabul qilinadi: PDF, PNG, JPG, JPEG (Maks. 20MB)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    O‘z javoblaringiz yoki savolingiz (ixtiyoriy):
                  </label>
                  <textarea
                    value={fileAnswersText}
                    onChange={(e) => setFileAnswersText(e.target.value)}
                    placeholder="Masalan: 1-savolga A dedim, 2-savolga 42 deb yechdim. Tekshirib bering..."
                    rows={3}
                    className="w-full rounded-xl bg-[#192433] border border-slate-700 p-3 text-xs text-white outline-none focus:border-cyan-400 resize-none"
                  />
                </div>

                <button
                  type="button"
                  disabled={!uploadedFile || checkLoading}
                  onClick={handleFileUploadAndCheck}
                  className="w-full mt-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3 text-sm font-black text-slate-950 transition active:scale-95 disabled:opacity-40 shadow-lg shadow-cyan-500/20"
                >
                  {checkLoading ? "Fayl o‘rganilmoqda..." : "🔍 Materialni tekshirish"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* GEMINI LIVE VOICE ROOM MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      <LiveRoomModal
        isOpen={showLiveModal}
        initialRemainingSeconds={liveRemainingSeconds}
        onSessionComplete={(newSec) => {
          if (newSec !== undefined) {
            setLiveRemainingSeconds(newSec);
          }
        }}
        onClose={() => {
          setShowLiveModal(false);
          try {
            const savedPersona = localStorage.getItem("talaba_live_persona");
            if (savedPersona === "zilola" || savedPersona === "olim") {
              setLivePersona(savedPersona);
            }
          } catch {
            // Ignore
          }
        }}
      />
    </main>
  );
}
