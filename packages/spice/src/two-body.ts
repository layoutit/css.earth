/**
 * Two-body propagation with universal variables (the algorithm of NAIF's
 * prop2b): advance a state under a point-mass GM by dt seconds. Used by SPK
 * type 5 segments, which store discrete states and propagate between them.
 */
import type { State } from './spk.js';
import { dot3 as dot } from '@cssearth/core';

/** Stumpff functions c2 and c3 of the universal anomaly parameter psi. */
function stumpff(psi: number) {
  if (psi > 1e-6) { const s = Math.sqrt(psi); return { c2: (1 - Math.cos(s)) / psi, c3: (s - Math.sin(s)) / (psi * s) }; }
  if (psi < -1e-6) { const s = Math.sqrt(-psi); return { c2: (1 - Math.cosh(s)) / psi, c3: (Math.sinh(s) - s) / (-psi * s) }; }
  return { c2: 1 / 2 - psi / 24 + psi * psi / 720, c3: 1 / 6 - psi / 120 + psi * psi / 5040 };
}

export function propagateTwoBody(gm: number, state: State, dt: number): State {
  if (!(gm > 0)) throw new Error('Two-body propagation needs a positive GM.');
  if (dt === 0) return { position: [...state.position] as [number, number, number], velocity: [...state.velocity] as [number, number, number] };
  const r0 = Math.hypot(...state.position), v0 = Math.hypot(...state.velocity), sqrtGm = Math.sqrt(gm);
  if (!(r0 > 0)) throw new Error('Two-body propagation from the origin is undefined.');
  const rv = dot(state.position, state.velocity), alpha = 2 / r0 - v0 * v0 / gm; // reciprocal semi-major axis
  // Initial guess for the universal anomaly chi.
  let chi = Math.abs(alpha) > 1e-12 ? (alpha > 0 ? sqrtGm * dt * alpha : Math.sign(dt) * Math.sqrt(-1 / alpha) * Math.log(-2 * gm * alpha * dt / (rv + Math.sign(dt) * Math.sqrt(-gm / alpha) * (1 - r0 * alpha))))
    : Math.sqrt(2) * Math.sign(dt) * Math.sqrt(Math.abs(dt) * sqrtGm / r0);
  if (!Number.isFinite(chi)) chi = sqrtGm * dt / r0;
  let c2 = 0, c3 = 0, psi = 0, r = r0;
  for (let i = 0; i < 60; i++) {
    psi = chi * chi * alpha; ({ c2, c3 } = stumpff(psi));
    r = chi * chi * c2 + rv / sqrtGm * chi * (1 - psi * c3) + r0 * (1 - psi * c2);
    const f = r0 * rv / sqrtGm * chi * chi * c2 + (1 - alpha * r0) * chi * chi * chi * c3 + r0 * chi - sqrtGm * dt;
    const step = f / r; chi -= step;
    if (Math.abs(step) < 1e-12 * Math.max(1, Math.abs(chi))) break;
  }
  psi = chi * chi * alpha; ({ c2, c3 } = stumpff(psi));
  r = chi * chi * c2 + rv / sqrtGm * chi * (1 - psi * c3) + r0 * (1 - psi * c2);
  const f = 1 - chi * chi * c2 / r0, g = dt - chi * chi * chi * c3 / sqrtGm;
  const position: [number, number, number] = [0, 1, 2].map(i => f * state.position[i] + g * state.velocity[i]) as [number, number, number];
  const fdot = sqrtGm / (r * r0) * chi * (psi * c3 - 1), gdot = 1 - chi * chi * c2 / r;
  const velocity: [number, number, number] = [0, 1, 2].map(i => fdot * state.position[i] + gdot * state.velocity[i]) as [number, number, number];
  return { position, velocity };
}
