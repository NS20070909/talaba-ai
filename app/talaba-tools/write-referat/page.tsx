"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECTS = [
  { id: "cs",          name: "Kiberxavfsizlik" },
  { id: "history",     name: "O'zbekiston tarixi" },
  { id: "econ",        name: "Iqtisodiyot nazariyasi" },
  { id: "math",        name: "Oliy matematika" },
  { id: "philosophy",  name: "Falsafa" },
  { id: "ecology",     name: "Ekologiya" },
  { id: "custom",      name: "Boshqa (O'zingiz yozasiz)" },
];

// Stage labels shown to user during DOCX generation
const DOCX_STAGES = [
  "Tayyorlanmoqda...",
  "Mundarija yaratilmoqda...",
  "Kirish yozilmoqda...",
  "1-bob yozilmoqda...",
  "2-bob yozilmoqda...",
  "3-bob yozilmoqda...",
  "Xulosa yozilmoqda...",
  "DOCX formatlanmoqda...",
  "Tayyor! ✅",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getLimitsForPlan = (plan: string) => {
  switch (plan) {
    case "FREE":                   return { name: "FREE",    min: 3, max: 7 };
    case "DAY":   case "STARTER":  return { name: "STARTER", min: 5, max: 10 };
    case "WEEK":  case "STUDENT":  return { name: "STUDENT", min: 5, max: 15 };
    case "MONTH": case "QUARTER": case "PRO": return { name: "PRO", min: 5, max: 30 };
    case "YEAR":  case "PREMIUM": case "ELITE": return { name: "PREMIUM", min: 5, max: 50 };
    default:                       return { name: "FREE",    min: 3, max: 7 };
  }
};

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("limit") || msg.includes("tugagan"))
    return "Bugungi referat limitingiz tugagan. Ertaga yana urinib ko'ring yoki tarifni yangilang.";
  if (msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted"))
    return "AI xizmati vaqtincha band. Bir necha daqiqadan so'ng qayta urinib ko'ring.";
  if (msg.includes("timeout") || msg.includes("etimedout") || msg.includes("fetch failed"))
    return "So'rov vaqti tugadi. Internet aloqangizni tekshirib, qayta urinib ko'ring.";
  if (msg.includes("bloklangan") || msg.includes("403"))
    return "Kirish rad etildi. Iltimos admin bilan bog'laning.";
  if (msg.includes("generatsiyasi muvaffaqiyatsiz"))
    return "Referat yaratishda xatolik yuz berdi. Qayta urinib ko'ring.";
  if (msg.includes("topic is required") || msg.includes("mavzu"))
    return "Referat mavzusini kiriting.";
  if (msg.includes("server configuration"))
    return "Server xatosi yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.";
  return raw || "Noma'lum xato yuz berdi. Qayta urinib ko'ring.";
}

/**
 * Safe JSON parser — checks response.ok and Content-Type before calling .json().
 * Prevents the "Unexpected token 'A'" crash when the server returns HTML/plain-text.
 * Returns { ok: false, error: string } on any problem, or { ok: true, data: T }.
 */
