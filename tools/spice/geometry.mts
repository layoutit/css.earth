/**
 * Ephemeris geometry over loaded SPK segments: states of any body relative to
 * any other by chaining segment centers, with optional light-time and
 * stellar-aberration corrections as in SPICE's LT+S. Later-loaded kernels take
 * precedence, as in the SPICE kernel pool. All states are J2000 kilometres and
 * kilometres per second; ET is TDB seconds past J2000.
 */
import type { SpkSegment, State, Matrix3 } from '@cssearth/spice';

export const SPEED_OF_LIGHT_KM_S = 299792.458;
const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as [number, number, number];
const add = (a: readonly number[], b: readonly number[]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]] as [number, number, number];
const norm = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);

/** ECLIPJ2000 (frame 17): J2000 rotated about +X by the IAU 1976 obliquity of 84381.448 arcseconds. */
export const ECLIPTIC_OBLIQUITY_RAD = 84381.448 / 3600 * Math.PI / 180;
const eclipticToJ2000 = (v: readonly number[]): [number, number, number] => {
  const c = Math.cos(ECLIPTIC_OBLIQUITY_RAD), s = Math.sin(ECLIPTIC_OBLIQUITY_RAD);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
};

export class Ephemeris {
  private readonly segments: SpkSegment[] = [];
  /** Rotation from J2000 into a non-inertial frame at ET, for segments expressed in spacecraft or body frames. */
  frameRotation: ((frame: number, et: number) => Matrix3) | null = null;
  constructor(segments: readonly SpkSegment[] = []) { this.load(segments); }
  /** Later loads win when segments overlap. */
  load(segments: readonly SpkSegment[]) { this.segments.push(...segments); }

  private segment(target: number, et: number): SpkSegment | null {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const segment = this.segments[i];
      if (segment.target === target && et >= segment.start && et <= segment.stop) return segment;
    }
    return null;
  }

  /** Bodies with any coverage at ET, useful for diagnostics. */
  covered(et: number): number[] { return [...new Set(this.segments.filter(s => et >= s.start && et <= s.stop).map(s => s.target))]; }

  /** State of `target` relative to the solar system barycenter (0) by chaining centers. */
  private barycentric(target: number, et: number): State {
    let position: [number, number, number] = [0, 0, 0], velocity: [number, number, number] = [0, 0, 0], body = target, hops = 0;
    while (body !== 0) {
      const segment = this.segment(body, et);
      if (!segment) throw new Error(`No SPK coverage for body ${body} at ET ${et}${body !== target ? ` (center of ${target})` : ''}.`);
      const state = this.inJ2000(segment, et);
      position = add(position, state.position); velocity = add(velocity, state.velocity);
      body = segment.center;
      if (++hops > 20) throw new Error(`SPK center chain for ${target} does not reach the barycenter.`);
    }
    return { position, velocity };
  }

  private inJ2000(segment: SpkSegment, et: number): State {
    const state = segment.state(et);
    if (segment.frame === 1) return state;
    if (segment.frame === 17) return { position: eclipticToJ2000(state.position), velocity: eclipticToJ2000(state.velocity) };
    if (!this.frameRotation) throw new Error(`SPK segment ${segment.name} is in frame ${segment.frame}; no frame provider is loaded.`);
    // The segment frame rotates; the velocity's frame-rotation term is omitted, which is exact for fixed offsets.
    const m = this.frameRotation(segment.frame, et), toJ2000 = (v: readonly number[]): [number, number, number] => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
    return { position: toJ2000(state.position), velocity: toJ2000(state.velocity) };
  }

  /** Geometric state of target relative to observer at ET (no corrections). */
  state(target: number, observer: number, et: number): State {
    const t = this.barycentric(target, et), o = this.barycentric(observer, et);
    return { position: sub(t.position, o.position), velocity: sub(t.velocity, o.velocity) };
  }

  /**
   * Apparent position of target seen from observer: reception-case light time
   * (target evaluated at et minus the one-way light time) and, with
   * `stellarAberration`, the observer's velocity relative to the barycenter
   * deflecting the apparent direction. As in SPICE, `LT` takes one light-time
   * iteration and `converged` (SPICE's `CN`) iterates to convergence.
   */
  apparent(target: number, observer: number, et: number, { lightTime = true, stellarAberration = true, converged = false } = {}): { position: [number, number, number]; lightTimeSeconds: number; emissionEt: number } {
    const observerState = this.barycentric(observer, et);
    let used = 0, position = sub(this.barycentric(target, et).position, observerState.position);
    if (lightTime) for (let i = 0; i < (converged ? 5 : 1); i++) {
      used = norm(position) / SPEED_OF_LIGHT_KM_S;
      position = sub(this.barycentric(target, et - used).position, observerState.position);
    }
    // SPICE reports the light time of the corrected position; the emission epoch is the one the position was evaluated at.
    const lt = lightTime ? norm(position) / SPEED_OF_LIGHT_KM_S : 0;
    if (stellarAberration) position = stelab(position, observerState.velocity);
    return { position, lightTimeSeconds: lt, emissionEt: et - used };
  }
}

/** SPICE stelab: rotate the direction of `position` by the observer's velocity aberration angle, preserving its length. */
export function stelab(position: readonly number[], observerVelocity: readonly number[]): [number, number, number] {
  const length = norm(position);
  if (!(length > 0)) return [position[0], position[1], position[2]];
  const u = position.map(v => v / length), vbyc = observerVelocity.map(v => v / SPEED_OF_LIGHT_KM_S);
  if (norm(vbyc) >= 1) throw new Error('Observer velocity exceeds the speed of light.');
  const h = [u[1] * vbyc[2] - u[2] * vbyc[1], u[2] * vbyc[0] - u[0] * vbyc[2], u[0] * vbyc[1] - u[1] * vbyc[0]];
  const sinPhi = norm(h);
  if (sinPhi === 0) return [position[0], position[1], position[2]];
  const phi = Math.asin(Math.min(1, sinPhi)), axis = h.map(v => v / sinPhi);
  // Rodrigues rotation of u about axis by phi.
  const c = Math.cos(phi), s = Math.sin(phi), dot = axis[0] * u[0] + axis[1] * u[1] + axis[2] * u[2];
  const cross = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  const rotated = u.map((v, i) => v * c + cross[i] * s + axis[i] * dot * (1 - c));
  return [rotated[0] * length, rotated[1] * length, rotated[2] * length];
}
