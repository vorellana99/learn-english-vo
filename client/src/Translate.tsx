import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sound } from "./sound";
import { translationPref, useAlwaysTranslate } from "./translation";

interface Props {
  /** Spanish text. Renders nothing when it is empty (for example old stored data without translations). */
  es?: string;
  className?: string;
}

const MARGIN = 8;

/**
 * Reusable translate-to-Spanish control: a 🌐 button that turns a floating bubble on and off.
 * Project standard: it is always the same icon-only round button (never a text label or a smaller size),
 * so every place that shows English text uses this component as is.
 * When "always show translations" is on, the translation is shown inline instead and the button is hidden.
 */
export function Translate({ es, className = "" }: Props) {
  const always = useAlwaysTranslate();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);

  const place = () => {
    if (!button.current || !bubble.current) return;
    const b = button.current.getBoundingClientRect();
    const w = bubble.current.offsetWidth;
    const h = bubble.current.offsetHeight;
    const left = Math.max(MARGIN, Math.min(b.left + b.width / 2 - w / 2, window.innerWidth - w - MARGIN));
    const above = b.top - h - MARGIN;
    setPos({ left, top: above >= MARGIN ? above : b.bottom + MARGIN });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, es]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const target = e.target as Node;
      if (!button.current?.contains(target) && !bubble.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!es) return null;
  if (always) return <small className="tr-inline">{es}</small>;

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`tr-btn ${open ? "on" : ""} ${className}`}
        aria-pressed={open}
        aria-label={open ? "Hide Spanish translation" : "Show Spanish translation"}
        title={open ? "Hide translation" : "Translate to Spanish"}
        onClick={() => {
          sound.play("click");
          setOpen((o) => !o);
        }}
      >
        🌐
      </button>
      {open &&
        createPortal(
          <div ref={bubble} className="tpop" role="status" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}>
            <span className="tpop-flag">ES</span> {es}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Header button for the "always show translations" preference. */
export function TranslationsToggle() {
  const always = useAlwaysTranslate();
  return (
    <button
      className={`icon ${always ? "on" : ""}`}
      aria-pressed={always}
      title={always ? "Translations always shown" : "Always show translations"}
      onClick={() => translationPref.set(!always)}
    >
      🌐
    </button>
  );
}
