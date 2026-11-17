import type { CourtRole, TtsEngine, VoiceProfileId } from './types';

let audioCtx: AudioContext | null = null;
let isMuted = false;
let activeAudioEl: HTMLAudioElement | null = null;
let activeTtsAbort: AbortController | null = null;

export interface VoiceProfileMeta {
  id: VoiceProfileId;
  label: string;
  description: string;
  browserPitch: number;
  browserRate: number;
}

export const VOICE_PROFILE_OPTIONS: VoiceProfileMeta[] = [
  {
    id: 'Charon',
    label: 'Charon – Dyb Retspræsident',
    description: 'Dyb, rolig og autoritativ stemme til retsledelse.',
    browserPitch: 0.82,
    browserRate: 0.94,
  },
  {
    id: 'Fenrir',
    label: 'Fenrir – Fast & Gennemslagskraftig',
    description: 'Markant og beslutsom tone til skarp procedure.',
    browserPitch: 0.9,
    browserRate: 1.01,
  },
  {
    id: 'Kore',
    label: 'Kore – Klar & Velartikuleret',
    description: 'Tydelig, saglig og analytisk retssalsstemme.',
    browserPitch: 1.06,
    browserRate: 1.0,
  },
  {
    id: 'Puck',
    label: 'Puck – Skarp & Spørgelysten',
    description: 'Hurtig og energisk tone ideel til krydsforhør.',
    browserPitch: 1.12,
    browserRate: 1.06,
  },
  {
    id: 'Zephyr',
    label: 'Zephyr – Rolig & Afbalanceret',
    description: 'Behersket og diplomatisk stemmeføring.',
    browserPitch: 0.98,
    browserRate: 0.97,
  },
];

function getVoiceProfileMeta(id?: VoiceProfileId): VoiceProfileMeta {
  return VOICE_PROFILE_OPTIONS.find((v) => v.id === id) ?? VOICE_PROFILE_OPTIONS[2];
}

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  if (muted) stopSpeaking();
}

export function getAudioMuted(): boolean {
  return isMuted;
}

/** Procedural Web Audio API sound effects (zero external assets) */
export function playSoundEffect(
  kind: 'gavel' | 'objection' | 'paper' | 'credit' | 'verdict' | 'click'
) {
  if (isMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (kind === 'gavel') {
    const strikeAt = (offset: number, strength: number) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(165, t);
      osc.frequency.exponentialRampToValueAtTime(52, t + 0.14);
      gain.gain.setValueAtTime(0.42 * strength, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.21);

      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'sine';
      snap.frequency.setValueAtTime(520, t);
      snap.frequency.exponentialRampToValueAtTime(180, t + 0.05);
      snapGain.gain.setValueAtTime(0.22 * strength, t);
      snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      snap.connect(snapGain).connect(ctx.destination);
      snap.start(t);
      snap.stop(t + 0.07);
    };
    // Match the 3D gavel strike timings (~0.09s and ~0.33s)
    strikeAt(0.09, 0.9);
    strikeAt(0.33, 1.0);
  } else if (kind === 'objection') {
    [330, 440, 554].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.02);
      gain.gain.setValueAtTime(0.08, now + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.02);
      osc.stop(now + 0.31);
    });
  } else if (kind === 'paper') {
    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
  } else if (kind === 'credit') {
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.14, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.26);
    });
  } else if (kind === 'verdict') {
    [261.63, 329.63, 392.0, 523.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.18, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.46);
    });
  } else if (kind === 'click') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }
}

const ROLE_VOICE_PROFILE: Record<CourtRole, { pitch: number; rateMultiplier: number }> = {
  Dommer: { pitch: 0.86, rateMultiplier: 0.94 },
  Anklager: { pitch: 1.04, rateMultiplier: 1.03 },
  Forsvarer: { pitch: 0.96, rateMultiplier: 0.99 },
  Tiltalte: { pitch: 1.08, rateMultiplier: 1.02 },
  Vidne: { pitch: 1.12, rateMultiplier: 0.98 },
  Folket: { pitch: 1.0, rateMultiplier: 1.0 },
};

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getDanishVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  const voices = window.speechSynthesis.getVoices();
  const danish = voices.filter((v) => v.lang.toLowerCase().startsWith('da'));
  return danish.length > 0 ? danish : voices.slice(0, 6);
}

