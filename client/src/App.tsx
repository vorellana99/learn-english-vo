import { useCallback, useEffect, useState } from "react";
import { getProfile, type Mode, type Profile } from "./api";
import { Review } from "./Review";
import { Chat } from "./Chat";
import { Interview } from "./Interview";
import { Shadowing } from "./Shadowing";
import { Dashboard } from "./Dashboard";
import { Hero } from "./Hero";
import { Roadmap } from "./Roadmap";
import { StreakGoal, useInsights } from "./StreakGoal";
import { SoundToggle } from "./SoundToggle";
import { sound } from "./sound";

type View = "home" | "review" | "chat" | "interview" | "shadowing";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "quick", label: "Quick", hint: "3 min" },
  { id: "normal", label: "Normal", hint: "8 min" },
  { id: "long", label: "Long", hint: "15+ min" },
];

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>("home");
  const [mode, setMode] = useState<Mode>("normal");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const insights = useInsights(refreshKey);

  const refresh = useCallback(() => {
    getProfile().then(setProfile).catch((e: Error) => setError(e.message));
    setRefreshKey((k) => k + 1);
  }, []);
  useEffect(refresh, [refresh]);

  const go = (v: View) => {
    sound.play("click");
    sound.resumeMusicIfEnabled();
    setView(v);
  };
  const home = () => {
    setView("home");
    refresh();
  };

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => view !== "home" && home()}>
          <span className="logo">E</span> Learn English
        </button>
        <SoundToggle />
      </header>
      <main>
        {error && <p className="error">{error}</p>}
        {!profile && !error && <p className="muted">Loading…</p>}
        {profile && view === "home" && (
          <div className="home">
            <Hero profile={profile} />
            <StreakGoal profile={profile} insights={insights} />
            <Roadmap profile={profile} />
            <div className="actions">
              <section className="card action">
                <div className="action-head">
                  <span className="emoji">🧠</span>
                  <div>
                    <h2>Practice cards</h2>
                    <p className="muted">Spaced repetition adapted to your mistakes.</p>
                  </div>
                  {!!profile.dueCount && <span className="badge">{profile.dueCount} due</span>}
                </div>
                <div className="chips" role="radiogroup" aria-label="Session length">
                  {MODES.map((m) => (
                    <button key={m.id} role="radio" aria-checked={m.id === mode} className={`chip ${m.id === mode ? "active" : ""}`} onClick={() => { sound.play("click"); setMode(m.id); }}>
                      {m.label} <small>{m.hint}</small>
                    </button>
                  ))}
                </div>
                <button className="primary" onClick={() => go("review")}>
                  {profile.reviewedToday ? "Practice more" : "Start today's session"}
                </button>
              </section>
              <section className="card action">
                <div className="action-head">
                  <span className="emoji">💬</span>
                  <div>
                    <h2>Conversation missions</h2>
                    <p className="muted">Interviews, standups and small talk with an AI coach who corrects you.</p>
                  </div>
                </div>
                <button className="primary alt" onClick={() => go("chat")}>Start a mission</button>
              </section>
              <section className="card action">
                <div className="action-head">
                  <span className="emoji">🎧</span>
                  <div>
                    <h2>Shadowing</h2>
                    <p className="muted">Listen to a sentence, repeat it out loud and see exactly which words you missed.</p>
                  </div>
                </div>
                <button className="primary alt" onClick={() => go("shadowing")}>Start shadowing</button>
              </section>
              <section className="card action">
                <div className="action-head">
                  <span className="emoji">🎯</span>
                  <div>
                    <h2>Mock interview</h2>
                    <p className="muted">6 questions without interruptions, then a full report: score, CEFR estimate and better answers.</p>
                  </div>
                </div>
                <button className="primary alt" onClick={() => go("interview")}>Start an interview</button>
              </section>
            </div>
            <Dashboard data={insights} />
          </div>
        )}
        {profile && view === "review" && <Review mode={mode} level={profile.level} streak={profile.streak} onProgress={setProfile} onDone={home} />}
        {profile && view === "chat" && <Chat onClose={home} />}
        {profile && view === "interview" && <Interview onClose={home} onProgress={refresh} />}
        {profile && view === "shadowing" && <Shadowing onClose={home} onProgress={refresh} />}
      </main>
    </div>
  );
}
