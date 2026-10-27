/** Coefficients for fixed prepared images. Flooring never exceeds the prescribed optical path. */
export function hybridOpticalOpacity(role: 'merged-three' | 'single' | 'merged-two', gain: number): number {
  if (!Number.isFinite(gain) || gain < 1) throw new TypeError('Hybrid optical gain must be finite and at least one.');
  const bounded = Math.min(3, gain);
  if (role === 'single') return .998;
  if (role !== 'merged-three' && role !== 'merged-two') throw new TypeError('Unknown hybrid optical role.');
  const exact = role === 'merged-three' ? bounded / 3 : (bounded - 1) / 2;
  return Math.min(.999, Math.max(.001, Math.floor(exact * 255) / 255));
}
