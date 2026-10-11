"use client";

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { toast } from "sonner";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Sets the value the way a keystroke would, so react-hook-form and controlled inputs both notice. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * A text input with a microphone button, using the phone's own speech recognition.
 * Typing always works; the mic is an extra. Many phones do their recognising on a server,
 * so with no signal it says so and leaves the keyboard to the user.
 */
type VoiceProps = (InputHTMLAttributes<HTMLInputElement> & { multiline?: false }) | (TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true });

export const VoiceInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, VoiceProps>(function VoiceInput(
  { className, multiline, ...props },
  ref,
) {
  const inner = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const rec = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => rec.current?.stop();
  }, []);

  function toggle() {
    const el = inner.current;
    const Ctor = recognitionCtor();
    if (!el || !Ctor) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = document.documentElement.lang === "ms" ? "ms-MY" : "en-MY";
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" ").trim();
      if (said) setNativeValue(el, el.value ? `${el.value.trimEnd()} ${said}` : said);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Microphone is blocked. Allow it in the browser settings, or type instead.");
      else if (e.error === "network") toast.error("Voice typing needs signal on this phone. Please type instead.");
      else if (e.error !== "aborted" && e.error !== "no-speech") toast.error("Could not hear that. Please try again or type.");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  }

  return (
    <div className="relative">
      {multiline ? (
        <Textarea
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          rows={(props as TextareaHTMLAttributes<HTMLTextAreaElement>).rows ?? 3}
          ref={(node) => {
            inner.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          className={cn(supported && "pr-14", className)}
        />
      ) : (
        <Input
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
          ref={(node) => {
            inner.current = node;
            if (typeof ref === "function") ref(node as HTMLInputElement);
            else if (ref) ref.current = node;
          }}
          className={cn(supported && "pr-14", className)}
        />
      )}
      {supported ? (
        <button
          type="button"
          onClick={toggle}
          aria-label={listening ? "Stop dictation" : "Dictate with microphone"}
          aria-pressed={listening}
          className={cn(
            "absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            listening && "animate-pulse text-destructive",
          )}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
});
