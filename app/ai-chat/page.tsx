"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  live?: boolean;
};

const LIVE_MODEL = "gemini-3.1-flash-live-preview";
const LIVE_SOCKET_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const LIVE_SYSTEM_INSTRUCTION =
  "Siz Talaba AI ning jonli ovozli o'quv yordamchisisiz. Asosan o'zbek tilida, foydalanuvchi qaysi tilda gapirsa shu tilda gapiring. Javoblarni qisqa, aniq va suhbatga tabiiy tarzda mos bering. Dars yoki imtihon mavzusini sodda tushuntiring.";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
}

function bytesFromBase64(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toPcm16k(samples: Float32Array, inputSampleRate: number) {
  const outputLength = Math.floor(samples.length * 16_000 / inputSampleRate);
  const output = new Int16Array(outputLength);
  const sampleRateRatio = inputSampleRate / 16_000;

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = Math.min(
      Math.floor(index * sampleRateRatio),
      samples.length - 1,
    );
    const sample = Math.max(-1, Math.min(1, samples[sourceIndex]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return new Uint8Array(output.buffer);
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: makeId(),
      role: "assistant",
      text: "Salom! Men Talaba AI yordamchisiman. Fan, mavzu yoki vazifangiz bo'yicha savol bering.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    "idle" | "connecting" | "listening" | "error"
  >("idle");
  const [error, setError] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const playbackNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const liveInputMessageIdRef = useRef<string | null>(null);
  const liveOutputMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  function addOrAppendLiveMessage(
    role: "user" | "assistant",
    text: string,
  ) {
    const idRef = role === "user" ? liveInputMessageIdRef : liveOutputMessageIdRef;
    setMessages((current) => {
      const existingId = idRef.current;
      if (existingId) {
        return current.map((message) =>
          message.id === existingId ? { ...message, text } : message,
        );
      }

      const id = makeId();
      idRef.current = id;
      return [...current, { id, role, text, live: true }];
    });
  }

  function playPcmAudio(base64: string) {
    const context = audioContextRef.current;
    if (!context) return;

    const pcm = new Int16Array(bytesFromBase64(base64).buffer);
    const buffer = context.createBuffer(1, pcm.length, 24_000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) {
      channel[index] = pcm[index] / 0x8000;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.03, playbackTimeRef.current);
    source.start(startAt);
    playbackTimeRef.current = startAt + buffer.duration;
    playbackNodesRef.current.push(source);
    source.onended = () => {
      playbackNodesRef.current = playbackNodesRef.current.filter((node) => node !== source);
    };
  }

  const stopPlayback = useCallback(() => {
    playbackNodesRef.current.forEach((node) => node.stop());
    playbackNodesRef.current = [];
    playbackTimeRef.current = audioContextRef.current?.currentTime ?? 0;
  }, []);

  const stopLive = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopPlayback();
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    liveInputMessageIdRef.current = null;
    liveOutputMessageIdRef.current = null;
    setLiveStatus("idle");
  }, [stopPlayback]);

  useEffect(() => () => stopLive(), [stopLive]);

  async function beginMicrophoneStream(socket: WebSocket) {
    const stream = streamRef.current;
    const context = audioContextRef.current;
    if (!stream || !context) return;

    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(2048, 1, 1);
    source.connect(processor);
    processor.connect(context.destination);
    sourceRef.current = source;
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const pcm = toPcm16k(event.inputBuffer.getChannelData(0), context.sampleRate);
      socket.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64FromBytes(pcm),
              mimeType: "audio/pcm;rate=16000",
            },
          },
        }),
      );
    };
  }

  async function startLive() {
    setError("");
    setLiveStatus("connecting");
    liveInputMessageIdRef.current = null;
    liveOutputMessageIdRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext;
      const context = new AudioContextClass();
      audioContextRef.current = context;
      await context.resume();

      const tokenResponse = await fetch("/api/ai-chat/live-token", { method: "POST" });
      const tokenBody = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenBody.token) {
        throw new Error(tokenBody.error || "Live token olinmadi.");
      }

      const socket = new WebSocket(
        `${LIVE_SOCKET_URL}?access_token=${encodeURIComponent(tokenBody.token)}`,
      );
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            setup: {
              model: `models/${LIVE_MODEL}`,
              responseModalities: ["AUDIO"],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
            },
          }),
        );
      };

      socket.onmessage = (event) => {
        const response = JSON.parse(event.data) as {
          setupComplete?: unknown;
          serverContent?: {
            interrupted?: boolean;
            inputTranscription?: { text?: string };
            outputTranscription?: { text?: string };
            modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
          };
        };

        if (response.setupComplete) {
          void beginMicrophoneStream(socket);
          setLiveStatus("listening");
          return;
        }

        const content = response.serverContent;
        if (!content) return;
        if (content.interrupted) stopPlayback();
        if (content.inputTranscription?.text) {
          addOrAppendLiveMessage("user", content.inputTranscription.text);
        }
        if (content.outputTranscription?.text) {
          addOrAppendLiveMessage("assistant", content.outputTranscription.text);
        }
        content.modelTurn?.parts?.forEach((part) => {
          if (part.inlineData?.data) playPcmAudio(part.inlineData.data);
        });
      };

      socket.onerror = () => {
        setError("Ovozli ulanishda xatolik yuz berdi.");
        setLiveStatus("error");
      };

      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
          processorRef.current?.disconnect();
          processorRef.current = null;
          sourceRef.current?.disconnect();
          sourceRef.current = null;
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setLiveStatus((status) => (status === "error" ? status : "idle"));
        }
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Mikrofonni ishga tushirib bo'lmadi.";
      setError(message);
      stopLive();
      setLiveStatus("error");
    }
  }

  async function sendText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    const nextMessages = [...messages, { id: makeId(), role: "user" as const, text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages
            .filter((message) => !message.live)
            .map(({ role, text: messageText }) => ({ role, text: messageText })),
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.text) {
        throw new Error(body.error || "AI javob bera olmadi.");
      }
      setMessages((current) => [
        ...current,
        { id: makeId(), role: "assistant", text: body.text },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Xabar yuborilmadi.");
    } finally {
      setIsSending(false);
    }
  }

  const isLiveActive = liveStatus === "connecting" || liveStatus === "listening";

  return (
    <main className="min-h-screen bg-[#0f1724] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-4">
        <header className="mb-4 flex items-center justify-between rounded-[26px] border border-cyan-500/10 bg-[#1a2635] px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Bosh sahifaga qaytish" className="text-xl text-cyan-300">←</Link>
            <div>
              <h1 className="text-lg font-bold">AI Chat</h1>
              <p className="text-xs text-slate-400">Gemini bilan yozma va jonli ovozli suhbat</p>
            </div>
          </div>
          <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">Gemini</span>
        </header>

        <section className="mb-3 rounded-2xl border border-cyan-500/15 bg-[#1a2635] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Jonli ovozli suhbat</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {liveStatus === "listening" ? "Tinglayapman — bemalol gapiring" : liveStatus === "connecting" ? "Ulanmoqda..." : "Mikrofon orqali real vaqtda gaplashing"}
              </p>
            </div>
            <button
              type="button"
              onClick={isLiveActive ? stopLive : startLive}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95 ${isLiveActive ? "bg-rose-500/20 text-rose-200" : "bg-cyan-400 text-slate-950"}`}
            >
              {isLiveActive ? "■ To'xtatish" : "🎙 Gaplashish"}
            </button>
          </div>
        </section>

        {error && <p className="mb-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

        <div ref={scrollRef} className="mb-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-[26px] border border-cyan-500/10 bg-[#16202d] p-3">
          {messages.map((message) => (
            <div key={message.id} className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-6 ${message.role === "user" ? "self-end bg-cyan-400 text-slate-950" : "self-start bg-[#243140] text-slate-100"}`}>
              {message.live && <p className="mb-1 text-[10px] font-bold uppercase tracking-wide opacity-65">Jonli suhbat</p>}
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          ))}
          {isSending && <div className="self-start rounded-2xl bg-[#243140] px-3 py-2 text-sm text-slate-300">Gemini yozmoqda...</div>}
        </div>

        <form onSubmit={sendText} className="flex gap-2 rounded-2xl border border-cyan-500/15 bg-[#1a2635] p-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Savolingizni yozing..."
            rows={1}
            maxLength={4000}
            className="min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-500"
          />
          <button type="submit" disabled={!input.trim() || isSending} className="rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40">
            Yuborish
          </button>
        </form>
      </div>
    </main>
  );
}
