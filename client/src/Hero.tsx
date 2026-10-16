import { useCountUp } from "./effects";
import type { Profile } from "./api";

const RADIUS = 56;
const CIRC = 2 * Math.PI * RADIUS;

export function Hero({ profile }: { profile: Profile }) {
  const xp = useCountUp(profile.xp);
  const pct = profile.xpForNext ? Math.min(1, profile.xpIntoLevel / profile.xpForNext) : 1;
  const levels = profile.levels ?? [];
  const goal = levels.at(-1);
  const toGoal = goal ? Math.max(0, goal.minXp - profile.xp) : 0;

  return (
    <section className="card hero">
      <div className="ring" role="img" aria-label={`Level ${profile.level}, ${Math.round(pct * 100)}% to next level`}>
        <svg viewBox="0 0 140 140">
          <defs>
            <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          <circle cx="70" cy="70" r={RADIUS} className="ring-track" />
          <circle
            cx="70"
            cy="70"
            r={RADIUS}
            className="ring-fill"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - pct)}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="ring-center">
          <strong>{profile.level}</strong>
          <span>level</span>
        </div>
      </div>
      <div className="hero-info">
        <p className="eyebrow">Your journey to {goal?.code ?? "B2"}</p>
        <h1>{xp.toLocaleString()} <small>XP</small></h1>
        <p className="muted">
          {profile.nextLevel
            ? `${(profile.xpForNext! - profile.xpIntoLevel).toLocaleString()} XP to ${profile.nextLevel} · ${toGoal.toLocaleString()} XP to ${goal?.code}`
            : "You reached B2. Keep practicing to stay sharp!"}
        </p>
        <div className="xpbar"><div style={{ width: `${pct * 100}%` }} /></div>
      </div>
    </section>
  );
}
