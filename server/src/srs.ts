export type Rating = 0 | 1 | 2 | 3; // again, hard, good, easy

export interface CardState {
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
}

export const initialState: CardState = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

/** Simplified SM-2: returns the next state for a rating. */
export function schedule(state: CardState, rating: Rating): CardState {
  if (rating === 0) {
    return {
      ease: Math.max(1.3, state.ease - 0.2),
      intervalDays: 0,
      reps: 0,
      lapses: state.lapses + 1,
    };
  }
  const ease = Math.max(1.3, state.ease + (rating === 1 ? -0.15 : rating === 3 ? 0.15 : 0));
  let intervalDays: number;
  if (state.reps === 0) intervalDays = rating === 3 ? 3 : 1;
  else if (state.reps === 1) intervalDays = rating === 1 ? 3 : 6;
  else {
    const factor = rating === 1 ? 1.2 : rating === 3 ? ease * 1.3 : ease;
    intervalDays = Math.max(1, Math.round(state.intervalDays * factor));
  }
  return { ease, intervalDays, reps: state.reps + 1, lapses: state.lapses };
}
