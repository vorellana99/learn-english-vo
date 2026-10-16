import { useCallback, useEffect, useState } from "react";
import { getProfile, type Mode, type Profile } from "./api";
import { Review } from "./Review";
import { Chat } from "./Chat";
import { Dashboard } from "./Dashboard";

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [mode, setMode] = useState<Mode>("normal");
  const [chatting, setChatting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    getProfile().then(setProfile).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(refresh, [refresh]);

  if (error) return <main><p className="error">{error}</p></main>;
  if (!profile) return <main><p>Loading…</p></main>;

  const pct = profile.xpForNext ? Math.min(100, (profile.xpIntoLevel / profile.xpForNext) * 100) : 100;

  return (
    <main>
      <h1>Learn English</h1>
      <section className="stats">
        <div><strong>{profile.streak}</strong><span>day streak 🔥</span></div>
        <div><strong>{profile.xp}</strong><span>XP</span></div>
        <div><strong>{profile.level}</strong><span>level</span></div>
      </section>
      <p className="progress-label">
        {profile.nextLevel ? `Road to ${profile.nextLevel}` : "B2 reached 🎉"}
      </p>
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      {reviewing ? (
        <Review
          mode={mode}
          onProgress={setProfile}
          onDone={() => {
            setReviewing(false);
            refresh();
          }}
        />
      ) : chatting ? (
        <Chat
          onClose={() => {
            setChatting(false);
            refresh();
          }}
        />
      ) : (
        <>
          <div className="modes">
            {(["quick", "normal", "long"] as const).map((m) => (
              <button key={m} className={m === mode ? "active" : ""} onClick={() => setMode(m)}>
                {{ quick: "Quick · 3 min", normal: "Normal · 8 min", long: "Long · 15+ min" }[m]}
              </button>
            ))}
          </div>
          <div className="actions">
            <button className="primary" onClick={() => setReviewing(true)}>
              {profile.reviewedToday ? "Practice more" : "Start today's session"}
            </button>
            <button onClick={() => setChatting(true)}>Conversation mission 💬</button>
          </div>
          <Dashboard />
        </>
      )}
    </main>
  );
}
