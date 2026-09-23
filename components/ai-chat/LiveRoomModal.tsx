"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const LIVE_SOCKET_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

type LiveState =
  | "SETUP"
  | "CONNECTING"
  | "LISTENING"
  | "USER_SPEAKING"
  | "AI_SPEAKING"
  | "ENDING"
  | "RESULT"
  | "ERROR";

type TranscriptItem = {
  role: "user" | "assistant";
  text: string;
};

interface LiveRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRemainingSeconds?: number;
  onSessionComplete?: (remainingSeconds?: number) => void;
}

export type VoiceGender = "male" | "female";

export interface VoiceOption {
  name: string;
  gender: VoiceGender;
  displayName: string;
  description: string;
}

export const MALE_VOICES: VoiceOption[] = [
  { name: "Puck", gender: "male", displayName: "Puck", description: "Sokin va muloyim" },
  { name: "Charon", gender: "male", displayName: "Charon", description: "Jiddiy va vazmin" },
  { name: "Fenrir", gender: "male", displayName: "Fenrir", description: "Dadil va baquvvat" },
  { name: "Orus", gender: "male", displayName: "Orus", description: "Tiniq va akademik" },
  { name: "Algenib", gender: "male", displayName: "Algenib", description: "Muloyim va sokin" },
  { name: "Achird", gender: "male", displayName: "Achird", description: "Klassik va barqaror" },
];

export const FEMALE_VOICES: VoiceOption[] = [
  { name: "Aoede", gender: "female", displayName: "Aoede", description: "Samimiy va do'stona" },
  { name: "Kore", gender: "female", displayName: "Kore", description: "Yumshoq va yoqimli" },
  { name: "Leda", gender: "female", displayName: "Leda", description: "Tiniq va energik" },
  { name: "Zephyr", gender: "female", displayName: "Zephyr", description: "Yengil va nafis" },
  { name: "Callirrhoe", gender: "female", displayName: "Callirrhoe", description: "Jozibali va iliq" },
  { name: "Autonoe", gender: "female", displayName: "Autonoe", description: "Jonli va quvnoq" },
];

export const ALL_VOICES: VoiceOption[] = [...MALE_VOICES, ...FEMALE_VOICES];

const VOICE_PREFS_KEY = "talaba-ai-live-voice";

export function getSavedVoiceForGender(gender: "male" | "female"): string {
  if (typeof window === "undefined") return gender === "male" ? "Puck" : "Aoede";
  try {
    const raw = localStorage.getItem(VOICE_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (gender === "male" && parsed?.male && MALE_VOICES.some((v) => v.name === parsed.male)) {
        return parsed.male;
      }
      if (gender === "female" && parsed?.female && FEMALE_VOICES.some((v) => v.name === parsed.female)) {
        return parsed.female;
      }
    }
    const legacyKey = gender === "male" ? "talaba_live_voice_male" : "talaba_live_voice_female";
    const legacy = localStorage.getItem(legacyKey);
    if (gender === "male" && legacy && MALE_VOICES.some((v) => v.name === legacy)) {
      return legacy;
    }
    if (gender === "female" && legacy && FEMALE_VOICES.some((v) => v.name === legacy)) {
      return legacy;
    }
  } catch {
    // Ignore
  }
  return gender === "male" ? "Puck" : "Aoede";
}

export function persistVoiceForGender(gender: "male" | "female", voiceName: string) {
  if (typeof window === "undefined") return;
  try {
    let prefs: { male: string; female: string } = { male: "Puck", female: "Aoede" };
    const raw = localStorage.getItem(VOICE_PREFS_KEY);
    if (raw) {
      try {
        prefs = { ...prefs, ...JSON.parse(raw) };
      } catch {}
    }
    prefs[gender] = voiceName;
    localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));

    // Save backward-compatible keys
    if (gender === "male") {
      localStorage.setItem("talaba_live_voice_male", voiceName);
    } else {
      localStorage.setItem("talaba_live_voice_female", voiceName);
    }
    localStorage.setItem("talaba_live_voice", voiceName);
  } catch {
    // Ignore
  }
}