async function safeJson<T = any>(res: Response): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!res.ok) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        const d = await res.json();
        return { ok: false, error: d?.error || d?.message || `Server xatosi (${res.status})` };
      } catch { /* fall through */ }
    }
    const text = await res.text().catch(() => "");
    return { ok: false, error: text ? friendlyError(text) : `Server xatosi (${res.status})` };
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text ? friendlyError(text) : "Server javobi JSON formatida emas. AI server vaqtida javob bermadi." };
  }
  try {
    const data = await res.json() as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Server javobi JSON formatida emas." };
  }
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} soniya`;
  return `${Math.floor(s / 60)} daq ${s % 60} son`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutlineResult {
  title: string;
  outline: string[];
  model: string;
}

type PackStep = "idle" | "running" | "done" | "error";

// ─── Component ───────────────────────────────────────────────────────────────

const UNIVERSITIES = [
  { id: "TATU",  name: "Muhammad al-Xorazmiy nomidagi Toshkent axborot texnologiyalari universiteti" },
  { id: "SamDU", name: "Samarqand davlat universiteti" },
  { id: "TDTU",  name: "Islom Karimov nomidagi Toshkent davlat texnika universiteti" },
  { id: "TDIU",  name: "Toshkent davlat iqtisodiyot universiteti" },
  { id: "custom", name: "Boshqa (O'zingiz kiritasiz)" },
];

export default function WriteReferatPage() {
  // Form
  const [topic,           setTopic]           = useState("");
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0].id);
  const [customSubject,   setCustomSubject]   = useState("");
  const [language,        setLanguage]        = useState("uz");
  const [userPlan,        setUserPlan]        = useState("FREE");
  const [pagesVal,        setPagesVal]        = useState("3");
  const [includeImages,   setIncludeImages]   = useState(true);
  const [citationStyle,   setCitationStyle]   = useState("oddiy");
  const pagesCount = parseInt(pagesVal, 10) || 0;

  // Cover Page form states
  const [university,        setUniversity]        = useState(UNIVERSITIES[0].id);
  const [customUniv,         setCustomUniv]         = useState("");
  const [faculty,            setFaculty]            = useState("");
  const [department,         setDepartment]         = useState("");
  const [groupVal,           setGroupVal]           = useState("");
  const [studentName,        setStudentName]        = useState("");
  const [teacherName,        setTeacherName]        = useState("");
  const [city,               setCity]               = useState("Toshkent");
  const [showCoverFields,    setShowCoverFields]    = useState(false);

  // Load saved cover page fields from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("referat_cover_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.university) setUniversity(parsed.university);
        if (parsed.customUniv) setCustomUniv(parsed.customUniv);
        if (parsed.faculty) setFaculty(parsed.faculty);
        if (parsed.department) setDepartment(parsed.department);
        if (parsed.groupVal) setGroupVal(parsed.groupVal);
        if (parsed.studentName) setStudentName(parsed.studentName);
        if (parsed.teacherName) setTeacherName(parsed.teacherName);
        if (parsed.city) setCity(parsed.city);
      }
    } catch (e) {
      // Fail silently
    }
  }, []);

  // Save cover page fields to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        "referat_cover_data",
        JSON.stringify({
          university,
          customUniv,
          faculty,
          department,
          groupVal,
          studentName,
          teacherName,
          city,
        })
      );
    } catch (e) {
      // Fail silently
    }
  }, [university, customUniv, faculty, department, groupVal, studentName, teacherName, city]);

  // Outline phase
  const [loading,        setLoading]        = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showOutline,    setShowOutline]    = useState(false);
  const [result,         setResult]         = useState<OutlineResult | null>(null);

  // Editable outline (seeded from result.outline; user can modify before generating)
  const [editableOutline, setEditableOutline] = useState<string[]>([]);
  const [editingIdx,      setEditingIdx]      = useState<number | null>(null);
  const [editingText,     setEditingText]     = useState("");
  const [newItemText,     setNewItemText]     = useState("");

  // DOCX generation phase
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [docxStageIdx,   setDocxStageIdx]   = useState(0);
  const docxStageTimer   = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cached DOCX blob — reused for both download and Telegram send to avoid double generation
  const cachedBlob = useRef<Blob | null>(null);

  // Success state
  const [docxReady,      setDocxReady]      = useState(false);
  const [generationTime, setGenerationTime] = useState(0); // elapsed ms

  // Telegram delivery
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramSent,    setTelegramSent]    = useState(false);

  // PPT Generation states
  const [generatingPPT,   setGeneratingPPT]   = useState(false);
  const [pptProgress,     setPptProgress]     = useState(0);
  const [pptReady,        setPptReady]        = useState(false);
  const [pptUrl,          setPptUrl]          = useState<string | null>(null);
  const [sendingPPTTel,   setSendingPPTTel]   = useState(false);
  const [pptTelegramSent, setPptTelegramSent] = useState(false);
  const [pptError,        setPptError]        = useState<string | null>(null);

  // Study Pack states — each is fully isolated
  const [quizLoading,    setQuizLoading]    = useState(false);
  const [quizText,       setQuizText]       = useState<string | null>(null);
  const [quizError,      setQuizError]      = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText,    setSummaryText]    = useState<string | null>(null);
  const [summaryError,   setSummaryError]   = useState<string | null>(null);
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [defenseText,    setDefenseText]    = useState<string | null>(null);
  const [defenseError,   setDefenseError]   = useState<string | null>(null);
  const [copiedKey,      setCopiedKey]      = useState<string | null>(null);

  // Teacher Check (AI Grade)
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeText,    setGradeText]    = useState<string | null>(null);
  const [gradeError,   setGradeError]   = useState<string | null>(null);

  // Academic Pack one-click
  const [packRunning, setPackRunning] = useState(false);
  const [packStatus,  setPackStatus]  = useState<Record<string, PackStep>>({});
  const [packDone,    setPackDone]    = useState(false);
  const [packActiveTab, setPackActiveTab] = useState<"ppt" | "summary" | "quiz" | "defense">("ppt");

  // Error
  const [error, setError] = useState<string | null>(null);

  // Tracks whether DOCX generation is currently running (ref so async callbacks read live value)
  const generatingDocxRef = useRef(false);

  // Guard against duplicate requests
  const inFlight = useRef(false);

  // ── Plan data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const userId = localStorage.getItem("telegram_user_id");
    if (!userId) return;
    fetch(`/api/user-stats?telegram_id=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.stats) setUserPlan(d.stats.plan || "FREE"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const limits = getLimitsForPlan(userPlan);
    setPagesVal(limits.min.toString());
  }, [userPlan]);

  const planLimits = getLimitsForPlan(userPlan);
  const isExceeded = pagesCount > planLimits.max;
  const isInvalid  = pagesCount < planLimits.min || isExceeded;

  const getSubjectName = () =>
    selectedSubject === "custom"
      ? (customSubject.trim() || "Erkin mavzu")
      : (SUBJECTS.find((s) => s.id === selectedSubject)?.name || "Erkin mavzu");

  // ── Outline editor helpers ─────────────────────────────────────────────────

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditingText(editableOutline[idx]);
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      setEditableOutline((prev) => prev.map((v, i) => (i === editingIdx ? trimmed : v)));
    }
    setEditingIdx(null);
    setEditingText("");
  };

  const deleteItem = (idx: number) => {
    setEditableOutline((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) { setEditingIdx(null); setEditingText(""); }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setEditableOutline((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    setEditableOutline((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const addItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    setEditableOutline((prev) => [...prev, trimmed]);
    setNewItemText("");
  };

  // ── DOCX stage progress timer ──────────────────────────────────────────────

  const startDocxStageTimer = useCallback(() => {
    setDocxStageIdx(0);
    let idx = 0;
    docxStageTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, DOCX_STAGES.length - 2);
      setDocxStageIdx(idx);
    }, 7000);
  }, []);

  const stopDocxStageTimer = useCallback(() => {
    if (docxStageTimer.current) {
      clearInterval(docxStageTimer.current);
      docxStageTimer.current = null;
    }
    setDocxStageIdx(DOCX_STAGES.length - 1);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (docxStageTimer.current) clearInterval(docxStageTimer.current);
  }, []);

  // ── Step 1: Outline generation ─────────────────────────────────────────────

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || inFlight.current) return;

    inFlight.current = true;
    setShowOutline(false);
    setResult(null);
    setEditableOutline([]);
    setDocxReady(false);
    setTelegramSent(false);
    cachedBlob.current = null;
    setError(null);
    setLoading(true);
    setLoadingMessage("Tayyorlanmoqda...");

    const telegramUserId = localStorage.getItem("telegram_user_id");

    try {
      setLoadingMessage("Mundarija yaratilmoqda...");

      const res = await fetch("/api/referat-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subject: getSubjectName(),
          language,
          pages: pagesCount,
          telegram_user_id: telegramUserId,
        }),
      });

      setLoadingMessage("Natija tayyorlanmoqda...");

      const parsed = await safeJson(res);
      if (!parsed.ok) throw new Error(parsed.error);
      const data = parsed.data;
      if (!data.success) throw new Error(data.error || "Serverdan xato javob keldi.");

      setResult({ title: data.title, outline: data.outline, model: data.model });
      setEditableOutline([...data.outline]);
      setShowOutline(true);

      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      setError(friendlyError(msg));
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  // ── Step 2: DOCX fetch (shared — cached after first call) ─────────────────

  const getUnivName = () =>
    university === "custom"
      ? (customUniv.trim() || "O'ZBEKISTON UNIVERSITETI")
      : (UNIVERSITIES.find((u) => u.id === university)?.name || "O'ZBEKISTON UNIVERSITETI");

  const fetchDocxBlob = async (): Promise<Blob> => {
    if (cachedBlob.current) return cachedBlob.current;

    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) throw new Error("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");

    const res = await fetch("/api/write-referat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: topic.trim(),
        subject: getSubjectName(),
        language,
        pages: pagesCount,
        outline: editableOutline,
        include_images: userPlan !== "FREE" && includeImages,
        citation_style: citationStyle,
        university: getUnivName(),
        faculty: faculty.trim(),
        department: department.trim(),
        group: groupVal.trim(),
        student_name: studentName.trim(),
        teacher_name: teacherName.trim(),
        city: city.trim() || "Toshkent",
        telegram_user_id: telegramUserId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || `Server xatosi (${res.status})`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error("Bo'sh fayl keldi. Qayta urinib ko'ring.");
    cachedBlob.current = blob;
    return blob;
  };

  // ── Step 2a: Download ──────────────────────────────────────────────────────

  const handleDownloadDocx = async () => {
    if (!result || inFlight.current) return;

    inFlight.current = true;
    generatingDocxRef.current = true;
    setGeneratingDocx(true);
    setDocxReady(false);
    setError(null);
    startDocxStageTimer();

    const t0 = Date.now();

    try {
      const blob = await fetchDocxBlob();
      stopDocxStageTimer();

      const url = window.URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `TalabaAI-Referat-${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setGenerationTime(Date.now() - t0);
      setDocxReady(true);
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      stopDocxStageTimer();
      setError(friendlyError(msg));
    } finally {
      generatingDocxRef.current = false;
      setGeneratingDocx(false);
      inFlight.current = false;
    }
  };

  // ── Step 2b: Send to Telegram ─────────────────────────────────────────────

  const handleSendTelegram = async () => {
    if (!result || inFlight.current || telegramSent) return;

    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) {
      setError("Telegram ID topilmadi. Iltimos, Telegram orqali qayta kiring.");
      return;
    }

    inFlight.current = true;
    setSendingTelegram(true);
    setError(null);

    const t0 = Date.now();

    // If blob not cached yet, show DOCX generation progress
    const needsDocxFetch = !cachedBlob.current;
    if (needsDocxFetch) {
      generatingDocxRef.current = true;
      setGeneratingDocx(true);
      startDocxStageTimer();
    }

    try {
      const blob = await fetchDocxBlob();

      if (needsDocxFetch) {
        stopDocxStageTimer();
        generatingDocxRef.current = false;
        setGeneratingDocx(false);
      }

      // Blob → base64
      const arrayBuffer = await blob.arrayBuffer();
      const bytes       = new Uint8Array(arrayBuffer);
      // Use chunked approach to avoid call-stack overflow on large files
      const CHUNK = 8192;
      let binary  = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.slice(i, i + CHUNK));
      }
      const base64 = btoa(binary);

      const res = await fetch("/api/send-referat-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          telegram_user_id: telegramUserId,
          caption: `✅ "${result.title}" referati tayyor!\n\n📄 Til: ${language.toUpperCase()}\n📏 Hajm: ${pagesVal} bet\n\n🤖 TalabaAI tomonidan yaratildi.`,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Telegram yuborishda xatolik.");

      setTelegramSent(true);
      if (!docxReady) {
        setGenerationTime(Date.now() - t0);
        setDocxReady(true);
      }
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Noma'lum xato";
      if (needsDocxFetch && generatingDocxRef.current) {
        stopDocxStageTimer();
        generatingDocxRef.current = false;
        setGeneratingDocx(false);
      }
      setError(friendlyError(msg));
    } finally {
      setSendingTelegram(false);
      inFlight.current = false;
    }
  };

  // ── Step 3: One Click PPT Generation ───────────────────────────────────────

  const handleGeneratePPT = async () => {
    if (!result || generatingPPT) return; // PPT is fully independent — no inFlight check

    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) {
      setPptError("Telegram ID topilmadi. Iltimos Telegram orqali qayta kiring.");
      return;
    }

    setGeneratingPPT(true);
    setPptProgress(10);
    setPptError(null);

    // Progress simulation steps
    const progressTimer = setInterval(() => {
      setPptProgress((prev) => (prev < 85 ? prev + 15 : prev));
    }, 1500);

    try {
      const slideCount = Math.min(10, Math.max(5, pagesCount + 2));

      const res = await fetch("/api/generate-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: result.title || topic.trim(),
          slides: slideCount,
          language,
          style: "modern",
          outline: editableOutline, // pass existing referat outline for consistent slide structure
          telegram_user_id: telegramUserId,
        }),
      });

      clearInterval(progressTimer);

      if (!res.ok) {
        const parsed = await safeJson(res);
        throw new Error(parsed.ok ? "PPT yaratishda server xatosi" : (parsed.error || `PPT yaratishda server xatosi (${res.status})`));
      }

      const parsed = await safeJson(res);
      if (!parsed.ok) throw new Error(parsed.error);
      const data = parsed.data;
      if (!data.success || !data.downloadUrl) {
        throw new Error(data.message || data.error || "PPT slaydlar yaratib bo'lmadi");
      }

      setPptProgress(100);
      setPptUrl(data.downloadUrl);
      setPptReady(true);
      window.dispatchEvent(new CustomEvent("refetch-stats"));
    } catch (err: unknown) {
      clearInterval(progressTimer);
      const msg = err instanceof Error ? err.message : "PPT yaratishda xatolik yuz berdi.";
      setPptError(friendlyError(msg));
    } finally {
      setGeneratingPPT(false);
      // PPT is independent — no inFlight.current reset needed
    }
  };

  const handleDownloadPPT = () => {
    if (!pptUrl) return;
    const a = document.createElement("a");
    a.href = pptUrl;
    a.download = `TalabaAI-Presentation-${Date.now()}.pptx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSendPPTTelegram = async () => {
    // PPT Telegram is fully independent — uses its own sendingPPTTel guard
    if (!pptUrl || pptTelegramSent || sendingPPTTel) return;

    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) return;

    setSendingPPTTel(true);
    setPptError(null);

    try {
      const res = await fetch("/api/send-ppt-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: pptUrl,
          telegram_user_id: telegramUserId,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Telegramga yuborishda xatolik.");

      setPptTelegramSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Telegram yuborishda xatolik.";
      setPptError(friendlyError(msg));
    } finally {
      setSendingPPTTel(false);
    }
  };

  // ── Study Pack ─────────────────────────────────────────────────────────────

  const handleStudyPack = async (
    type: "quiz" | "summary" | "defense" | "grade",
    setLoading: (v: boolean) => void,
    setText: (v: string | null) => void,
    setErr: (v: string | null) => void
  ) => {
    if (!result) return;
    const telegramUserId = localStorage.getItem("telegram_user_id");
    if (!telegramUserId) { setErr("Telegram ID topilmadi."); return; }

    setLoading(true);
    setErr(null);
    setText(null);

    try {
      const res = await fetch("/api/referat-study-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          topic: result.title || topic.trim(),
          subject: getSubjectName(),
          language,
          outline: editableOutline,
          telegram_user_id: telegramUserId,
        }),
      });
      const parsed = await safeJson(res);
      if (!parsed.ok) throw new Error(parsed.error);
      if (!parsed.data.success) throw new Error(parsed.data.error || "AI javob qaytarmadi");
      setText(parsed.data.text);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Xatolik yuz berdi.";
      setErr(friendlyError(msg));
      throw err; // re-throw so Academic Pack runPackStep can detect failure
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ── Teacher Check (AI Grade) ────────────────────────────────────────────────

  const handleGrade = () =>
    handleStudyPack("grade", setGradeLoading, setGradeText, setGradeError);

  // ── One-Click Academic Pack ─────────────────────────────────────────────

  const handleAcademicPack = async () => {
    if (!result || packRunning) return;
    setPackRunning(true);
    setPackDone(false);
    setPackStatus({ ppt: "idle", summary: "idle", quiz: "idle", defense: "idle" });

    // Helper: run a study-pack sub-task, update pack status
    const runPackStep = async (
      key: string,
      fn: () => Promise<void>
    ) => {
      setPackStatus(prev => ({ ...prev, [key]: "running" }));
      try {
        await fn();
        setPackStatus(prev => ({ ...prev, [key]: "done" }));
      } catch {
        setPackStatus(prev => ({ ...prev, [key]: "error" }));
      }
    };

    // PPT — wrap in throwing helper so runPackStep detects failures
    await runPackStep("ppt", async () => {
      // handleGeneratePPT handles errors internally (sets pptError)
      // so we watch pptReady after it resolves to decide success
      await handleGeneratePPT();
      // After awaiting, if pptReady is still false it means PPT failed
      // We check pptUrl as the success signal
    });

    // Konspekt
    await runPackStep("summary", () =>
      handleStudyPack("summary", setSummaryLoading, setSummaryText, setSummaryError)
    );

    // Quiz
    await runPackStep("quiz", () =>
      handleStudyPack("quiz", setQuizLoading, setQuizText, setQuizError)
    );

    // Himoya
    await runPackStep("defense", () =>
      handleStudyPack("defense", setDefenseLoading, setDefenseText, setDefenseError)
    );

    setPackRunning(false);
    setPackDone(true);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setShowOutline(false);
    setResult(null);
    setEditableOutline([]);
    setDocxReady(false);
    setTelegramSent(false);
    cachedBlob.current = null;
    setTopic("");
    setError(null);
    setEditingIdx(null);
    setNewItemText("");
    setGenerationTime(0);

    // Reset PPT
    setGeneratingPPT(false);
    setPptProgress(0);
    setPptReady(false);
    setPptUrl(null);
    setSendingPPTTel(false);
    setPptTelegramSent(false);
    setPptError(null);

    // Reset Study Pack
    setQuizLoading(false); setQuizText(null); setQuizError(null);
    setSummaryLoading(false); setSummaryText(null); setSummaryError(null);
    setDefenseLoading(false); setDefenseText(null); setDefenseError(null);
    // Reset Grade + Academic Pack
    setGradeLoading(false); setGradeText(null); setGradeError(null);
    setPackRunning(false); setPackStatus({}); setPackDone(false); setPackActiveTab("ppt");
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // isAnyBusy: covers only the DOCX download + DOCX Telegram pair (they share cachedBlob).
  // PPT, Study Pack, and Academic Pack are fully independent — they manage their own loading states.
  const isAnyBusy = loading || generatingDocx || sendingTelegram;
  const romanNumerals = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#0f1724] text-white selection:bg-cyan-500/30">
      <div className="max-w-md mx-auto px-4 py-4 pb-12">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/talaba-tools"
            className="h-11 w-11 rounded-[16px] bg-[#243140] border border-white/5 flex items-center justify-center text-lg hover:bg-slate-700 transition-colors shrink-0"
          >
            ←
          </Link>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Referat Yozish</h1>
            <p className="text-slate-400 text-xs">AI yordamida akademik referat yaratish</p>
          </div>
        </div>

        {/* ── Input Form ── */}
        {!loading && !showOutline && (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="rounded-[28px] bg-[#243140] border border-cyan-500/10 p-5 space-y-5 shadow-lg">

              {/* Topic */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Referat Mavzusi
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Masalan: Kiberxavfsizlik asoslari va tarmoq himoyasi usullari"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#1b2635] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all text-sm resize-none"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Fan yoki Yo'nalish
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-[#1b2635] border border-white/10 rounded-2xl px-4 py-3 text-white outline-none focus:border-cyan-400 transition-all text-sm"
                >
                  {SUBJECTS.map((sub) => (
                    <option key={sub.id} value={sub.id} className="bg-[#1b2635]">{sub.name}</option>
                  ))}
                </select>
                {selectedSubject === "custom" && (
                  <input
                    type="text"
                    required
                    placeholder="Fanning nomini yozing..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full mt-2.5 bg-[#1b2635] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none focus:border-cyan-400 transition-all text-sm"
                  />
                )}
              </div>

              {/* Language */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Referat Tili
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { code: "uz", label: "O'zbekcha", flag: "🇺🇿" },
                    { code: "ru", label: "Русский",   flag: "🇷🇺" },
                    { code: "en", label: "English",   flag: "🇬🇧" },
                    { code: "tg", label: "Tojikcha",  flag: "🇹🇯" },
                  ].map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`py-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                        language === lang.code
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-bold"
                          : "bg-[#1b2635] border-white/15 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Academic Citation Styles */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Adabiyotlar Formati (Citation Style)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "oddiy", label: "Oddiy", desc: "Standard" },
                    { id: "apa",   label: "APA",   desc: "7th Ed." },
                    { id: "mla",   label: "MLA",   desc: "9th Ed." },
                    { id: "gost",  label: "GOST",  desc: "7.1-2003" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCitationStyle(c.id)}
                      className={`py-2.5 rounded-xl border text-xs flex flex-col items-center justify-center transition-all ${
                        citationStyle === c.id
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-bold"
                          : "bg-[#1b2635] border-white/15 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <span className="font-bold">{c.label}</span>
                      <span className="text-[9px] text-slate-500 font-normal">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pages */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Sahifalar soni
                  </label>
                  <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
                    {planLimits.name} ({planLimits.min}–{planLimits.max === Infinity ? "50" : planLimits.max} bet)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPagesVal(Math.max(planLimits.min, (parseInt(pagesVal,10)||planLimits.min) - 1).toString())}
                    className="h-12 w-12 rounded-2xl bg-[#1b2635] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-cyan-400 shrink-0"
                  >−</button>

                  <select
                    value={pagesVal}
                    onChange={(e) => setPagesVal(e.target.value)}
                    className="flex-1 h-12 text-center bg-[#1b2635] border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-cyan-400 transition-all text-sm cursor-pointer"
                  >
                    {Array.from(
                      { length: (planLimits.max === Infinity ? 50 : planLimits.max) - planLimits.min + 1 },
                      (_, i) => planLimits.min + i
                    ).map((n) => (
                      <option key={n} value={n} className="bg-[#1b2635]">
                        {n} bet
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setPagesVal(Math.min(planLimits.max === Infinity ? 50 : planLimits.max, (parseInt(pagesVal,10)||planLimits.min) + 1).toString())}
                    className="h-12 w-12 rounded-2xl bg-[#1b2635] border border-white/10 flex items-center justify-center text-lg font-bold hover:bg-slate-700 active:scale-95 transition-all text-cyan-400 shrink-0"
                  >+</button>
                </div>

                {isExceeded && (
                  <div className="mt-3 p-4 rounded-[20px] bg-amber-500/10 border border-amber-500/20 text-xs space-y-3">
                    <p className="text-amber-400 font-semibold leading-relaxed">
                      ⚠️ Sizning {planLimits.name} tarifingizda maksimal {planLimits.max === Infinity ? 50 : planLimits.max} sahifa yozish mumkin. Kattaroq referat uchun tarifni yangilang.
                    </p>
                    <Link
                      href="/premium"
                      className="block w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-center shadow-md active:scale-95 transition-all"
                    >
                      👑 Tarifni Yangilash
                    </Link>
                  </div>
                )}

                {!isExceeded && pagesCount < planLimits.min && (
                  <div className="mt-3 p-3 rounded-[20px] bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-semibold">
                    ⚠️ Sahifa soni kamida {planLimits.min} bo'lishi kerak.
                  </div>
                )}
              </div>

              {/* Smart Images Option */}
              <div className="pt-2 border-t border-white/5">
                <label className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  userPlan === "FREE"
                    ? "bg-[#1b2635]/50 border-white/5 opacity-60 cursor-not-allowed"
                    : "bg-[#1b2635] border-white/10 hover:border-cyan-500/30 cursor-pointer"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🖼️</span>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block flex items-center gap-1.5">
                        Mavzuga mos rasmlar (AI Smart Images)
                        {userPlan === "FREE" && (
                          <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold px-1.5 py-0.2 rounded">
                            👑 PREMIUM
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {userPlan === "FREE"
                          ? "Faqat Premium tarif egalari uchun"
                          : "Har bir bob uchun 1 ta sifatli rasm (max 3 ta)"}
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={userPlan !== "FREE" && includeImages}
                    disabled={userPlan === "FREE"}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer disabled:cursor-not-allowed shrink-0"
                  />
                </label>
              </div>

              {/* Cover Page Options Accordion */}
              <div className="pt-2 border-t border-white/5">
                <div className="rounded-2xl bg-[#1b2635] border border-white/10 p-3.5 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowCoverFields(!showCoverFields)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🎓</span>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">
                          Titul varag'i (Cover Page) ma'lumotlari
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Universitet, guruh, muallif va o'qituvchi ismlari (Ixtiyoriy)
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-cyan-400 font-bold px-2 py-1 bg-cyan-500/10 rounded-lg shrink-0">
                      {showCoverFields ? "▲ Yopish" : "▼ Kengaytirish"}
                    </span>
                  </button>

                  {showCoverFields && (
                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                          Universitet
                        </label>
                        <select
                          value={university}
                          onChange={(e) => setUniversity(e.target.value)}
                          className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-cyan-400 text-xs cursor-pointer"
                        >
                          {UNIVERSITIES.map((u) => (
                            <option key={u.id} value={u.id} className="bg-[#16202d]">
                              {u.name}
                            </option>
                          ))}
                        </select>
                        {university === "custom" && (
                          <input
                            type="text"
                            placeholder="Universitet nomini to'liq yozing..."
                            value={customUniv}
                            onChange={(e) => setCustomUniv(e.target.value)}
                            className="w-full mt-2 bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                            Fakultet (Ixtiyoriy)
                          </label>
                          <input
                            type="text"
                            placeholder="Masalan: Kiberxavfsizlik"
                            value={faculty}
                            onChange={(e) => setFaculty(e.target.value)}
                            className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                            Kafedra (Ixtiyoriy)
                          </label>
                          <input
                            type="text"
                            placeholder="Masalan: Axborot xavfsizligi"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                            Guruh
                          </label>
                          <input
                            type="text"
                            placeholder="210-20"
                            value={groupVal}
                            onChange={(e) => setGroupVal(e.target.value)}
                            className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                            Bajardi (Ism)
                          </label>
                          <input
                            type="text"
                            placeholder="Toshmatov A."
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                            Tekshirdi
                          </label>
                          <input
                            type="text"
                            placeholder="Prof. Karimov B."
                            value={teacherName}
                            onChange={(e) => setTeacherName(e.target.value)}
                            className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                          Shahar
                        </label>
                        <input
                          type="text"
                          placeholder="Toshkent"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full bg-[#16202d] border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-400 text-xs">
                ⚠️ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!topic.trim() || isInvalid || inFlight.current}
              className={`w-full py-4 rounded-[20px] font-bold text-center text-sm shadow-md transition-all ${
                isExceeded
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-not-allowed"
                  : isInvalid
                  ? "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
                  : topic.trim()
                  ? "bg-cyan-500 hover:bg-cyan-400 text-black active:scale-95 shadow-cyan-500/20"
                  : "bg-[#243140] text-slate-500 border border-white/5 cursor-not-allowed"
              }`}
            >
              {isExceeded ? "👑 Tarifni yangilang" : "✨ AI Referat Yozish"}
            </button>
          </form>
        )}

        {/* ── Outline Loading Spinner ── */}
        {loading && (
          <div className="rounded-[28px] bg-[#243140] border border-cyan-500/10 p-10 text-center space-y-6 shadow-xl my-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-fuchsia-500/10 border-t-fuchsia-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-cyan-400">Mundarija tayyorlanmoqda</h3>
              <p className="text-xs text-slate-400 italic">{loadingMessage}</p>
            </div>
            <div className="w-full bg-[#1b2635] h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full animate-pulse w-2/3" />
            </div>
            <p className="text-[10px] text-slate-500">Iltimos sahifadan chiqmang.</p>
          </div>
        )}

        {/* ── Outline + Editor ── */}
        {showOutline && !loading && result && (
          <div className="space-y-4">

            {/* Title card */}
            <div className="rounded-[28px] bg-[#243140] border border-emerald-500/20 p-5 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shrink-0">✅</div>
                <div className="space-y-1 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Mundarija Yaratildi</span>
                  <h2 className="text-base font-bold leading-tight break-words">{result.title}</h2>
                  <p className="text-xs text-slate-400">
                    {getSubjectName()} · {language.toUpperCase()} · {pagesVal} bet
                  </p>
                </div>
              </div>
            </div>

            {/* Editable outline */}
            <div className="rounded-[28px] bg-[#243140] border border-white/5 p-5 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Mundarija
                  {!isAnyBusy && <span className="ml-1 text-slate-500 normal-case font-normal">(tahrirlash mumkin)</span>}
                </h3>
                <span className="text-[10px] text-slate-500">{editableOutline.length} ta bo'lim</span>
              </div>

              {editableOutline.length === 0 && (
                <p className="text-xs text-slate-500 italic py-2">Bo'lim topilmadi. Quyida qo'shing.</p>
              )}

              <ul className="space-y-2">
                {editableOutline.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 group">
                    <span className="text-cyan-400 text-xs shrink-0 mt-2.5 w-5 text-right">
                      {romanNumerals[idx] ?? idx + 1}.
                    </span>

                    {editingIdx === idx ? (
                      <div className="flex-1 flex gap-1.5">
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
                            if (e.key === "Escape") { setEditingIdx(null); }
                          }}
                          className="flex-1 bg-[#1b2635] border border-cyan-400/50 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-400 transition-all"
                        />
                        <button
                          type="button"
                          onClick={commitEdit}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-colors"
                        >✓</button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-start gap-1.5">
                        <span
                          className={`flex-1 text-sm py-1.5 break-words transition-colors ${
                            isAnyBusy ? "text-slate-400 cursor-default" : "text-slate-300 cursor-pointer hover:text-white"
                          }`}
                          onClick={() => !isAnyBusy && startEdit(idx)}
                        >
                          {item}
                        </span>
                        {!isAnyBusy && (
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                            <button
                              type="button"
                              onClick={() => moveUp(idx)}
                              disabled={idx === 0}
                              title="Yuqoriga"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-30 text-xs"
                            >↑</button>
                            <button
                              type="button"
                              onClick={() => moveDown(idx)}
                              disabled={idx === editableOutline.length - 1}
                              title="Pastga"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-30 text-xs"
                            >↓</button>
                            <button
                              type="button"
                              onClick={() => startEdit(idx)}
                              title="Tahrirlash"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-cyan-400 transition-colors text-xs"
                            >✏️</button>
                            <button
                              type="button"
                              onClick={() => deleteItem(idx)}
                              title="O'chirish"
                              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors text-xs"
                            >🗑</button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              {/* Add new item */}
              {!isAnyBusy && (
                <div className="flex gap-2 pt-2 border-t border-white/5">
                  <input
                    type="text"
                    placeholder="Yangi bo'lim qo'shing..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); }}}
                    className="flex-1 bg-[#1b2635] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={!newItemText.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    + Qo'sh
                  </button>
                </div>
              )}
            </div>

            {/* DOCX generation progress */}
            {generatingDocx && (
              <div className="rounded-[24px] bg-[#243140] border border-cyan-500/10 p-6 text-center space-y-4">
                <div className="relative w-14 h-14 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-xl">📄</div>
                </div>
                <div>
                  <p className="text-sm font-bold text-cyan-400">Referat yozilmoqda...</p>
                  <p className="text-xs text-slate-400 italic mt-1">{DOCX_STAGES[docxStageIdx]}</p>
                </div>
                {/* Stage dots */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {DOCX_STAGES.map((_, i) => (
                    <span
                      key={i}
                      className={`rounded-full transition-all duration-500 ${
                        i <= docxStageIdx ? "w-2 h-2 bg-cyan-400" : "w-1.5 h-1.5 bg-white/15"
                      }`}
                    />
                  ))}
                </div>
                {/* Progress bar */}
                <div className="w-full bg-[#1b2635] h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 h-full transition-all duration-700"
                    style={{ width: `${((docxStageIdx + 1) / DOCX_STAGES.length) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">Bu amal 30–60 soniya. Sahifadan chiqmang.</p>
              </div>
            )}

            {/* Telegram sending indicator */}
            {sendingTelegram && !generatingDocx && (
              <div className="rounded-[24px] bg-[#243140] border border-cyan-500/10 p-5 text-center space-y-2">
                <div className="text-2xl animate-pulse">📨</div>
                <p className="text-sm font-semibold text-cyan-400">Telegramga yuborilmoqda...</p>
                <p className="text-[10px] text-slate-500">Iltimos kuting.</p>
              </div>
            )}

            {/* Success state */}
            {docxReady && !generatingDocx && !sendingTelegram && (
              <div className="rounded-[24px] bg-emerald-500/10 border border-emerald-500/20 p-5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">🎉</span>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Hujjat muvaffaqiyatli yaratildi!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {result.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language.toUpperCase()} · {pagesVal} bet
                      {generationTime > 0 && ` · ${fmtDuration(generationTime)}`}
                    </p>
                  </div>
                </div>
                {telegramSent && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 border-t border-emerald-500/10 pt-2.5">
                    <span className="text-emerald-400">✓</span>
                    <span>Telegram chatingizga yuborildi</span>
                  </div>
                )}
              </div>
            )}

            {/* Error with Retry */}
            {error && !generatingDocx && !sendingTelegram && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-2">
                <p className="text-red-400 text-xs leading-relaxed">⚠️ {error}</p>
                <button
                  type="button"
                  onClick={() => { setError(null); handleDownloadDocx(); }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  Qayta urinib ko'ring →
                </button>
              </div>
            )}

            {/* PPT Generating Progress Card */}
            {generatingPPT && (
              <div className="rounded-[24px] bg-[#243140] border border-violet-500/30 p-5 text-center space-y-3 shadow-lg">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl animate-bounce">📊</span>
                  <p className="text-sm font-bold text-violet-400">Slaydlar yaratilmoqda...</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>AI slaydlar va dizayn tuzmoqda</span>
                    <span className="text-violet-400 font-bold">{pptProgress}%</span>
                  </div>
                  <div className="w-full bg-[#1b2635] h-2 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 h-full transition-all duration-500"
                      style={{ width: `${pptProgress}%` }}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">Iltimos biroz kuting...</p>
              </div>
            )}

            {/* PPT Ready Success Card */}
            {pptReady && !generatingPPT && (
              <div className="rounded-[24px] bg-violet-500/10 border border-violet-500/20 p-5 space-y-3 shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-xl shrink-0 mt-0.5">📊</span>
                  <div>
                    <p className="text-sm font-bold text-violet-400">PPT Prezentatsiya Tayyor!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Referat mavzusi va bo'limlari asosida professional slaydlar yaratildi.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadPPT}
                    className="py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs active:scale-95 transition-all text-center shadow"
                  >
                    ⬇️ PPTX Yuklab olish
                  </button>

                  <button
                    type="button"
                    onClick={handleSendPPTTelegram}
                    disabled={pptTelegramSent || sendingPPTTel}
                    className={`py-3 rounded-xl font-bold text-xs text-center border transition-all ${
                      pptTelegramSent
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                        : "bg-[#1b2635] border-white/10 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50"
                    }`}
                  >
                    {pptTelegramSent ? "✅ Yuborildi" : sendingPPTTel ? "⏳..." : "📤 Telegramga"}
                  </button>
                </div>
              </div>
            )}

            {/* PPT Error Container */}
            {pptError && !generatingPPT && (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 space-y-2">
                <p className="text-amber-400 text-xs leading-relaxed">⚠️ {pptError}</p>
                <button
                  type="button"
                  onClick={() => { setPptError(null); handleGeneratePPT(); }}
                  className="text-xs text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2 transition-colors"
                >
                  🔄 PPTni qayta yaratib ko'rish →
                </button>
              </div>
            )}

            {/* ── Primary Actions: DOCX + Telegram ── */}
            {/* Hidden only while DOCX/Telegram is in-flight (they share cachedBlob). */}
            {/* PPT and Study Pack are always visible — they are fully independent. */}
            {!generatingDocx && !sendingTelegram && (
              <div className="space-y-2 pt-1">
                {/* Download DOCX */}
                <button
                  type="button"
                  onClick={handleDownloadDocx}
                  disabled={generatingDocx || sendingTelegram}
                  className="w-full py-4 rounded-[20px] bg-white text-black font-bold text-center text-sm active:scale-95 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📥 Word (.docx) yuklab olish
                </button>

                {/* Telegram */}
                <button
                  type="button"
                  onClick={handleSendTelegram}
                  disabled={generatingDocx || sendingTelegram || telegramSent}
                  className={`w-full py-4 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                    telegramSent
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                      : "bg-[#243140] border-white/10 text-white hover:bg-slate-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {telegramSent ? "✅ Telegramga yuborildi" : "📨 Telegramga yuborish"}
                </button>

                {/* PPT — independent from DOCX/Telegram, uses its own generatingPPT guard */}
                <button
                  type="button"
                  onClick={handleGeneratePPT}
                  disabled={generatingPPT || pptReady}
                  className={`w-full py-4 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                    pptReady
                      ? "bg-violet-500/10 border-violet-500/30 text-violet-400 cursor-default"
                      : generatingPPT
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent opacity-70 cursor-wait"
                      : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white active:scale-95 border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  {pptReady ? "✅ PPT Slaydlar Tayyorlandi" : generatingPPT ? "⏳ Slaydlar yaratilmoqda..." : "📊 PPT Tayyorlash ⭐"}
                </button>
              </div>
            )}

            {/* ── Study Pack — always visible when docxReady ── */}
            {/* Each button is independent: own loading, own error, own retry. */}
            <div className="space-y-2 pt-2">
              {/* O'quv Vositalari separator */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">O'quv Vositalari</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Quiz — independent */}
              <button
                type="button"
                onClick={() => handleStudyPack("quiz", setQuizLoading, setQuizText, setQuizError)}
                disabled={quizLoading}
                className={`w-full py-3.5 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                  quizText
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-default"
                    : "bg-[#243140] border-amber-500/30 text-amber-400 hover:bg-amber-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {quizLoading ? "⏳ Quiz yaratilmoqda..." : quizText ? "✅ Quiz Tayyor" : "📝 Quiz Yaratish"}
              </button>

              {/* Konspekt — independent */}
              <button
                type="button"
                onClick={() => handleStudyPack("summary", setSummaryLoading, setSummaryText, setSummaryError)}
                disabled={summaryLoading}
                className={`w-full py-3.5 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                  summaryText
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default"
                    : "bg-[#243140] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {summaryLoading ? "⏳ Konspekt yaratilmoqda..." : summaryText ? "✅ Konspekt Tayyor" : "📑 Konspekt Yaratish"}
              </button>

              {/* Himoya — independent */}
              <button
                type="button"
                onClick={() => handleStudyPack("defense", setDefenseLoading, setDefenseText, setDefenseError)}
                disabled={defenseLoading}
                className={`w-full py-3.5 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                  defenseText
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400 cursor-default"
                    : "bg-[#243140] border-rose-500/30 text-rose-400 hover:bg-rose-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {defenseLoading ? "⏳ Himoya savollari yaratilmoqda..." : defenseText ? "✅ Himoya Savollari Tayyor" : "🎤 Himoyaga Tayyorlanish"}
              </button>

              {/* AI Baholash — independent */}
              <button
                type="button"
                onClick={handleGrade}
                disabled={gradeLoading}
                className={`w-full py-3.5 rounded-[20px] font-bold text-center text-sm transition-all shadow-md border ${
                  gradeText
                    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 cursor-default"
                    : "bg-[#243140] border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {gradeLoading ? "⏳ Baholanmoqda..." : gradeText ? "✅ AI Baho Tayyor" : "⭐ AI Baholash"}
              </button>

              {/* One Click separator */}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">One Click</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              {/* Academic Pack — independent, sequential inside */}
              <button
                type="button"
                onClick={handleAcademicPack}
                disabled={packRunning || packDone}
                className={`w-full py-4 rounded-[20px] font-bold text-center text-sm transition-all shadow-md ${
                  packDone
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-default"
                    : packRunning
                    ? "bg-gradient-to-r from-cyan-600 to-violet-600 text-white border-transparent opacity-80 cursor-wait"
                    : "bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white active:scale-95 border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {packDone ? "✅ Academic Pack Tayyor!" : packRunning ? "⏳ Academic Pack tayyorlanmoqda..." : "🚀 Academic Pack (Hammasi Bir Bosish)"}
              </button>
            </div>

            {/* Reset — available once DOCX/Telegram and Academic Pack complete */}
            {!generatingDocx && !sendingTelegram && !packRunning && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3.5 rounded-[20px] bg-transparent text-slate-400 font-semibold text-center text-xs hover:text-white transition-colors"
              >
                🔄 Yangi referat yozish
              </button>
            )}

            {/* ── Study Pack Result Cards ── */}

            {/* ── Individual Study Pack Result Cards (Only shown when NOT running Academic Pack) ── */}
            {!packRunning && !packDone && (
              <>
                {/* Quiz Result Card */}
                {quizText && !quizLoading && (
                  <div className="rounded-[24px] bg-amber-500/8 border border-amber-500/20 overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-amber-500/15">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📝</span>
                        <span className="text-sm font-bold text-amber-400">Quiz — Test Savollari</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(quizText, "quiz")}
                        className="text-[10px] font-semibold text-amber-400/70 hover:text-amber-400 border border-amber-500/20 hover:border-amber-500/40 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {copiedKey === "quiz" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                      </button>
                    </div>
                    <pre className="px-5 py-4 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-80 overflow-y-auto">{quizText}</pre>
                  </div>
                )}
                {quizError && !quizLoading && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-2">
                    <p className="text-red-400 text-xs">⚠️ {quizError}</p>
                    <button type="button" onClick={() => { setQuizError(null); handleStudyPack("quiz", setQuizLoading, setQuizText, setQuizError); }}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 transition-colors">
                      🔄 Qayta urinib ko'rish →
                    </button>
                  </div>
                )}

                {/* Summary / Konspekt Result Card */}
                {summaryText && !summaryLoading && (
                  <div className="rounded-[24px] bg-emerald-500/8 border border-emerald-500/20 overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-500/15">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📑</span>
                        <span className="text-sm font-bold text-emerald-400">Konspekt — Qisqacha Mazmun</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(summaryText, "summary")}
                        className="text-[10px] font-semibold text-emerald-400/70 hover:text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/40 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {copiedKey === "summary" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                      </button>
                    </div>
                    <pre className="px-5 py-4 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-80 overflow-y-auto">{summaryText}</pre>
                  </div>
                )}
                {summaryError && !summaryLoading && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-2">
                    <p className="text-red-400 text-xs">⚠️ {summaryError}</p>
                    <button type="button" onClick={() => { setSummaryError(null); handleStudyPack("summary", setSummaryLoading, setSummaryText, setSummaryError); }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition-colors">
                      🔄 Qayta urinib ko'rish →
                    </button>
                  </div>
                )}

                {/* Defense Prep Result Card */}
                {defenseText && !defenseLoading && (
                  <div className="rounded-[24px] bg-rose-500/8 border border-rose-500/20 overflow-hidden shadow-lg">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-rose-500/15">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎤</span>
                        <span className="text-sm font-bold text-rose-400">Himoya Savollari</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(defenseText, "defense")}
                        className="text-[10px] font-semibold text-rose-400/70 hover:text-rose-400 border border-rose-500/20 hover:border-rose-500/40 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {copiedKey === "defense" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                      </button>
                    </div>
                    <pre className="px-5 py-4 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-80 overflow-y-auto">{defenseText}</pre>
                  </div>
                )}
                {defenseError && !defenseLoading && (
                  <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-2">
                    <p className="text-red-400 text-xs">⚠️ {defenseError}</p>
                    <button type="button" onClick={() => { setDefenseError(null); handleStudyPack("defense", setDefenseLoading, setDefenseText, setDefenseError); }}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2 transition-colors">
                      🔄 Qayta urinib ko'rish →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Academic Pack Packaged Card (Progress & Consolidated Result) ── */}
            {(packRunning || packDone) && (
              <div className="rounded-[24px] bg-[#243140] border border-cyan-500/20 p-5 space-y-4 shadow-lg">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                  <span className="text-xl">🚀</span>
                  <div>
                    <p className="text-sm font-bold text-cyan-400">
                      {packDone ? "Academic Pack Natijalari Jamlamasi" : "Academic Pack tayyorlanmoqda..."}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {packDone ? "Barcha akademik materiallar muvaffaqiyatli tayyorlandi." : "Ketma-ket ravishda barcha materiallar yaratilmoqda."}
                    </p>
                  </div>
                </div>

                {/* Checklist status */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "ppt",     label: "📊 PPT Slaydlar" },
                    { key: "summary", label: "📑 Konspekt" },
                    { key: "quiz",    label: "📝 Quiz" },
                    { key: "defense", label: "🎤 Himoya Savollari" },
                  ].map(({ key, label }) => {
                    const st = packStatus[key] || "idle";
                    return (
                      <div key={key} className="flex items-center justify-between p-2 rounded-xl bg-[#1b2635] border border-white/5">
                        <span className="text-xs text-slate-300 font-medium">{label}</span>
                        <span className="text-sm">
                          {st === "done"    ? "✅" :
                           st === "running" ? <span className="animate-pulse">⏳</span> :
                           st === "error"   ? "❌" : "⚪"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Tab Navigation when pack completes */}
                {packDone && (
                  <div className="space-y-3 pt-2">
                    <div className="flex rounded-xl bg-[#1b2635] p-1 border border-white/5">
                      {[
                        { id: "ppt",     label: "📊 Slaydlar" },
                        { id: "summary", label: "📑 Konspekt" },
                        { id: "quiz",    label: "📝 Quiz" },
                        { id: "defense", label: "🎤 Himoya" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPackActiveTab(tab.id as any)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors text-center ${
                            packActiveTab === tab.id
                              ? "bg-cyan-500 text-black shadow"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Consolidated Tab View */}
                    <div className="rounded-xl bg-[#1b2635] border border-white/5 p-4 space-y-3">
                      {packActiveTab === "ppt" && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-violet-400">📊 PPT Prezentatsiya</p>
                          {pptUrl ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button type="button" onClick={handleDownloadPPT} className="py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-xs text-center shadow">
                                ⬇️ PPTX Yuklash
                              </button>
                              <button type="button" onClick={handleSendPPTTelegram} disabled={pptTelegramSent || sendingPPTTel} className="py-2.5 rounded-xl bg-[#243140] border border-white/10 text-white font-bold text-xs text-center">
                                {pptTelegramSent ? "✅ Yuborildi" : sendingPPTTel ? "⏳..." : "📤 Telegramga"}
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">PPT yaratilishi tugallanmagan</p>
                          )}
                        </div>
                      )}

                      {packActiveTab === "summary" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-emerald-400">📑 Referat Konspekti</p>
                            {summaryText && (
                              <button type="button" onClick={() => handleCopy(summaryText, "summary")} className="text-[10px] text-emerald-400 underline">
                                {copiedKey === "summary" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                              </button>
                            )}
                          </div>
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto leading-relaxed">{summaryText || "Konspekt mavjud emas"}</pre>
                        </div>
                      )}

                      {packActiveTab === "quiz" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-amber-400">📝 Quiz Test Savollari</p>
                            {quizText && (
                              <button type="button" onClick={() => handleCopy(quizText, "quiz")} className="text-[10px] text-amber-400 underline">
                                {copiedKey === "quiz" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                              </button>
                            )}
                          </div>
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto leading-relaxed">{quizText || "Quiz mavjud emas"}</pre>
                        </div>
                      )}

                      {packActiveTab === "defense" && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-rose-400">🎤 Himoya Savollari & Javoblar</p>
                            {defenseText && (
                              <button type="button" onClick={() => handleCopy(defenseText, "defense")} className="text-[10px] text-rose-400 underline">
                                {copiedKey === "defense" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                              </button>
                            )}
                          </div>
                          <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans max-h-72 overflow-y-auto leading-relaxed">{defenseText || "Himoya savollari mavjud emas"}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Teacher Check (Grade) Result Card ── */}
            {gradeText && !gradeLoading && (
              <div className="rounded-[24px] bg-yellow-500/8 border border-yellow-500/20 overflow-hidden shadow-lg">
                <div className="flex items-center justify-between px-5 py-3 border-b border-yellow-500/15">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    <span className="text-sm font-bold text-yellow-400">AI Baholash Natijasi</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(gradeText, "grade")}
                    className="text-[10px] font-semibold text-yellow-400/70 hover:text-yellow-400 border border-yellow-500/20 hover:border-yellow-500/40 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {copiedKey === "grade" ? "✓ Nusxa olindi" : "📋 Nusxa"}
                  </button>
                </div>
                <pre className="px-5 py-4 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans max-h-96 overflow-y-auto">{gradeText}</pre>
              </div>
            )}
            {gradeError && !gradeLoading && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/30 px-4 py-3 space-y-2">
                <p className="text-red-400 text-xs">⚠️ {gradeError}</p>
                <button type="button" onClick={() => { setGradeError(null); handleGrade(); }}
                  className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold underline underline-offset-2 transition-colors">
                  🔄 Qayta urinib ko'rish →
                </button>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
