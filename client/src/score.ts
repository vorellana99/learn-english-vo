export type BandKey = "excellent" | "good" | "fair" | "improve" | "practice";

export interface Band {
  key: BandKey;
  label: string;
  color: string;
}

// Five levels, from green (excellent) to red (needs practice).
const BANDS: { min: number; band: Band }[] = [
  { min: 90, band: { key: "excellent", label: "Excellent", color: "#34d399" } },
  { min: 75, band: { key: "good", label: "Good", color: "#2dd4bf" } },
  { min: 60, band: { key: "fair", label: "Fair", color: "#fbbf24" } },
  { min: 40, band: { key: "improve", label: "Can improve", color: "#fb923c" } },
  { min: 0, band: { key: "practice", label: "Needs practice", color: "#fb7185" } },
];

export const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)));

export function scoreBand(score: number): Band {
  const s = clampScore(score);
  return BANDS.find((b) => s >= b.min)!.band;
}
