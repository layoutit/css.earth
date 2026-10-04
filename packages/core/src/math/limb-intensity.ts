/** Intensity relative to the disc centre at mu = cos(angle from the line of sight). */
export function limbIntensity(mu: number, law: { readonly law: 'power'; readonly alpha: number } | { readonly law?: 'quadratic'; readonly u1: number; readonly u2: number }): number {
  if ('law' in law && law.law === 'power') return Math.max(0, mu) ** law.alpha;
  const { u1, u2 } = law as { u1: number; u2: number };
  return 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2;
}

