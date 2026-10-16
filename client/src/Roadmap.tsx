import type { Profile } from "./api";

const LABELS: Record<string, string> = {
  A1: "Survival basics",
  A2: "Everyday work talk",
  B1: "Interview ready",
  B2: "Fluent at work",
};

export function Roadmap({ profile }: { profile: Profile }) {
  const levels = profile.levels ?? [];
  const currentIdx = levels.findIndex((l) => l.code === profile.level);
  return (
    <section className="card">
      <h2>Road to B2</h2>
      <ol className="roadmap">
        {levels.map((l, i) => {
          const status = i < currentIdx ? "done" : i === currentIdx ? "current" : "locked";
          return (
            <li key={l.code} className={status}>
              <span className="node">{status === "done" ? "✓" : status === "locked" ? "🔒" : l.code}</span>
              <strong>{l.code}</strong>
              <small>{LABELS[l.code]}</small>
              <small className="xp">{l.minXp.toLocaleString()} XP</small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