export function stopSpeaking(): void {
  if (activeTtsAbort) {
    activeTtsAbort.abort();
    activeTtsAbort = null;
  }
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.src = '';
    } catch {
      // ignore
    }
    activeAudioEl = null;
  }
  if (!isTTSSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

export function speakLine(
  text: string,
  role: CourtRole,
  options?: {
    rate?: number;
    voiceURI?: string;
    voiceProfileId?: VoiceProfileId;
    ttsEngine?: TtsEngine;
    onStart?: () => void;
    onEnd?: () => void;
  }
): void {
  if (isMuted || !text.trim()) {
    options?.onEnd?.();
    return;
  }

  stopSpeaking();

  const chosenProfileMeta = options?.voiceProfileId
    ? getVoiceProfileMeta(options.voiceProfileId)
    : null;

  const speakBrowserFallback = () => {
    if (!isTTSSupported()) {
      options?.onEnd?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const daVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('da'));
      const pool = daVoices.length > 0 ? daVoices : voices;

      let chosen =
        (options?.voiceURI && voices.find((v) => v.voiceURI === options.voiceURI)) ||
        pool[0];

      if (!options?.voiceURI && chosenProfileMeta && pool.length > 1) {
        const idx =
          VOICE_PROFILE_OPTIONS.findIndex((v) => v.id === chosenProfileMeta.id) % pool.length;
        chosen = pool[idx] ?? pool[0];
      }

      if (chosen) utterance.voice = chosen;
      utterance.lang = chosen?.lang || 'da-DK';

      const roleDefaults = ROLE_VOICE_PROFILE[role] || ROLE_VOICE_PROFILE.Dommer;
      utterance.pitch = chosenProfileMeta ? chosenProfileMeta.browserPitch : roleDefaults.pitch;
      const rateBase = options?.rate ?? 1.0;
      const rateMult = chosenProfileMeta
        ? chosenProfileMeta.browserRate
        : roleDefaults.rateMultiplier;
      utterance.rate = Math.max(0.65, Math.min(1.6, rateBase * rateMult));

      utterance.onstart = () => options?.onStart?.();
      utterance.onend = () => options?.onEnd?.();
      utterance.onerror = () => options?.onEnd?.();

      window.speechSynthesis.speak(utterance);
    } catch {
      options?.onEnd?.();
    }
  };

  if (options?.ttsEngine === 'gemini' && typeof window !== 'undefined') {
    const abort = new AbortController();
    activeTtsAbort = abort;

    fetch('/api/trial/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abort.signal,
      body: JSON.stringify({
        text,
        voiceName: options.voiceProfileId || (role === 'Dommer' ? 'Charon' : 'Kore'),
        role,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Gemini TTS unavailable');
        return (await res.json()) as { audioBase64?: string; mimeType?: string };
      })
      .then((data) => {
        if (abort.signal.aborted || !data.audioBase64) {
          if (!abort.signal.aborted) speakBrowserFallback();
          return;
        }
        const audio = new Audio(
          `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
        );
        audio.playbackRate = Math.max(0.75, Math.min(1.4, options?.rate ?? 1.0));
        activeAudioEl = audio;
        audio.onplay = () => options?.onStart?.();
        audio.onended = () => {
          if (activeAudioEl === audio) activeAudioEl = null;
          options?.onEnd?.();
        };
        audio.onerror = () => {
          if (activeAudioEl === audio) activeAudioEl = null;
          speakBrowserFallback();
        };
        audio.play().catch(() => speakBrowserFallback());
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        speakBrowserFallback();
      });
    return;
  }

  speakBrowserFallback();
}

export function speakWithCourtProfile(
  text: string,
  role: CourtRole,
  settings: {
    rate: number;
    ttsEngine: TtsEngine;
    judgeVoiceProfile: VoiceProfileId;
    counselVoiceProfile: VoiceProfileId;
  },
  callbacks?: { onStart?: () => void; onEnd?: () => void }
): void {
  const voiceProfileId =
    role === 'Dommer' ? settings.judgeVoiceProfile : settings.counselVoiceProfile;
  speakLine(text, role, {
    rate: settings.rate,
    ttsEngine: settings.ttsEngine,
    voiceProfileId,
    onStart: callbacks?.onStart,
    onEnd: callbacks?.onEnd,
  });
}

const JUDGE_PREVIEW_SAMPLES = [
  'Retten noterer bilagets bevisvægt og beder parterne holde fokus på tidslinjen.',
  'Orden i retssalen. Indsigelsen tages til følge, og irrelevant materiale afvises.',
  'Parterne har afsluttet deres procedure. AI-juryen trækker sig nu tilbage for votering.',
  'Retten lægger afgørende vægt på tidsstemplerne i de fremlagte primærbeviser.',
];

const COUNSEL_PREVIEW_SAMPLES = [
  'Ærede ret, dette bilag modstrider direkte modpartens forklaring om tidspunktet.',
  'Vi dokumenterer hermed en klar tidsmæssig sammenhæng, der understøtter vores påstand.',
  'Under krydsforhør står det klart, at vidnets observation fandt sted under svære forhold.',
  'Med respekt for retten bestrides modpartens udlægning af nøglekortets anvendelse.',
];

let lastPreviewText = '';

export function previewVoiceProfile(
  profileId: VoiceProfileId,
  speakerKind: 'judge' | 'counsel',
  ttsEngine: TtsEngine,
  rate: number,
  callbacks?: { onStart?: () => void; onEnd?: () => void }
): string {
  const role: CourtRole = speakerKind === 'judge' ? 'Dommer' : 'Anklager';
  const pool = speakerKind === 'judge' ? JUDGE_PREVIEW_SAMPLES : COUNSEL_PREVIEW_SAMPLES;
  const candidates = pool.filter((s) => s !== lastPreviewText);
  const sampleText =
    candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
  lastPreviewText = sampleText;

  speakLine(sampleText, role, {
    rate,
    ttsEngine,
    voiceProfileId: profileId,
    onStart: callbacks?.onStart,
    onEnd: callbacks?.onEnd,
  });
  return sampleText;
}

/**
 * Free Live Voice Dictation (Indtaling) using browser Web Speech Recognition
 * with fallback detection for MediaRecorder + server transcription.
 */
export interface SpeechRecognitionHandle {
  stop: () => void;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function isLiveDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startLiveDictation(callbacks: {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}): SpeechRecognitionHandle | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'da-DK';
  rec.continuous = true;
  rec.interimResults = true;

  rec.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let i = 0; i < event.results.length; i++) {
      const res = event.results[i];
      const transcript = res[0]?.transcript ?? '';
      if (res.isFinal) {
        finalText += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    if (finalText.trim()) callbacks.onFinal(finalText.trim());
    if (interim.trim()) callbacks.onInterim(interim.trim());
  };

  rec.onerror = (event) => {
    if (event.error === 'not-allowed') {
      callbacks.onError('Mikrofonadgang blev afvist i browseren.');
    } else if (event.error !== 'aborted') {
      callbacks.onError(`Talegenkendelse fejl: ${event.error}`);
    }
  };

  rec.onend = () => {
    callbacks.onEnd();
  };

  try {
    rec.start();
    return {
      stop: () => {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      },
    };
  } catch {
    callbacks.onError('Kunne ikke starte live stemmeindtaling.');
    return null;
  }
}
