import { useEffect, useState } from "react";
import { getInsights, type Insights } from "./api";

const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export function Dashboard() {
  const [data, setData] = useState<Insights | null>(null);
  useEffect(() => {
    getInsights().then(setData).catch(() => setData(null));
  }, []);
  if (!data) return null;

  const maxDay = Math.max(1, ...data.activeDays.map((d) => d.reviews));
  const maxCat = Math.max(1, ...data.weakCategories.map((c) => c.count));

  return (
    <section className="dashboard">
      <h2>Your progress</h2>
      <p>
        {data.learned} / {data.totalCards} cards started · {data.mastered} mastered
        {data.bestHour !== null && <> · you practice most around {fmtHour(data.bestHour)}</>}
      </p>
      {data.activeDays.length > 0 && (
        <div className="spark" aria-label="Reviews per day, last 14 days">
          {data.activeDays.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.reviews}`} style={{ height: `${(d.reviews / maxDay) * 100}%` }} />
          ))}
        </div>
      )}
      {data.weakCategories.length > 0 && (
        <>
          <h3>Most frequent mistakes (30 days)</h3>
          {data.weakCategories.map((c) => (
            <div key={c.category} className="hrow">
              <span>{c.category}</span>
              <div className="bar"><div style={{ width: `${(c.count / maxCat) * 100}%` }} /></div>
              <span>{c.count}</span>
            </div>
          ))}
        </>
      )}
      {data.weakTopics.length > 0 && (
        <p>Topics to reinforce: {data.weakTopics.map((t) => `${t.topic} (${Math.round(t.struggleRate * 100)}% missed)`).join(", ")}</p>
      )}
    </section>
  );
}
