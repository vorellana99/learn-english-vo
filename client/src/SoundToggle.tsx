import { useSyncExternalStore } from "react";
import { sound } from "./sound";

export function SoundToggle() {
  const s = useSyncExternalStore(sound.subscribe, sound.getSnapshot);
  return (
    <div className="toggles">
      <button className={`icon ${s.sfx ? "on" : ""}`} aria-pressed={s.sfx} title="Sound effects" onClick={() => sound.setSfx(!s.sfx)}>
        {s.sfx ? "🔊" : "🔇"}
      </button>
      <button className={`icon ${s.music ? "on" : ""}`} aria-pressed={s.music} title="Ambient music" onClick={() => sound.setMusic(!s.music)}>
        🎵
      </button>
    </div>
  );
}
