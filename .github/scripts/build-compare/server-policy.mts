/** Server answers stay exact in every declared refactor, independently of L3 permissions. */
export function serverVerdict(mode: 'report' | 'pure-move' | 'semantic', differences: number, failures: number): number {
  if (mode === 'report') return 0;
  if (failures > 0) return 2;
  return differences > 0 ? 1 : 0;
}
/** The upload budget covers all retained recording pairs together. */
export function retainRecordingPair(retainedBytes: number, pairBytes: number): boolean {
  return retainedBytes + pairBytes < 40_000_000;
}
