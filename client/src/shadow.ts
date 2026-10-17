export const normalizeWord = (w: string) =>
  w
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']/g, "")
    .replace(/'/g, "");

const tokens = (text: string) => text.split(/\s+/).filter(Boolean);

export interface WordResult {
  text: string;
  ok: boolean;
}

export interface Comparison {
  words: WordResult[];
  matched: number;
  total: number;
  extra: number;
  score: number;
}

/**
 * Compares what the user said with the target sentence using the longest common subsequence of words,
 * so one skipped word does not shift the rest. Case, punctuation and apostrophes are ignored.
 */
export function compare(target: string, heard: string): Comparison {
  const shown = tokens(target);
  const t = shown.map(normalizeWord);
  const h = tokens(heard).map(normalizeWord).filter(Boolean);

  const dp: number[][] = Array.from({ length: t.length + 1 }, () => new Array<number>(h.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--) {
    for (let j = h.length - 1; j >= 0; j--) {
      dp[i][j] = t[i] && t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ok = new Array<boolean>(t.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < t.length && j < h.length) {
    if (t[i] && t[i] === h[j]) {
      ok[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }

  const matched = dp[0][0];
  const total = t.filter(Boolean).length;
  const extra = Math.max(0, h.length - matched);
  const base = total ? (matched / total) * 100 : 0;
  // Added words cost a little, but never more than 15 points.
  const score = Math.round(Math.max(0, base - Math.min(15, extra * 5)));
  return { words: shown.map((text, k) => ({ text, ok: ok[k] })), matched, total, extra, score };
}

export const missedWords = (c: Comparison) =>
  c.words.filter((w) => !w.ok).map((w) => normalizeWord(w.text)).filter(Boolean);
