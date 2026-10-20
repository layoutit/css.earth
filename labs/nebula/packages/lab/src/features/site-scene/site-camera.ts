/** Whether two camera orientations are the same turn (a quaternion and its negation are one rotation). */
export function sameOrientation(a: readonly number[], b: readonly number[], tolerance = 1e-6): boolean {
  if (a.length !== 4 || b.length !== 4) return false;
  const dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!;
  return 1 - Math.abs(dot) <= tolerance;
}
