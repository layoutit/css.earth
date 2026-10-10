// Derive a spherically symmetric 3D emissivity profile for Omega Centauri (NGC 5139) by
// Abel-inverting a single-mass King (1962) projected surface-density profile whose two shape
// parameters are fixed from measured/published-model structural radii (Baumgardt & Hilker 2018).
//
// This is a data-preparation script, not lab reconstruction code: it produces a small evidence
// table (radius, 3D emissivity) that a future baking capability would consume. All approximations
// used are stated explicitly and carried into physical-evidence.json.

const rc = 4.54;   // pc, measured 3D King core radius (Baumgardt & Hilker 2018 / Baumgardt et al. 2021)
const rh3D = 10.42; // pc, measured 3D half-mass radius (same source)

// Approximation A (authored): treat the empirical King (1962) projected-profile core radius as
// equal to the measured 3D core radius. This is the standard simplification used when only 3D
// structural radii (not a separate photometric King fit) are available.
//
// Approximation B (published-model): projected half-light radius ~= 0.75 x 3D half-mass radius,
// a well known approximate relation for a broad family of dynamical models (Wolf et al. 2010;
// Spitzer 1987 discusses the same order-unity ratio).
const projectedHalfLightTarget = 0.75 * rh3D; // pc

function sigmaShape(Rpc: number, q: number): number {
  // King (1962) empirical surface-density shape (unnormalized): [ (1+x^2)^-1/2 - (1+q^2)^-1/2 ]^2
  const x = Rpc / rc;
  if (x >= q) return 0;
  const g = 1 / Math.sqrt(1 + q * q);
  const f = 1 / Math.sqrt(1 + x * x) - g;
  return f > 0 ? f * f : 0;
}

function dSigmaShape_dR(Rpc: number, q: number): number {
  const x = Rpc / rc;
  if (x >= q) return 0;
  const g = 1 / Math.sqrt(1 + q * q);
  const inv = 1 / Math.sqrt(1 + x * x);
  const f = inv - g;
  if (f <= 0) return 0;
  const dfdx = -x * inv * inv * inv; // d/dx (1+x^2)^-1/2
  const dfdR = dfdx / rc;
  return 2 * f * dfdR;
}

function projectedHalfLightRadius(q: number): number {
  const rt = q * rc;
  const N = 4000, dR = rt / N;
  let cum = 0;
  const cumArr = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const R = i * dR;
    cumArr[i] = cum;
    // trapezoid increment for next step (Simpson-lite via midpoint refinement)
    const Rm = R + dR / 2;
    const mid = Rm <= rt ? sigmaShape(Rm, q) * Rm : 0;
    cum += mid * dR; // midpoint rule increment for integral of Sigma(R) * 2piR dR (2pi cancels in ratio)
  }
  const total = cum;
  const target = total / 2;
  for (let i = 0; i < N; i++) {
    if (cumArr[i] <= target && cumArr[i + 1] >= target) {
      const t = (target - cumArr[i]) / (cumArr[i + 1] - cumArr[i] || 1);
      return (i + t) * dR;
    }
  }
  return rt;
}

// Solve for q = rt/rc via bisection so the projected half-light radius matches the target.
let lo = 1.05, hi = 60;
for (let iter = 0; iter < 80; iter++) {
  const mid = (lo + hi) / 2;
  const rHalf = projectedHalfLightRadius(mid);
  if (rHalf < projectedHalfLightTarget) lo = mid; else hi = mid;
}
const q = (lo + hi) / 2;
const rt = q * rc;
const achievedHalf = projectedHalfLightRadius(q);
console.error(JSON.stringify({ q, concentrationLog10: Math.log10(q), rt_pc: rt, achievedProjectedHalfLight_pc: achievedHalf, targetProjectedHalfLight_pc: projectedHalfLightTarget }));

// Abel inversion via the r^2+u^2 substitution: rho(r) = -(1/pi) * integral_0^sqrt(rt^2-r^2) Sigma'(R(u)) du
function rho(r: number): number {
  if (r >= rt) return 0;
  const uMax = Math.sqrt(rt * rt - r * r);
  const N = 20000, du = uMax / N;
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) * du;
    const R = Math.sqrt(r * r + u * u);
    acc += (dSigmaShape_dR(R, q) / R) * du;
  }
  return -acc / Math.PI;
}

function rhoN(r: number, N: number): number {
  if (r >= rt) return 0;
  const uMax = Math.sqrt(rt * rt - r * r), du = uMax / N; let acc = 0;
  for (let i = 0; i < N; i++) { const u = (i + 0.5) * du; const R = Math.sqrt(r * r + u * u); acc += (dSigmaShape_dR(R, q) / R) * du; }
  return -acc / Math.PI;
}
for (const N of [2000, 8000, 32000, 128000]) {
  console.error('convergence N=', N, 'rho(0.01)=', rhoN(0.01, N), 'rho(0.5)=', rhoN(0.5, N), 'rho(1.16)=', rhoN(1.16, N), 'rho(2)=', rhoN(2, N), 'rho(4.54)=', rhoN(4.54, N), 'rho(10)=', rhoN(10, N));
}

const NR = 200;
const table = [];
let peak = 0;
for (let i = 0; i <= NR; i++) {
  const r = (i / NR) * rt;
  const v = Math.max(0, rho(r));
  peak = Math.max(peak, v);
  table.push(v);
}
const normalized = table.map(v => v / peak);

const output = {
  schema: 'omega-centauri-king-abel-profile@1',
  description: 'Spherically symmetric 3D relative emissivity vs radius, Abel-inverted from a single-mass King (1962) projected surface-density shape.',
  parameters: {
    coreRadiusPc: rc, halfMassRadiusPc3D: rh3D, projectedHalfLightTargetPc: projectedHalfLightTarget,
    solvedConcentrationRtOverRc: q, solvedConcentrationLog10: Math.log10(q), tidalRadiusPc: rt,
    achievedProjectedHalfLightPc: achievedHalf
  },
  approximations: [
    'A: projected (2D) King core radius set equal to the measured 3D core radius (authored simplification; no independent photometric King fit was located for this recipe).',
    'B: projected half-light radius = 0.75 x 3D half-mass radius (Wolf et al. 2010-type relation; published-model, not object-specific).'
  ],
  radialSamples: NR + 1,
  radiusPc: Array.from({ length: NR + 1 }, (_, i) => (i / NR) * rt),
  relativeEmissivity: normalized
};
console.log(JSON.stringify(output));
