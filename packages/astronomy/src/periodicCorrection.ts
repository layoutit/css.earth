import type { Vec3 } from './vec3.js'

export interface PeriodicAxisCorrection {
  readonly constantKm: number
  readonly harmonics: readonly {
    readonly rateRadPerDay: number
    readonly cosineKm: number
    readonly sineKm: number
  }[]
}

/** Prepared geometric ICRF displacement, finite and bounded at every epoch. */
export interface PeriodicVectorCorrection {
  readonly epochJdTt: number
  readonly axes: readonly [PeriodicAxisCorrection, PeriodicAxisCorrection, PeriodicAxisCorrection]
}

export function periodicCorrectionStateKm(correction: PeriodicVectorCorrection, epochJdTt: number): {
  readonly positionKm: Vec3; readonly velocityKmPerDay: Vec3
} {
  const days = epochJdTt - correction.epochJdTt
  const position: [number, number, number] = [0, 0, 0]
  const velocity: [number, number, number] = [0, 0, 0]
  for (let axis = 0; axis < 3; axis++) {
    const data = correction.axes[axis]!
    position[axis] = data.constantKm
    for (const h of data.harmonics) {
      const angle = h.rateRadPerDay * days, cosine = Math.cos(angle), sine = Math.sin(angle)
      position[axis] = position[axis]! + h.cosineKm * cosine + h.sineKm * sine
      velocity[axis] = velocity[axis]! + h.rateRadPerDay * (-h.cosineKm * sine + h.sineKm * cosine)
    }
  }
  return { positionKm: position, velocityKmPerDay: velocity }
}

/** Triangle inequality on each axis, then the Euclidean norm: a global bound. */
export function periodicCorrectionBoundKm(correction: PeriodicVectorCorrection): number {
  return Math.hypot(...correction.axes.map(axis => Math.abs(axis.constantKm) +
    axis.harmonics.reduce((sum, h) => sum + Math.hypot(h.cosineKm, h.sineKm), 0)))
}
