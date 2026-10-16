// Thin wrappers over the browser Web Speech API (SpeechRecognition + speechSynthesis).
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string; confidence: number };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const RecognitionImpl = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export const canListen = () => RecognitionImpl() !== undefined;
export const canSpeak = () => "speechSynthesis" in window;

export interface Listener {
  stop(): void;
}

/** Starts one dictation. `onText` gets the running transcript; `onEnd` gets the final text and confidence (0-1). */
export function listen(handlers: {
  onText: (text: string) => void;
  onEnd: (final: { text: string; confidence: number | null }) => void;
  onError: (message: string) => void;
}): Listener | null {
  const Ctor = RecognitionImpl();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  let finalText = "";
  let confSum = 0;
  let confN = 0;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        finalText += r[0].transcript;
        if (r[0].confidence > 0) {
          confSum += r[0].confidence;
          confN++;
        }
      } else interim += r[0].transcript;
    }
    handlers.onText((finalText + interim).trim());
  };
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return;
    handlers.onError(
      e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Microphone access was blocked. Allow it in your browser's site settings."
        : `Voice input error: ${e.error}`,
    );
  };
  rec.onend = () => handlers.onEnd({ text: finalText.trim(), confidence: confN ? confSum / confN : null });
  rec.start();
  return { stop: () => rec.stop() };
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === "en-US" && /natural|google|samantha|aria|jenny/i.test(v.name)) ?? voices.find((v) => v.lang === "en-US");
  if (voice) u.voice = voice;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel();
};
