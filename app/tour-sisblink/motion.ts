export const clampProgress = (value: number) => Math.max(0, Math.min(1, value));

// Time-based damping follows touch inertia and also bridges discrete scroll steps.
export function advanceProgress(current: number, target: number, seconds: number) {
  const next = current + (clampProgress(target) - current) * -Math.expm1(-Math.max(0, seconds) / .18);
  return Math.abs(next - target) < .00001 ? clampProgress(target) : next;
}

const smooth = (value: number, start: number, end: number) => {
  const t = clampProgress((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export function swanFrame(progress: number) {
  return { progress: Math.min(clampProgress(progress / .56), .97), dock: smooth(progress, .88, .975), handoff: smooth(progress, .978, 1) };
}

export type TourFrame = (time: number, progress: number) => void;

// React updates text/accessibility only at semantic boundaries, never per frame.
const boundaries = [0, .14, .26*.56, .37*.56, .51*.56, .57*.56, .33, .44, .85*.56, .92*.56, .56, .65, .69, .74, .79, .88, .89, .94, 1].sort((a,b)=>a-b);
export function journeyPhase(progress: number) {
  return boundaries.reduce((phase, boundary) => phase + (progress > boundary ? 2 : progress === boundary ? 1 : 0), 0);
}
