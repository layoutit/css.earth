/** Right-handed cross product. Callers own vector validation and coordinate frames. */
export function cross3(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Dot product of the first three components. */
export function dot3(a: ArrayLike<number>, b: ArrayLike<number>): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Dot product over every component of `a`, in order. */
export function dotN(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let index = 0; index < a.length; index++) sum += a[index]! * b[index]!;
  return sum;
}
