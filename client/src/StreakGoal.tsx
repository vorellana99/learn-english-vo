import { useEffect, useState } from "react";
import { getInsights, type Insights, type Profile } from "./api";

export const DAILY_GOAL = 10;

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function StreakGoal({ profile, insights }: { profile: Profile; insights: Insights | null }) {
  const byDay = new Map(insights?.activeDays.map((d) => [d.day, d.reviews]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { key: ymd(d), label: d.toLocaleDateString("en-US", { weekday: "narrow" }), today: i === 6 };
  });
  const todayCount = byDay.get(days[6].key) ?? 0;
  const pct = Math.min(1, todayCount / DAILY_GOAL);

  return (
    <section className="card streak">
      <div className="flame">
        <span className={profile.streak > 0 ? "lit" : ""}>🔥</span>
        <strong>{profile.streak}</strong>
        <small>day streak</small>
      </div>
      <div className="goal">
        <div className="week">
          {days.map((d) => (
            <div key={d.key} className={`day ${byDay.get(d.key) ? "hit" : ""} ${d.today ? "today" : ""}`}>
              <span>{byDay.get(d.key) ? "✓" : ""}</span>
              <small>{d.label}</small>
            </div>
          ))}
        </div>
        <div className="goal-row">
          <span>{pct >= 1 ? "Daily goal reached 🎉" : `Daily goal: ${todayCount}/${DAILY_GOAL} cards`}</span>
          <div className="xpbar"><div style={{ width: `${pct * 100}%` }} /></div>
        </div>
      </div>
    </section>
  );
}

export function useInsights(refreshKey: unknown) {
  const [data, setData] = useState<Insights | null>(null);
  useEffect(() => {
    getInsights().then(setData).catch(() => setData(null));
  }, [refreshKey]);
  return data;
}
