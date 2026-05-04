export const DEFAULT_SMOOTH_WINDOW = 5;

export function smoothElevations(
  elevations: number[],
  window: number = DEFAULT_SMOOTH_WINDOW,
): number[] {
  if (elevations.length === 0) return [];
  if (window <= 1) return [...elevations];

  const half = Math.floor(window / 2);
  const out: number[] = new Array(elevations.length);

  for (let i = 0; i < elevations.length; i += 1) {
    const start = Math.max(0, i - half);
    const end = Math.min(elevations.length, i + half + 1);
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += elevations[j];
    out[i] = sum / (end - start);
  }

  return out;
}