function normalizeBase64(str: string): string {
  let res = str.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  while (res.length % 4 !== 0) {
    res += "=";
  }
  return res;
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function bytesFromBase64(value: string): Uint8Array | null {
  try {
    const normalized = normalizeBase64(value);
    const binary = window.atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error("[Live] AUDIO DECODE ERROR:", err);
    return null;
  }
}

function toPcm16k(samples: Float32Array, inputSampleRate: number) {
  const outputLength = Math.floor((samples.length * 16000) / inputSampleRate);
  const output = new Int16Array(outputLength);
  const sampleRateRatio = inputSampleRate / 16000;

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = Math.min(Math.floor(i * sampleRateRatio), samples.length - 1);
    const sample = Math.max(-1, Math.min(1, samples[sourceIndex]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return new Uint8Array(output.buffer);
}

async function parseSocketMessage(data: any): Promise<any> {
  try {
    let text = "";
    if (typeof data === "string") {
      text = data;
    } else if (data instanceof ArrayBuffer) {
      text = new TextDecoder("utf-8").decode(data);
    } else if (data instanceof Blob) {
      text = await data.text();
    } else if (data && typeof data.text === "function") {
      text = await data.text();
    } else if (data && typeof data.arrayBuffer === "function") {
      const buf = await data.arrayBuffer();
      text = new TextDecoder("utf-8").decode(buf);
    } else {
      text = String(data);
    }
    if (!text || !text.trim()) return null;
    return JSON.parse(text);
  } catch (err) {
    console.error("[Live] Socket message parsing error:", err);
    return null;
  }
}

export default function LiveRoomModal({
  isOpen,
  onClose,
  initialRemainingSeconds,
  onSessionComplete,
}: LiveRoomModalProps) {
  const [liveState, setLiveState] = useState<LiveState>("SETUP");
  const [persona, setPersona] = useState<"olim" | "zilola">("olim");
  const [selectedGender, setSelectedGender] = useState<VoiceGender>("male");
  const [selectedVoice, setSelectedVoice] = useState<string>("Puck");
  const [mode, setMode] = useState<string>("casual");
  const [isMuted, setIsMuted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isChangingVoice, setIsChangingVoice] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    initialRemainingSeconds !== undefined ? initialRemainingSeconds : null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionEvaluation, setSessionEvaluation] = useState<any>(null);
  const [evaluatingResult, setEvaluatingResult] = useState(false);

  // Audio & WebSocket refs
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const isAiSpeakingRef = useRef<boolean>(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const speakingStartedAtRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef<number | null>(null);
  const lastVadLogTimeRef = useRef<number>(0);
  const lastInputLogTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);
  const isMutedRef = useRef(false);
  const endLiveCallRef = useRef<(() => void) | null>(null);

  isMutedRef.current = isMuted;

  useEffect(() => {
    if (initialRemainingSeconds !== undefined) {
      setRemainingSeconds(initialRemainingSeconds);
    }
  }, [initialRemainingSeconds]);

  // Load saved persona & voice preference
  useEffect(() => {
    try {
      const savedPersona = localStorage.getItem("talaba_live_persona");
      const activePersona: "olim" | "zilola" =
        savedPersona === "zilola" || savedPersona === "olim" ? savedPersona : "olim";
      setPersona(activePersona);

      const activeGender: VoiceGender = activePersona === "zilola" ? "female" : "male";
      setSelectedGender(activeGender);

      const voice = getSavedVoiceForGender(activeGender);
      setSelectedVoice(voice);
    } catch {
      // Ignore
    }
  }, []);

  // Timer runner & 30-second heartbeat runner with auto-disconnect when daily limit reaches 0
  useEffect(() => {
    if (
      liveState === "LISTENING" ||
      liveState === "USER_SPEAKING" ||
      liveState === "AI_SPEAKING"
    ) {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          setElapsedSeconds((s) => s + 1);
          setRemainingSeconds((prev) => {
            if (prev === null) return null;
            const next = prev - 1;
            if (next <= 0) {
              setTimeout(() => {
                endLiveCallRef.current?.();
              }, 50);
              return 0;
            }
            return next;
          });
        }, 1000);
      }

      // Send 30s heartbeat to track live duration and protect against double deduction
      if (!heartbeatIntervalRef.current) {
        heartbeatIntervalRef.current = setInterval(async () => {
          const sId = sessionIdRef.current;
          const tgId = localStorage.getItem("telegram_user_id");
          if (!sId || !tgId) return;

          try {
            const res = await fetch("/api/ai-chat/live-heartbeat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: sId,
                telegram_id: Number(tgId),
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.remainingSeconds !== undefined) {
                setRemainingSeconds(data.remainingSeconds);
              }
              if (data.limitReached) {
                setTimeout(() => {
                  endLiveCallRef.current?.();
                }, 100);
              }
            }
          } catch {
            // Non-fatal network glitch; next heartbeat or endLiveCall will sync
          }
        }, 30_000);
      }
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [liveState]);

  // Auto scroll transcript
  useEffect(() => {
    if (showTranscript) {
      transcriptScrollRef.current?.scrollTo({
        top: transcriptScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [transcript, showTranscript]);

  const stopPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((node) => {
      try {
        node.onended = null;
        node.stop();
      } catch {
        // Ignore already stopped
      }
    });
    activeSourcesRef.current = [];
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    isAiSpeakingRef.current = false;
  }, []);

  const drainAudioQueue = useCallback(async () => {
    const context = audioContextRef.current;
    if (!context || context.state === "closed") return;

    if (context.state === "suspended") {
      try {
        await context.resume();
        console.log(`[Live] AudioContext state=${context.state}`);
      } catch (e) {
        console.warn("[Live] Failed to resume AudioContext:", e);
      }
    }

    let outputGain = outputGainRef.current;
    if (!outputGain) {
      outputGain = context.createGain();
      outputGain.gain.value = 1.0;
      outputGain.connect(context.destination);
      outputGainRef.current = outputGain;
    }

    while (audioQueueRef.current.length > 0) {
      const buffer = audioQueueRef.current.shift();
      if (!buffer) continue;

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(outputGain);

      const now = context.currentTime;
      const startTime = Math.max(now + 0.015, nextPlayTimeRef.current);
      console.log(`[AUDIO] scheduled at t=${startTime.toFixed(3)}s (duration=${buffer.duration.toFixed(3)}s)`);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;

      activeSourcesRef.current.push(source);

      if (!isAiSpeakingRef.current) {
        isAiSpeakingRef.current = true;
        console.log("[AUDIO] playing");
        console.log("[Live] AUDIO PLAYING");
        setLiveState("AI_SPEAKING");
      }

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((n) => n !== source);
        console.log(`[AUDIO] source ended (remaining=${activeSourcesRef.current.length}, queued=${audioQueueRef.current.length})`);
        if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
          isAiSpeakingRef.current = false;
          console.log("[AUDIO] ended");
          console.log("[Live] AUDIO PLAYBACK ENDED");
          nextPlayTimeRef.current = 0;
          setLiveState((s) => (s === "ENDING" || s === "ERROR" || s === "RESULT" ? s : "LISTENING"));
        }
      };
    }
  }, []);

  const queuePcmAudio = useCallback(
    (base64: string, mimeType?: string) => {
      const context = audioContextRef.current;
      if (!context || context.state === "closed") return;

      const bytes = bytesFromBase64(base64);
      if (!bytes || bytes.length < 2) {
        console.warn("[Live] AUDIO DECODE ERROR: invalid or empty bytes");
        return;
      }

      console.log(`[AUDIO] received (${bytes.length} bytes)`);
      console.log("[Live] AUDIO CHUNK received");

      try {
        const sampleRateMatch = mimeType?.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;

        const numSamples = Math.floor(bytes.length / 2);
        const dataView = new DataView(bytes.buffer, bytes.byteOffset, numSamples * 2);

        const buffer = context.createBuffer(1, numSamples, sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < numSamples; i++) {
          channel[i] = dataView.getInt16(i * 2, true) / 32768;
        }

        console.log(`[AUDIO] decoded (${numSamples} samples)`);
        console.log("[Live] AUDIO DECODED");

        audioQueueRef.current.push(buffer);
        console.log(`[AUDIO] queued (queue length: ${audioQueueRef.current.length})`);
        console.log("[Live] AUDIO QUEUED");

        drainAudioQueue();
      } catch (err) {
        console.error("[Live] AudioBuffer conversion error:", err);
      }
    },
    [drainAudioQueue]
  );

  // Teardown connections
  const cleanupConnections = useCallback(() => {
    socketRef.current?.close();
    socketRef.current = null;

    processorRef.current?.disconnect();
    processorRef.current = null;

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    muteGainRef.current?.disconnect();
    muteGainRef.current = null;

    outputGainRef.current?.disconnect();
    outputGainRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    stopPlayback();

    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, [stopPlayback]);

  useEffect(() => {
    return () => cleanupConnections();
  }, [cleanupConnections]);

  // Start microphone stream
  const beginMicrophoneStream = useCallback((socket: WebSocket) => {
    const stream = streamRef.current;
    const context = audioContextRef.current;
    if (!stream || !context) return;

    try {
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(2048, 1, 1);
      const muteGain = context.createGain();
      muteGain.gain.value = 0; // CRITICAL: NEVER route microphone to speakers (eliminates echo loop)

      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(context.destination);

      sourceRef.current = source;
      processorRef.current = processor;
      muteGainRef.current = muteGain;

      console.log("[Live] MIC READY");

      processor.onaudioprocess = (event) => {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
        if (isMutedRef.current) return;

        const inputBuffer = event.inputBuffer.getChannelData(0);

        // VAD energy check
        let sumSquares = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sumSquares += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sumSquares / inputBuffer.length);

        const isSpeech = rms > 0.045;
        const now = Date.now();
        if (isSpeech) {
          if (!speakingStartedAtRef.current) {
            speakingStartedAtRef.current = now;
          }
          lastSpeechAtRef.current = now;
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
          if (!isAiSpeakingRef.current && activeSourcesRef.current.length === 0) {
            console.log("[Live] USER SPEAKING");
            setLiveState((s) => (s === "CONNECTING" || s === "ERROR" || s === "ENDING" || s === "RESULT" ? s : "USER_SPEAKING"));
          }
        } else {
          if (!silenceTimeoutRef.current && !isAiSpeakingRef.current && activeSourcesRef.current.length === 0) {
            silenceTimeoutRef.current = setTimeout(() => {
              silenceTimeoutRef.current = null;
              speakingStartedAtRef.current = null;
              lastSpeechAtRef.current = null;
              setLiveState((s) => (s === "USER_SPEAKING" ? "LISTENING" : s));
            }, 1200);
          }
        }

        if (now - lastVadLogTimeRef.current > 1500) {
          lastVadLogTimeRef.current = now;
          const silenceDuration = lastSpeechAtRef.current ? now - lastSpeechAtRef.current : 0;
          console.log(
            `[Live] RMS ${rms.toFixed(4)} (isSpeech=${isSpeech}, silenceDuration=${silenceDuration}ms)`
          );
        }

        const pcm = toPcm16k(inputBuffer, context.sampleRate);
        if (now - lastInputLogTimeRef.current > 1500) {
          lastInputLogTimeRef.current = now;
          console.log(`[Live] AUDIO INPUT chunk sent (${pcm.byteLength} bytes)`);
        }

        socketRef.current.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64FromBytes(pcm),
                },
              ],
            },
          })
        );
      };
    } catch (err) {
      console.error("Microphone processing error:", err);
    }
  }, [liveState]);

  // Launch live session
  const startLiveSession = async () => {
    console.log("[Live] CONNECTING");
    setLiveState("CONNECTING");
    setErrorMessage("");
    setTranscript([]);
    setElapsedSeconds(0);

    try {
      const gender: VoiceGender = persona === "zilola" ? "female" : "male";
      const activeVoice = getSavedVoiceForGender(gender);
      setSelectedVoice(activeVoice);
      setSelectedGender(gender);

      // Save persona & voice preference
      localStorage.setItem("talaba_live_persona", persona);
      localStorage.setItem("talaba_live_gender", gender);
      persistVoiceForGender(gender, activeVoice);

      // 1. Initialize AudioContext synchronously during user click to satisfy autoplay policy
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      let context = audioContextRef.current;
      if (!context || context.state === "closed") {
        context = new AudioCtx({ sampleRate: 24000 });
        audioContextRef.current = context;
      }
      if (context.state === "suspended") {
        await context.resume();
      }
      console.log(`[Live] AudioContext state=${context.state}`);

      const outputGain = context.createGain();
      outputGain.gain.value = 1.0;
      outputGain.connect(context.destination);
      outputGainRef.current = outputGain;

      // 2. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log("[Live] MIC SETTINGS", {
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        });
      }

      if (context.state === "suspended") {
        await context.resume();
      }

      console.log("[Live] VOICE SELECTED:", {
        gender,
        voiceName: activeVoice,
      });

      // 3. Request constrained ephemeral token from backend
      const tgId = localStorage.getItem("telegram_user_id");
      const tokenRes = await fetch("/api/ai-chat/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          mode,
          gender,
          voice: activeVoice,
          voiceName: activeVoice,
          telegram_id: tgId ? Number(tgId) : undefined,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Ovozli sessiya tokenini olib bo'lmadi.");
      }

      if (tokenData.remainingSeconds !== undefined) {
        setRemainingSeconds(tokenData.remainingSeconds);
      }
      sessionIdRef.current = tokenData.sessionId || null;

      // 4. Connect WebSocket with token
      const socket = new WebSocket(
        `${LIVE_SOCKET_URL}?access_token=${encodeURIComponent(tokenData.token)}`
      );
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[Live] WS OPEN");
        console.log("[Live] GEMINI VOICE CONFIG:", {
          voiceName: tokenData.voiceName,
        });
        const setupPayload: any = {
          setup: {
            model: `models/${tokenData.model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: tokenData.voiceName,
                  },
                },
              },
            },
            ...(tokenData.realtimeInputConfig
              ? { realtimeInputConfig: tokenData.realtimeInputConfig }
              : {}),
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: tokenData.systemInstruction }],
            },
          },
        };
        console.log("[Live] SETUP SENT");
        socket.send(JSON.stringify(setupPayload));
      };

      socket.onmessage = async (event) => {
        try {
          const response = await parseSocketMessage(event.data);
          if (!response) return;

          if (response.error) {
            console.error("[Live] ERROR from server:", response.error);
            setErrorMessage(response.error.message || "Live sessiyada xatolik yuz berdi.");
            setLiveState("ERROR");
            return;
          }

          if (response.setupComplete) {
            console.log("[Live] SETUP COMPLETE");
            beginMicrophoneStream(socket);
            setLiveState("LISTENING");
            return;
          }

          const content = response.serverContent;
          if (!content) {
            console.log("[Live] NO AUDIO IN SERVER MESSAGE");
            return;
          }

          // Barge-in interruption from server
          if (content.interrupted) {
            console.log("[Live] SERVER INTERRUPTION");
            stopPlayback();
            setLiveState("USER_SPEAKING");
          }

          // User live transcription
          if (content.inputTranscription?.text) {
            const text = content.inputTranscription.text.trim();
            if (text) {
              setTranscript((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "user") {
                  return [...prev.slice(0, -1), { role: "user", text: `${last.text} ${text}` }];
                }
                return [...prev, { role: "user", text }];
              });
            }
          }

          // AI live transcription
          if (content.outputTranscription?.text) {
            const text = content.outputTranscription.text.trim();
            if (text) {
              setTranscript((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant") {
                  return [...prev.slice(0, -1), { role: "assistant", text: `${last.text} ${text}` }];
                }
                return [...prev, { role: "assistant", text }];
              });
            }
          }

          // Audio output stream
          let hasAudio = false;
          if (content.modelTurn?.parts) {
            content.modelTurn.parts.forEach((part: any) => {
              if (part.inlineData?.data) {
                hasAudio = true;
                const mime = part.inlineData.mimeType || "audio/pcm;rate=24000";
                console.log("[Live] AUDIO CHUNK received");
                queuePcmAudio(part.inlineData.data, mime);
              }
              if (part.text && !content.outputTranscription?.text) {
                const partText = part.text.trim();
                if (partText) {
                  setTranscript((prev) => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === "assistant") {
                      return [...prev.slice(0, -1), { role: "assistant", text: `${last.text} ${partText}` }];
                    }
                    return [...prev, { role: "assistant", text: partText }];
                  });
                }
              }
            });
          }

          if (!hasAudio && !content.inputTranscription && !content.outputTranscription && !content.turnComplete && !content.interrupted && !content.waitingForInput) {
            console.log("[Live] NO AUDIO IN SERVER MESSAGE");
          }

          if (content.turnComplete) {
            console.log("[Live] TURN COMPLETE", content.turnCompleteReason ? `reason=${content.turnCompleteReason}` : "");
            if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
              setLiveState("LISTENING");
            }
          }

          if (content.waitingForInput) {
            console.log("[Live] WAITING FOR INPUT");
            if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
              setLiveState("LISTENING");
            }
          }
        } catch (e) {
          console.error("Socket message parsing error:", e);
        }
      };

      socket.onerror = (e) => {
        console.error("[Live] Connection failed (onerror):", e);
        setErrorMessage("⚠️ Jonli suhbatga ulanib bo‘lmadi. Qayta urinib ko‘ring.");
        setLiveState("ERROR");
      };

      socket.onclose = (e) => {
        console.warn(`[Live] WS CLOSE code=${e.code} reason=${e.reason}`);
        if (socketRef.current === socket) {
          socketRef.current = null;

          // Stop sending mic data immediately
          if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
          }
          if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
          }
          if (muteGainRef.current) {
            muteGainRef.current.disconnect();
            muteGainRef.current = null;
          }

          if (e.code === 1000 || e.code === 1005) {
            // Normal closure - Wait for playback to finish before ending session
            const checkQueue = setInterval(() => {
              if (activeSourcesRef.current.length === 0 && audioQueueRef.current.length === 0) {
                clearInterval(checkQueue);
                setLiveState((s) => {
                  if (s !== "ENDING" && s !== "RESULT") {
                    setTimeout(() => endLiveCallRef.current?.(), 100);
                  }
                  return s;
                });
              }
            }, 300);
          } else if (e.code === 1011) {
            cleanupConnections();
            setLiveState("ERROR");
            setErrorMessage("⚠️ Gemini Live xizmati vaqtincha band yoki mavjud emas. Birozdan so'ng qayta urinib ko‘ring.");
          } else {
            cleanupConnections();
            setLiveState((s) => {
              if (s === "RESULT" || s === "ENDING") return s;
              setErrorMessage(
                e.reason || "⚠️ Jonli suhbatga ulanib bo‘lmadi. Qayta urinib ko‘ring."
              );
              return "ERROR";
            });
          }
        }
      };
    } catch (err: any) {
      console.error("[Live] Connection failed:", err);
      cleanupConnections();
      setErrorMessage(err?.message || "⚠️ Jonli suhbatga ulanib bo‘lmadi. Qayta urinib ko‘ring.");
      setLiveState("ERROR");
    }
  };

  // End the live call and generate evaluation result
  const endLiveCall = async () => {
    console.log("[Live] MANUAL END");
    setLiveState("ENDING");
    const currentTranscript = [...transcript];
    const duration = elapsedSeconds;

    cleanupConnections();

    // Trigger post-session analysis
    setEvaluatingResult(true);
    setLiveState("RESULT");

    try {
      const tgId = localStorage.getItem("telegram_user_id");
      const res = await fetch("/api/ai-chat/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          persona,
          session_id: sessionIdRef.current || undefined,
          durationSeconds: duration,
          transcript: currentTranscript,
          telegram_id: tgId ? Number(tgId) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSessionEvaluation(data.evaluation);
        if (data.remainingSeconds !== undefined) {
          setRemainingSeconds(data.remainingSeconds);
          onSessionComplete?.(data.remainingSeconds);
        } else {
          onSessionComplete?.();
        }
      }
    } catch (err) {
      console.error("Failed to generate session evaluation:", err);
      onSessionComplete?.();
    } finally {
      setEvaluatingResult(false);
    }
  };

  endLiveCallRef.current = endLiveCall;

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleUserInteractionUnlock = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().then(() => {
        console.log(`[Live] AudioContext state=${audioContextRef.current?.state}`);
      }).catch(() => undefined);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div
      onClick={handleUserInteractionUnlock}
      onTouchStart={handleUserInteractionUnlock}
      className="fixed inset-0 z-50 flex flex-col h-screen w-screen bg-[#070c14] text-slate-100 overflow-hidden select-none"
    >
      {/* ── STAGE 1: PERSONA & MODE SETUP ── */}
      {liveState === "SETUP" && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-cyan-500/25 bg-[#0f1724] p-5 sm:p-7 shadow-2xl relative">
            <div className="absolute top-5 right-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSettings(true);
                  setIsChangingVoice(false);
                  setVoiceNotice(null);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                title="Sozlamalar"
              >
                ⚙️
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                title="Yopish"
              >
                ✕
              </button>
            </div>

            <div className="text-center mb-6">
              <div className="mx-auto mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 text-2xl shadow-lg shadow-cyan-500/20">
                🎙️
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Jonli Ovozli Suhbat</h2>
              <p className="text-xs text-slate-400 mt-1">
                Gemini Live orqali real vaqtda, ikki tomonlama uzluksiz ovozli muloqot
              </p>
            </div>

            {/* 1. Persona Selection */}
            <div className="mb-5">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
                1. Mentor tanlang:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPersona("olim");
                    setSelectedGender("male");
                    const maleVoice = getSavedVoiceForGender("male");
                    setSelectedVoice(maleVoice);
                    try {
                      localStorage.setItem("talaba_live_persona", "olim");
                      localStorage.setItem("talaba_live_gender", "male");
                    } catch {}
                  }}
                  className={`rounded-2xl p-3.5 text-left border transition active:scale-95 ${
                    persona === "olim"
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/15"
                      : "bg-[#162232] border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-2xl block mb-1">👨</span>
                  <span className="font-bold text-sm text-cyan-300 block">Olim Ustoz</span>
                  <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                    Akademik, muloyim, sokin
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPersona("zilola");
                    setSelectedGender("female");
                    const femaleVoice = getSavedVoiceForGender("female");
                    setSelectedVoice(femaleVoice);
                    try {
                      localStorage.setItem("talaba_live_persona", "zilola");
                      localStorage.setItem("talaba_live_gender", "female");
                    } catch {}
                  }}
                  className={`rounded-2xl p-3.5 text-left border transition active:scale-95 ${
                    persona === "zilola"
                      ? "bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/15"
                      : "bg-[#162232] border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-2xl block mb-1">👩</span>
                  <span className="font-bold text-sm text-cyan-300 block">Zilola Mentor</span>
                  <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">
                    Do‘stona, energik, tezkor
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Mode Selection */}
            <div className="mb-6">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
                2. Suhbat rejimi:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "casual", label: "🗣️ Erkin suhbat", desc: "Darslar, talabalik va kundalik savol-javob" },
                  { id: "ielts", label: "🇬🇧 IELTS Speaking", desc: "Speaking Examiner bilan Parts 1, 2, 3 mashg‘uloti" },
                  { id: "exam", label: "🎓 Og‘zaki imtihon", desc: "Professor bilan fan bo‘yicha nazariy tekshiruv" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMode(m.id);
                      try { localStorage.setItem("talaba_live_mode", m.id); } catch {}
                    }}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left border transition active:scale-98 ${
                      mode === m.id
                        ? "bg-cyan-500/15 border-cyan-400 text-cyan-200"
                        : "bg-[#141e2b] border-slate-800 text-slate-300 hover:bg-[#1a2738]"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-xs sm:text-sm">{m.label}</p>
                      <p className="text-[11px] text-slate-400">{m.desc}</p>
                    </div>
                    {mode === m.id && <span className="text-cyan-400 text-sm font-black">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {remainingSeconds !== null && remainingSeconds <= 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center">
                  <p className="text-xs font-bold text-amber-200">
                    ⏳ Bugungi jonli suhbat limitingiz tugagan.
                  </p>
                  <p className="text-[11px] text-amber-300/80 mt-1">
                    Har kuni 00:00 da yangilanadi. Cheklovsiz suhbat uchun Premium tarifga o'tishingiz mumkin.
                  </p>
                </div>
                <a
                  href="/premium"
                  className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-sm font-black text-slate-950 hover:from-amber-300 hover:to-amber-400 transition active:scale-95 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <span>⭐ Premium tarifga o'tish</span>
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={startLiveSession}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-400 py-3.5 text-sm font-black text-slate-950 hover:from-cyan-300 hover:to-sky-300 transition active:scale-95 shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2"
              >
                <span>🎙️ Suhbatni boshlash</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STAGE 2: FULLSCREEN IMMERSIVE LIVE ROOM ── */}
      {(liveState === "CONNECTING" ||
        liveState === "LISTENING" ||
        liveState === "USER_SPEAKING" ||
        liveState === "AI_SPEAKING" ||
        liveState === "ENDING" ||
        liveState === "ERROR") && (
        <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 max-w-4xl mx-auto w-full">
          {/* Top Bar */}
          <header className="w-full flex items-center justify-between rounded-2xl bg-[#0f1725]/80 border border-slate-800/80 px-4 py-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={endLiveCall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition active:scale-95 text-xs font-bold"
              >
                <span>←</span>
                <span>Chiqish</span>
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xl">{persona === "zilola" ? "👩" : "👨"}</span>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-white">
                    {persona === "zilola" ? "Zilola Mentor" : "Olim Ustoz"}
                  </h3>
                  <span className="text-[10px] text-cyan-400 capitalize font-medium block">
                    {mode === "ielts" ? "IELTS Speaking" : mode === "exam" ? "Og'zaki imtihon" : "Erkin suhbat"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Jonli efir</span>
              </div>

              {remainingSeconds !== null && (
                <div
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-mono font-bold ${
                    remainingSeconds <= 120
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                      : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                  }`}
                >
                  <span>🎤 {formatTimer(remainingSeconds)} qoldi</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1 font-mono text-xs font-bold text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>

              {/* Settings Button */}
              <button
                type="button"
                onClick={() => {
                  setShowSettings(true);
                  setIsChangingVoice(false);
                  setVoiceNotice(null);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-700 transition active:scale-95 text-xs font-bold"
                title="Sozlamalar"
              >
                <span>⚙️</span>
                <span className="hidden sm:inline">Sozlamalar</span>
              </button>
            </div>
          </header>

          {/* 1-Minute Warning Banner */}
          {remainingSeconds !== null && remainingSeconds <= 60 && remainingSeconds > 0 && (
            <div className="mx-auto mt-2.5 inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-3 py-1 text-xs font-bold text-amber-300 animate-pulse">
              <span>⏳ Suhbat tugashiga 1 daqiqa qoldi</span>
            </div>
          )}

          {/* Center: Glowing Animated Orb & State Visualization */}
          <div className="my-auto flex flex-col items-center justify-center py-6 sm:py-10 text-center">
            <div className="relative flex items-center justify-center mb-8">
              {/* Outer Ambient Glow Blobs */}
              <div className={`absolute h-72 w-72 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
                liveState === "AI_SPEAKING"
                  ? "bg-cyan-500/25 scale-125"
                  : liveState === "USER_SPEAKING"
                  ? "bg-emerald-500/25 scale-110"
                  : "bg-cyan-500/10 scale-90"
              }`} />

              {/* Concentric Animated Wave Rings */}
              {liveState === "AI_SPEAKING" && (
                <>
                  <div className="absolute h-56 w-56 rounded-full border border-cyan-400/30 animate-ping duration-1000" />
                  <div className="absolute h-64 w-64 rounded-full border border-sky-400/20 animate-pulse duration-700" />
                </>
              )}
              {liveState === "USER_SPEAKING" && (
                <div className="absolute h-56 w-56 rounded-full border border-emerald-400/40 animate-ping duration-1000" />
              )}

              {/* Central Glowing Orb with Avatar */}
              <style>{`
                @keyframes avatar-float {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(-6px); }
                }
                .animate-avatar-float {
                  animation: avatar-float 3s ease-in-out infinite;
                }
                @keyframes avatar-pulse-fast {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.15); }
                }
                .animate-avatar-pulse-fast {
                  animation: avatar-pulse-fast 0.8s ease-in-out infinite;
                }
                @keyframes avatar-pulse-slow {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.05); }
                }
                .animate-avatar-pulse-slow {
                  animation: avatar-pulse-slow 1.5s ease-in-out infinite;
                }
              `}</style>
              <div
                className={`relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full transition-all duration-300 shadow-2xl ${
                  liveState === "AI_SPEAKING"
                    ? "bg-gradient-to-tr from-cyan-400 via-sky-500 to-indigo-600 scale-110 shadow-[0_0_60px_rgba(6,182,212,0.45)]"
                    : liveState === "USER_SPEAKING"
                    ? "bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500 scale-105 shadow-[0_0_50px_rgba(16,185,129,0.4)]"
                    : liveState === "CONNECTING"
                    ? "bg-gradient-to-tr from-slate-700 to-slate-800 animate-pulse shadow-none"
                    : "bg-gradient-to-tr from-[#142337] via-[#1b2d45] to-[#101b2a] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                }`}
              >
                {/* Avatar inside orb */}
                <div
                  className={`text-6xl sm:text-7xl transition-all duration-300 flex items-center justify-center select-none ${
                    liveState === "AI_SPEAKING" 
                      ? "animate-avatar-pulse-fast drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" 
                      : liveState === "USER_SPEAKING"
                      ? "animate-avatar-pulse-slow"
                      : liveState === "CONNECTING"
                      ? "opacity-50 grayscale"
                      : "animate-avatar-float drop-shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                  }`}
                >
                  {persona === "zilola" ? "👩‍🏫" : "👨‍🏫"}
                </div>
              </div>
            </div>

            {/* State Text & Feedback */}
            <p className="font-black text-base sm:text-lg text-white tracking-wide uppercase">
              {liveState === "CONNECTING" && "Ulanmoqda..."}
              {liveState === "LISTENING" && "Tinglayapman — bemalol gapiring"}
              {liveState === "USER_SPEAKING" && "Siz gapiryapsiz..."}
              {liveState === "AI_SPEAKING" && `${persona === "zilola" ? "Zilola" : "Olim"} gapirmoqda`}
              {liveState === "ENDING" && "Suhbat yakunlanmoqda..."}
              {liveState === "ERROR" && "Ulanishda xatolik"}
            </p>

            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {liveState === "AI_SPEAKING"
                ? "(Istalgan vaqtda bemalol gapiring — AI darhol so‘zini to‘xtatadi)"
                : liveState === "USER_SPEAKING"
                ? "Ovozingiz qabul qilinmoqda..."
                : "Mikrofonga erkin gapirishingiz mumkin"}
            </p>

            {/* Current Voice Badge with Quick Settings Action */}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#141f2d]/90 border border-slate-700/70 px-3.5 py-1.5 text-xs text-slate-300 shadow-sm backdrop-blur-sm">
              <span className="text-slate-400">Ovoz:</span>
              <span className="font-bold text-cyan-300">{selectedVoice}</span>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => {
                  setShowSettings(true);
                  setIsChangingVoice(true);
                  setVoiceNotice(null);
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] underline underline-offset-2 transition active:scale-95"
              >
                Almashtirish
              </button>
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Real-time Transcript Drawer (collapsible) */}
          {showTranscript && (
            <div
              ref={transcriptScrollRef}
              className="w-full mb-4 max-h-48 overflow-y-auto rounded-2xl bg-[#0b121c]/95 border border-slate-800/90 p-4 text-xs space-y-2.5 shadow-2xl"
            >
              {transcript.length === 0 ? (
                <p className="text-slate-500 italic text-center">Transkript suhbat davomida real vaqtda yoziladi...</p>
              ) : (
                transcript.map((item, idx) => (
                  <div key={idx} className={item.role === "user" ? "text-cyan-300" : "text-slate-200"}>
                    <span className="font-bold text-[10px] uppercase tracking-wider block opacity-70 mb-0.5">
                      {item.role === "user" ? "Siz" : `${persona === "zilola" ? "Zilola" : "Olim"}`}
                    </span>
                    <p className="leading-relaxed">{item.text}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Bottom Controls Bar */}
          {liveState === "ERROR" ? (
            <footer className="w-full flex items-center justify-center gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={startLiveSession}
                className="flex h-12 px-6 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-sky-500 hover:from-cyan-300 hover:to-sky-400 text-slate-950 font-extrabold text-sm transition active:scale-95 shadow-lg shadow-cyan-500/25 gap-2"
              >
                <span>🔄</span>
                <span>Qayta urinish</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  cleanupConnections();
                  setLiveState("SETUP");
                }}
                className="flex h-12 px-5 items-center justify-center rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition active:scale-95 border border-slate-700 gap-2"
              >
                <span>←</span>
                <span>Sozlamalarga qaytish</span>
              </button>
            </footer>
          ) : (
            <footer className="w-full flex items-center justify-center gap-4 pt-4 border-t border-slate-800/80">
              {/* Mute Toggle */}
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition active:scale-95 text-xl ${
                  isMuted
                    ? "bg-rose-500/20 border-rose-500 text-rose-300"
                    : "bg-[#141f2d] border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                }`}
                title={isMuted ? "Mikrofonni yoqish" : "Mikrofonni o'chirish"}
              >
                {isMuted ? "🔇" : "🎙️"}
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={endLiveCall}
                className="flex h-12 px-7 items-center justify-center rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm transition active:scale-95 shadow-lg shadow-rose-600/30 gap-2"
              >
                <span>🔴</span>
                <span>Yakunlash</span>
              </button>

              {/* Transcript Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition active:scale-95 text-xl ${
                  showTranscript
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                    : "bg-[#141f2d] border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white"
                }`}
                title="Transkriptni ko'rish"
              >
                📝
              </button>
            </footer>
          )}
        </div>
      )}

      {/* ── STAGE 3: SESSION EVALUATION RESULT ── */}
      {liveState === "RESULT" && (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl border border-cyan-500/30 bg-[#121c2b] p-6 shadow-2xl my-auto max-h-[85vh] overflow-y-auto">
            <div className="text-center mb-5">
              <span className="text-3xl block mb-1">📊</span>
              <h2 className="text-lg sm:text-xl font-black text-white">Suhbat Natijasi va Tahlili</h2>
              <p className="text-xs text-slate-400">
                Davomiyligi: {formatTimer(elapsedSeconds)} • Rejim: {mode}
              </p>
            </div>

            {evaluatingResult ? (
              <div className="py-10 text-center space-y-3">
                <div className="mx-auto h-8 w-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-cyan-300">
                  Suhbatingiz tahlil qilinmoqda va baholanmoqda...
                </p>
              </div>
            ) : sessionEvaluation ? (
              <div className="space-y-4 text-xs">
                {/* IELTS SPECIFIC RESULT */}
                {mode === "ielts" && (
                  <div>
                    <div className="rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-sky-500/20 border border-cyan-400/40 p-4 text-center mb-3">
                      <span className="text-3xl font-black text-cyan-300 block">
                        Band {sessionEvaluation.estimatedBand || "6.5"}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-cyan-400 font-bold">
                        *AI estimated score (Rasmiy IELTS emas)
                      </span>
                    </div>

                    {sessionEvaluation.criteria && (
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-[#182537] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">Fluency:</span>
                          <strong className="text-white text-sm">{sessionEvaluation.criteria.fluency}</strong>
                        </div>
                        <div className="bg-[#182537] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">Grammar:</span>
                          <strong className="text-white text-sm">{sessionEvaluation.criteria.grammar}</strong>
                        </div>
                        <div className="bg-[#182537] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">Vocabulary:</span>
                          <strong className="text-white text-sm">{sessionEvaluation.criteria.vocabulary}</strong>
                        </div>
                        <div className="bg-[#182537] p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-400 text-[10px] block">Pronunciation:</span>
                          <strong className="text-white text-sm">{sessionEvaluation.criteria.pronunciation}</strong>
                        </div>
                      </div>
                    )}

                    {sessionEvaluation.grammarCorrections?.length > 0 && (
                      <div className="rounded-2xl border border-slate-800 bg-[#172230] p-3 space-y-1.5 mb-3">
                        <strong className="text-cyan-300 block">Grammatika tuzatishlari:</strong>
                        {sessionEvaluation.grammarCorrections.map((c: any, i: number) => (
                          <div key={i} className="text-[11px] pb-1 border-b border-slate-800 last:border-none">
                            <p className="text-rose-300 line-through">{c.original}</p>
                            <p className="text-emerald-300 font-bold">{c.corrected}</p>
                            {c.rule && <p className="text-slate-400 text-[10px]">{c.rule}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* INTERVIEW SPECIFIC RESULT */}
                {mode === "interview" && (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/30 p-3 text-center">
                      <span className="text-2xl font-black text-cyan-300 block">
                        {sessionEvaluation.overallScore || "85%"}
                      </span>
                      <p className="text-slate-300 font-bold text-xs">Interview Natijasi</p>
                    </div>

                    {sessionEvaluation.recommendations && (
                      <div className="bg-[#182537] p-3 rounded-2xl border border-slate-800">
                        <strong className="text-cyan-300 block mb-1">Tavsiyalar:</strong>
                        <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                          {Array.isArray(sessionEvaluation.recommendations)
                            ? sessionEvaluation.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)
                            : <li>{sessionEvaluation.recommendations}</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* EXAM / CASUAL SUMMARY */}
                {mode !== "ielts" && mode !== "interview" && (
                  <div className="space-y-3">
                    <div className="bg-[#182537] p-3.5 rounded-2xl border border-slate-800 leading-relaxed text-slate-200">
                      <strong className="text-cyan-300 block mb-1">Xulosa:</strong>
                      {sessionEvaluation.summary || sessionEvaluation.recommendations || "Suhbat muvaffaqiyatli o'tkazildi."}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-4">
                Suhbat yakunlandi. Natijalar ko‘rsatilmoqda.
              </p>
            )}

            {remainingSeconds !== null && remainingSeconds <= 0 && (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-center">
                <p className="text-xs font-bold text-amber-300">
                  ⏳ Bugungi jonli suhbat limitingiz (20 daqiqa) tugadi
                </p>
                <p className="text-[11px] text-amber-200/80 mt-1 mb-2.5">
                  Kunlik limit har kecha 00:00 da yangilanadi. Ko'proq gaplashish uchun Premium tarifga o'ting:
                </p>
                <a
                  href="/premium"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2 text-xs font-black text-slate-950 hover:from-amber-300 hover:to-amber-400 transition active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  ⭐ Premium tariflarni ko'rish
                </a>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSessionEvaluation(null);
                  setTranscript([]);
                  setElapsedSeconds(0);
                  setLiveState("SETUP");
                  onClose();
                }}
                className="flex-1 rounded-2xl bg-cyan-400 py-3 text-xs font-black text-slate-950 hover:bg-cyan-300 transition"
              >
                Yopish
              </button>
              <button
                type="button"
                onClick={() => {
                  setSessionEvaluation(null);
                  setTranscript([]);
                  setElapsedSeconds(0);
                  setLiveState("SETUP");
                }}
                className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
              >
                Qayta suhbat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL / DRAWER (Voice UX) ── */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#101926] p-5 sm:p-6 shadow-2xl text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-extrabold text-base text-white">Sozlamalar</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  setIsChangingVoice(false);
                  setVoiceNotice(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="py-4 space-y-4">
              {/* Mentor info */}
              <div className="flex items-center justify-between rounded-2xl bg-[#162232] border border-slate-800 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{persona === "zilola" ? "👩" : "👨"}</span>
                  <div>
                    <p className="font-bold text-xs sm:text-sm text-white">
                      {persona === "zilola" ? "Zilola Mentor" : "Olim Ustoz"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {persona === "zilola" ? "Ayol mentor ovozlari" : "Erkak mentor ovozlari"}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-cyan-400 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  {mode === "ielts" ? "IELTS" : mode === "exam" ? "Imtihon" : "Erkin"}
                </span>
              </div>

              {/* Current Voice */}
              <div className="rounded-2xl bg-[#141e2b] border border-slate-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Ovoz (Voice)
                  </span>
                  <span className="text-[11px] text-cyan-400 font-bold">
                    {selectedVoice}
                  </span>
                </div>

                {(() => {
                  const currentVoiceObj = (persona === "zilola" ? FEMALE_VOICES : MALE_VOICES).find(
                    (v) => v.name === selectedVoice
                  ) || (persona === "zilola" ? FEMALE_VOICES[0] : MALE_VOICES[0]);
                  return (
                    <div className="flex items-center justify-between rounded-xl bg-[#0e1724] p-3 border border-slate-700/60">
                      <div>
                        <p className="font-bold text-sm text-cyan-300">{currentVoiceObj.displayName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{currentVoiceObj.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsChangingVoice(!isChangingVoice)}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-400/40 transition active:scale-95"
                      >
                        {isChangingVoice ? "Yopish" : "Ovoz almashtirish"}
                      </button>
                    </div>
                  );
                })()}

                {voiceNotice && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-center text-xs text-emerald-300">
                    {voiceNotice}
                  </div>
                )}
              </div>

              {/* Voice Selector Grid (Filtered strictly by mentor gender) */}
              {isChangingVoice && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    {persona === "zilola" ? "👩 AYOL OVOZLARI (6 ta)" : "👨 ERKAK OVOZLARI (6 ta)"}:
                  </p>

                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {(persona === "zilola" ? FEMALE_VOICES : MALE_VOICES).map((v) => {
                      const isSelected = selectedVoice === v.name;
                      return (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => {
                            setSelectedVoice(v.name);
                            const gender: VoiceGender = persona === "zilola" ? "female" : "male";
                            persistVoiceForGender(gender, v.name);
                            console.log("[Live Settings] Voice saved:", v.name, "for gender:", gender);
                            setVoiceNotice(`✓ Saqlandi: "${v.name}" ovozi keyingi suhbatdan boshlab qo'llanadi.`);
                          }}
                          className={`rounded-xl p-2.5 text-left border transition active:scale-95 ${
                            isSelected
                              ? "bg-cyan-500/25 border-cyan-400 text-white shadow-md shadow-cyan-500/20 ring-1 ring-cyan-400/50"
                              : "bg-[#141e2b] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-[#182637]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-cyan-300">{v.displayName}</span>
                            {isSelected && <span className="text-cyan-400 text-xs font-black">✓</span>}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 leading-tight">
                            {v.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSettings(false);
                  setIsChangingVoice(false);
                  setVoiceNotice(null);
                }}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition active:scale-95"
              >
                Tayyor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
