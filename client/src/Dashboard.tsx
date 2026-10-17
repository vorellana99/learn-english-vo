import type { Insights } from "./api";
import { ScoreBadge } from "./ScoreBadge";
import { scoreBand } from "./score";
import { speak } from "./speech";

const fmtHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export function Dashboard({ data }: { data: Insights | null }) {
  if (!data) return null;
  const maxDay = Math.max(1, ...data.activeDays.map((d) => d.reviews));
  const maxCat = Math.max(1, ...data.weakCategories.map((c) => c.count));

  return (
    <section className="card">
      <h2>Your stats</h2>
      <div className="tiles">
        <div className="tile"><strong>{data.learned}</strong><small>cards started</small></div>
        <div className="tile"><strong>{data.mastered}</strong><small>mastered</small></div>
        <div className="tile"><strong>{data.bestHour !== null ? fmtHour(data.bestHour) : "–"}</strong><small>best hour</small></div>
      </div>
      {data.activeDays.length > 0 && (
        <>
          <h3>Last 2 weeks</h3>
          <div className="spark" aria-label="Reviews per day">
            {data.activeDays.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.reviews}`} style={{ height: `${(d.reviews / maxDay) * 100}%` }} />
            ))}
          </div>
        </>
      )}
      {data.weakCategories.length > 0 && (
        <>
          <h3>Most frequent mistakes</h3>
          {data.weakCategories.map((c) => (
            <div key={c.category} className="hrow">
              <span>{c.category}</span>
              <div className="xpbar"><div style={{ width: `${(c.count / maxCat) * 100}%` }} /></div>
              <span>{c.count}</span>
            </div>
          ))}
        </>
      )}
      {data.conversation.answers > 0 && data.conversation.avgScore !== null && (
        <>
          <h3>Conversation scores (30 days)</h3>
          <div className="conv-scores">
            <div className="conv-avg">
              <ScoreBadge score={data.conversation.avgScore} size={64} />
              <small>{data.conversation.answers} answers</small>
            </div>
            <div className="conv-detail">
              {data.conversation.byScenario.map((m) => (
                <div key={m.scenarioId} className="hrow" style={{ ["--band" as string]: scoreBand(m.avgScore).color }}>
                  <span title={m.title}>{m.title}</span>
                  <div className="xpbar band"><div style={{ width: `${m.avgScore}%` }} /></div>
                  <span>{m.avgScore}%</span>
                </div>
              ))}
              <div className="score-trend" aria-label="Scores of your latest answers">
                {data.conversation.recent.map((s, i) => (
                  <div key={i} title={`${s}%`} style={{ height: `${Math.max(8, s)}%`, background: scoreBand(s).color }} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {data.shadowing.hardWords.length > 0 && (
        <>
          <h3>Words to practice aloud</h3>
          <div className="chips">
            {data.shadowing.hardWords.map((w) => (
              <button key={w.word} className="chip" title="Listen" onClick={() => speak(w.word, undefined, 0.8)}>
                🔈 {w.word} <small>×{w.count}</small>
              </button>
            ))}
          </div>
          <p className="muted">Shadowing average: {data.shadowing.avgScore}% over {data.shadowing.attempts} attempts</p>
        </>
      )}
      {data.weakTopics.length > 0 && (
        <p className="muted">Reinforce: {data.weakTopics.map((t) => `${t.topic} (${Math.round(t.struggleRate * 100)}% missed)`).join(", ")}</p>
      )}
    </section>
  );
}
