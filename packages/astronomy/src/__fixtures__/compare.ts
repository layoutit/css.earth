import type { Vec3 } from '../vec3.js'

/** Euclidean distance between two same-unit vectors. */
export const distance = (a: Vec3 | readonly number[], b: Vec3 | readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

export const magnitude = (a: Vec3 | readonly number[]): number => Math.hypot(a[0]!, a[1]!, a[2]!)

export const scaled = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]

export const unit = (a: Vec3 | readonly number[]): Vec3 => {
  const n = magnitude(a)
  return [a[0]! / n, a[1]! / n, a[2]! / n]
}

/** Angle between two vectors, in degrees. Used where the quantity under test is a direction. */
export const angleBetweenDeg = (a: Vec3 | readonly number[], b: Vec3 | readonly number[]): number => {
  const ua = unit(a)
  const ub = unit(b)
  const cosine = Math.min(1, Math.max(-1, ua[0] * ub[0] + ua[1] * ub[1] + ua[2] * ub[2]))
  return (Math.acos(cosine) * 180) / Math.PI
}
