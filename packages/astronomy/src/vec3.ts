/**
 * float64 3-vectors. Plain tuples so they cost one allocation and can be
 * handed to a Float64Array without a copy.
 *
 * These are CPU-side only. Nothing here ever reaches the GPU — the renderer
 * downcasts to float32 after resolving positions relative to the camera.
 */
export type Vec3 = readonly [number, number, number]

export const ZERO: Vec3 = [0, 0, 0]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])

export const normalize = (a: Vec3): Vec3 => {
  const l = length(a)
  return l === 0 ? ZERO : scale(a, 1 / l)
}
