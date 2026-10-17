import { clampScore, scoreBand } from "./score";

const R = 17;
const C = 2 * Math.PI * R;

/** Round badge with the 0-100 score as a percentage; the ring and the color follow the score band. */
export function ScoreBadge({ score, size = 44 }: { score: number; size?: number }) {
  const s = clampScore(score);
  const band = scoreBand(s);
  return (
    <span className="score-badge" style={{ width: size, height: size, ["--band" as string]: band.color }} role="img" aria-label={`Score ${s} percent, ${band.label}`}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
        <circle cx="20" cy="20" r={R} className="sb-track" />
        <circle cx="20" cy="20" r={R} className="sb-fill" strokeDasharray={C} strokeDashoffset={C * (1 - s / 100)} transform="rotate(-90 20 20)" />
      </svg>
      <span className="sb-num">{s}%</span>
    </span>
  );
}
