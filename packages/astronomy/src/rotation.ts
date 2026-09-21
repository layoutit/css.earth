import { NEPTUNE_ROTATION_MODELS } from './rotation-neptune.js'
import { RAD_PER_DEG, normalizeAngleRad } from './angles.js'
import { DAYS_PER_JULIAN_CENTURY, J2000_JD } from './time.js'
import type { Vec3 } from './vec3.js'

/**
 * IAU WGCCRE rotational elements — Report of the IAU Working Group on
 * Cartographic Coordinates and Rotational Elements: 2015, Archinal et al.,
 * Celest. Mech. Dyn. Astr. 130:22 (2018), with the 2011 erratum applied.
 *
 * THIS IS NOT PART OF THE FRAME TREE, and must not become part of it. Frames
 * are translation-only and share ICRF axes (`frames.ts`); a body's spin does
 * not move its frame origin. This module exists so the renderer can orient an
 * ellipsoid, and it is deliberately a separate export with no `Frame` in sight.
 *
 * The convention: `poleRightAscensionRad` and `poleDeclinationRad` locate the
 * body's north pole in ICRF, and `primeMeridianRad` (W) is measured eastward
 * along the equator from the ascending node of the body equator on the ICRF
 * equator. `bodyFixedToIcrf` builds the matrix those three define.
 *
 * Arguments: `T` is Julian centuries and `d` is days, both from J2000 TDB. This
 * package's epochs are TT, which differs from TDB by under 2 ms — 3e-6 degrees
 * of Earth rotation, and less for everything else.
 */
export interface RotationElements {
  readonly poleRightAscensionRad: number
  readonly poleDeclinationRad: number
  /** W, wrapped to `[0, 2π)`. */
  readonly primeMeridianRad: number
  /** dW/dt, radians per day. The secular rate only; periodic terms are not differentiated. */
  readonly spinRateRadPerDay: number
}

const sinDeg = (deg: number): number => Math.sin(deg * RAD_PER_DEG)
const cosDeg = (deg: number): number => Math.cos(deg * RAD_PER_DEG)

interface RawElements {
  /** Degrees. */
  readonly rightAscensionDeg: number
  readonly declinationDeg: number
  readonly primeMeridianDeg: number
  /** Degrees per day. */
  readonly spinRateDegPerDay: number
}

/**
 * Every model below is written as a function of `(d, T)` returning degrees,
 * transcribed from the 2015 report's tables. The tables are the specification;
 * `rotation.horizons.test.ts` checks each one against the orientation Horizons
 * itself uses, which is the only way a transcription slip in a periodic term
 * shows up.
 */
type Model = (d: number, T: number) => RawElements

const MODELS: Record<string, Model> = {
  sun: (d) => ({
    rightAscensionDeg: 286.13,
    declinationDeg: 63.87,
    primeMeridianDeg: 84.176 + 14.1844 * d,
    spinRateDegPerDay: 14.1844,
  }),

  mercury: (d, T) => {
    const m1 = 174.7910857 + 4.092335 * d
    const m2 = 349.5821714 + 8.40467 * d
    const m3 = 164.3732571 + 12.60701 * d
    const m4 = 339.1643429 + 16.80934 * d
    const m5 = 153.9554286 + 21.01167 * d
    return {
      rightAscensionDeg: 281.0103 - 0.0328 * T,
      declinationDeg: 61.4155 - 0.0049 * T,
      primeMeridianDeg:
        329.5988 +
        6.1385108 * d +
        0.01067257 * sinDeg(m1) -
        0.00112309 * sinDeg(m2) -
        0.0001104 * sinDeg(m3) -
        0.00002539 * sinDeg(m4) -
        0.00000571 * sinDeg(m5),
      spinRateDegPerDay: 6.1385108,
    }
  },

  venus: (d) => ({
    rightAscensionDeg: 272.76,
    declinationDeg: 67.16,
    primeMeridianDeg: 160.2 - 1.4813688 * d,
    spinRateDegPerDay: -1.4813688,
  }),

  earth: (d, T) => ({
    rightAscensionDeg: 0.0 - 0.641 * T,
    declinationDeg: 90.0 - 0.557 * T,
    primeMeridianDeg: 190.147 + 360.9856235 * d,
    spinRateDegPerDay: 360.9856235,
  }),

  moon: (d, T) => {
    const e1 = 125.045 - 0.0529921 * d
    const e2 = 250.089 - 0.1059842 * d
    const e3 = 260.008 + 13.0120009 * d
    const e4 = 176.625 + 13.3407154 * d
    const e5 = 357.529 + 0.9856003 * d
    const e6 = 311.589 + 26.4057084 * d
    const e7 = 134.963 + 13.064993 * d
    const e8 = 276.617 + 0.3287146 * d
    const e9 = 34.226 + 1.7484877 * d
    const e10 = 15.134 - 0.1589763 * d
    const e11 = 119.743 + 0.0036096 * d
    const e12 = 239.961 + 0.1643573 * d
    const e13 = 25.053 + 12.9590088 * d
    return {
      rightAscensionDeg:
        269.9949 +
        0.0031 * T -
        3.8787 * sinDeg(e1) -
        0.1204 * sinDeg(e2) +
        0.07 * sinDeg(e3) -
        0.0172 * sinDeg(e4) +
        0.0072 * sinDeg(e6) -
        0.0052 * sinDeg(e10) +
        0.0043 * sinDeg(e13),
      declinationDeg:
        66.5392 +
        0.013 * T +
        1.5419 * cosDeg(e1) +
        0.0239 * cosDeg(e2) -
        0.0278 * cosDeg(e3) +
        0.0068 * cosDeg(e4) -
        0.0029 * cosDeg(e6) +
        0.0009 * cosDeg(e7) +
        0.0008 * cosDeg(e10) -
        0.0009 * cosDeg(e13),
      primeMeridianDeg:
        38.3213 +
        13.17635815 * d -
        1.4e-12 * d * d +
        3.561 * sinDeg(e1) +
        0.1208 * sinDeg(e2) -
        0.0642 * sinDeg(e3) +
        0.0158 * sinDeg(e4) +
        0.0252 * sinDeg(e5) -
        0.0066 * sinDeg(e6) -
        0.0047 * sinDeg(e7) -
        0.0046 * sinDeg(e8) +
        0.0028 * sinDeg(e9) +
        0.0052 * sinDeg(e10) +
        0.004 * sinDeg(e11) +
        0.0019 * sinDeg(e12) -
        0.0044 * sinDeg(e13),
      spinRateDegPerDay: 13.17635815,
    }
  },

  mars: (d, T) => ({
    rightAscensionDeg:
      317.269202 -
      0.10927547 * T +
      0.000068 * sinDeg(198.991226 + 19139.4819985 * T) +
      0.000238 * sinDeg(226.292679 + 38280.8511281 * T) +
      0.000052 * sinDeg(249.663391 + 57420.7251593 * T) +
      0.000009 * sinDeg(266.18351 + 76560.636795 * T) +
      0.419057 * sinDeg(79.398797 + 0.5042615 * T),
    declinationDeg:
      54.432516 -
      0.05827105 * T +
      0.000051 * cosDeg(122.433576 + 19139.9407476 * T) +
      0.000141 * cosDeg(43.058401 + 38280.8753272 * T) +
      0.000031 * cosDeg(57.663379 + 57420.7517205 * T) +
      0.000005 * cosDeg(79.476401 + 76560.6495004 * T) +
      1.591274 * cosDeg(166.325722 + 0.5042615 * T),
    primeMeridianDeg:
      176.049863 +
      350.891982443297 * d +
      0.000145 * sinDeg(129.071773 + 19140.0328244 * T) +
      0.000157 * sinDeg(36.352167 + 38281.0473591 * T) +
      0.00004 * sinDeg(56.668646 + 57420.929536 * T) +
      0.000001 * sinDeg(67.364003 + 76560.2552215 * T) +
      0.000001 * sinDeg(104.79268 + 95700.4387578 * T) +
      0.584542 * sinDeg(95.391654 + 0.5042615 * T),
    spinRateDegPerDay: 350.891982443297,
  }),

  // Phobos and Deimos: the 2015 report as corrected by Archinal et al. (2019),
  // transcribed from NAIF `pck00011.tpc` (BODY401_*, BODY402_*). The angles
  // M1 to M10 are the first ten BODY4_NUT_PREC_ANGLES, in degrees with T in
  // Julian centuries; M5 alone has a quadratic term (BODY4_MAX_PHASE_DEGREE = 2).
  phobos: (d, T) => {
    const m1 = 190.72646643 + 15917.10818695 * T
    const m2 = 21.4689247 + 31834.27934054 * T
    const m3 = 332.86082793 + 19139.89694742 * T
    const m4 = 394.93256437 + 38280.79631835 * T
    const m5 = 189.6327156 + 41215158.1842005 * T + 12.711923222 * T * T
    return {
      rightAscensionDeg:
        317.67071657 -
        0.10844326 * T -
        1.78428399 * sinDeg(m1) +
        0.02212824 * sinDeg(m2) -
        0.01028251 * sinDeg(m3) -
        0.00475595 * sinDeg(m4),
      declinationDeg:
        52.88627266 -
        0.06134706 * T -
        1.07516537 * cosDeg(m1) +
        0.00668626 * cosDeg(m2) -
        0.0064874 * cosDeg(m3) +
        0.00281576 * cosDeg(m4),
      primeMeridianDeg:
        35.1877444 +
        1128.84475928 * d +
        12.72192797 * T * T +
        1.42421769 * sinDeg(m1) -
        0.02273783 * sinDeg(m2) +
        0.00410711 * sinDeg(m3) +
        0.00631964 * sinDeg(m4) -
        1.143 * sinDeg(m5),
      spinRateDegPerDay: 1128.84475928,
    }
  },

  deimos: (d, T) => {
    const m6 = 121.46893664 + 660.22803474 * T
    const m7 = 231.05028581 + 660.9912354 * T
    const m8 = 251.37314025 + 1320.50145245 * T
    const m9 = 217.98635955 + 38279.9612555 * T
    const m10 = 196.19729402 + 19139.83628608 * T
    return {
      rightAscensionDeg:
        316.65705808 -
        0.10518014 * T +
        3.09217726 * sinDeg(m6) +
        0.22980637 * sinDeg(m7) +
        0.06418655 * sinDeg(m8) +
        0.02533537 * sinDeg(m9) +
        0.00778695 * sinDeg(m10),
      declinationDeg:
        53.50992033 -
        0.05979094 * T +
        1.83936004 * cosDeg(m6) +
        0.1432532 * cosDeg(m7) +
        0.01911409 * cosDeg(m8) -
        0.0148259 * cosDeg(m9) +
        0.0019243 * cosDeg(m10),
      primeMeridianDeg:
        79.39932954 +
        285.16188899 * d -
        2.73954829 * sinDeg(m6) -
        0.39968606 * sinDeg(m7) -
        0.06563259 * sinDeg(m8) -
        0.0291294 * sinDeg(m9) +
        0.0169916 * sinDeg(m10),
      spinRateDegPerDay: 285.16188899,
    }
  },

  jupiter: (d, T) => {
    const ja = 99.360714 + 4850.4046 * T
    const jb = 175.895369 + 1191.9605 * T
    const jc = 300.323162 + 262.5475 * T
    const jd = 114.012305 + 6070.2476 * T
    const je = 49.511251 + 64.3 * T
    return {
      rightAscensionDeg:
        268.056595 -
        0.006499 * T +
        0.000117 * sinDeg(ja) +
        0.000938 * sinDeg(jb) +
        0.001432 * sinDeg(jc) +
        0.00003 * sinDeg(jd) +
        0.00215 * sinDeg(je),
      declinationDeg:
        64.495303 +
        0.002413 * T +
        0.00005 * cosDeg(ja) +
        0.000404 * cosDeg(jb) +
        0.000617 * cosDeg(jc) -
        0.000013 * cosDeg(jd) +
        0.000926 * cosDeg(je),
      primeMeridianDeg: 284.95 + 870.536 * d,
      spinRateDegPerDay: 870.536,
    }
  },

  // IAU/WGCCRE coefficients archived in NAIF pck00011, including J1/J2 terms.
  amalthea: (d, T) => {
    const j1 = 73.32 + 91472.9 * T
    return {
      rightAscensionDeg: 268.05 - 0.009 * T - 0.84 * sinDeg(j1) + 0.01 * sinDeg(2 * j1),
      declinationDeg: 64.49 + 0.003 * T - 0.36 * cosDeg(j1),
      primeMeridianDeg: 231.67 + 722.631456 * d + 0.76 * sinDeg(j1) - 0.01 * sinDeg(2 * j1),
      spinRateDegPerDay: 722.631456,
    }
  },
  thebe: (d, T) => {
    const j2 = 24.62 + 45137.2 * T
    return {
      rightAscensionDeg: 268.05 - 0.009 * T - 2.11 * sinDeg(j2) + 0.04 * sinDeg(2 * j2),
      declinationDeg: 64.49 + 0.003 * T - 0.91 * cosDeg(j2) + 0.01 * cosDeg(2 * j2),
      primeMeridianDeg: 8.56 + 533.700410 * d + 1.91 * sinDeg(j2) - 0.04 * sinDeg(2 * j2),
      spinRateDegPerDay: 533.700410,
    }
  },
  adrastea: (d, T) => ({
    rightAscensionDeg: 268.05 - 0.009 * T,
    declinationDeg: 64.49 + 0.003 * T,
    primeMeridianDeg: 33.29 + 1206.9986602 * d,
    spinRateDegPerDay: 1206.9986602,
  }),
  metis: (d, T) => ({
    rightAscensionDeg: 268.05 - 0.009 * T,
    declinationDeg: 64.49 + 0.003 * T,
    primeMeridianDeg: 346.09 + 1221.2547301 * d,
    spinRateDegPerDay: 1221.2547301,
  }),

  io: (d, T) => {
    const j3 = 283.9 + 4850.7 * T
    const j4 = 355.8 + 1191.3 * T
    return {
      rightAscensionDeg: 268.05 - 0.009 * T + 0.094 * sinDeg(j3) + 0.024 * sinDeg(j4),
      declinationDeg: 64.5 + 0.003 * T + 0.04 * cosDeg(j3) + 0.011 * cosDeg(j4),
      primeMeridianDeg: 200.39 + 203.4889538 * d - 0.085 * sinDeg(j3) - 0.022 * sinDeg(j4),
      spinRateDegPerDay: 203.4889538,
    }
  },

  europa: (d, T) => {
    const j4 = 355.8 + 1191.3 * T
    const j5 = 119.9 + 262.1 * T
    const j6 = 229.8 + 64.3 * T
    const j7 = 352.25 + 2382.6 * T
    return {
      rightAscensionDeg: 268.08 - 0.009 * T + 1.086 * sinDeg(j4) + 0.06 * sinDeg(j5) + 0.015 * sinDeg(j6) + 0.009 * sinDeg(j7),
      declinationDeg: 64.51 + 0.003 * T + 0.468 * cosDeg(j4) + 0.026 * cosDeg(j5) + 0.007 * cosDeg(j6) + 0.002 * cosDeg(j7),
      primeMeridianDeg:
        36.022 + 101.3747235 * d - 0.98 * sinDeg(j4) - 0.054 * sinDeg(j5) - 0.014 * sinDeg(j6) - 0.008 * sinDeg(j7),
      spinRateDegPerDay: 101.3747235,
    }
  },

  ganymede: (d, T) => {
    const j4 = 355.8 + 1191.3 * T
    const j5 = 119.9 + 262.1 * T
    const j6 = 229.8 + 64.3 * T
    return {
      rightAscensionDeg: 268.2 - 0.009 * T - 0.037 * sinDeg(j4) + 0.431 * sinDeg(j5) + 0.091 * sinDeg(j6),
      declinationDeg: 64.57 + 0.003 * T - 0.016 * cosDeg(j4) + 0.186 * cosDeg(j5) + 0.039 * cosDeg(j6),
      primeMeridianDeg: 44.064 + 50.3176081 * d + 0.033 * sinDeg(j4) - 0.389 * sinDeg(j5) - 0.082 * sinDeg(j6),
      spinRateDegPerDay: 50.3176081,
    }
  },

  callisto: (d, T) => {
    const j5 = 119.9 + 262.1 * T
    const j6 = 229.8 + 64.3 * T
    const j8 = 113.35 + 6070.0 * T
    return {
      rightAscensionDeg: 268.72 - 0.009 * T - 0.068 * sinDeg(j5) + 0.59 * sinDeg(j6) + 0.01 * sinDeg(j8),
      declinationDeg: 64.83 + 0.003 * T - 0.029 * cosDeg(j5) + 0.254 * cosDeg(j6) - 0.004 * cosDeg(j8),
      primeMeridianDeg: 259.51 + 21.5710715 * d + 0.061 * sinDeg(j5) - 0.533 * sinDeg(j6) - 0.009 * sinDeg(j8),
      spinRateDegPerDay: 21.5710715,
    }
  },

  saturn: (d, T) => ({
    rightAscensionDeg: 40.589 - 0.036 * T,
    declinationDeg: 83.537 - 0.004 * T,
    primeMeridianDeg: 38.9 + 810.7939024 * d,
    spinRateDegPerDay: 810.7939024,
  }),

  mimas: (d, T) => {
    const s3 = 177.4 - 36505.5 * T
    const s5 = 316.45 + 506.2 * T
    return {
      rightAscensionDeg: 40.66 - 0.036 * T + 13.56 * sinDeg(s3),
      declinationDeg: 83.52 - 0.004 * T - 1.53 * cosDeg(s3),
      primeMeridianDeg: 333.46 + 381.994555 * d - 13.48 * sinDeg(s3) - 44.85 * sinDeg(s5),
      spinRateDegPerDay: 381.994555,
    }
  },

  enceladus: (d, T) => ({
    rightAscensionDeg: 40.66 - 0.036 * T,
    declinationDeg: 83.52 - 0.004 * T,
    primeMeridianDeg: 6.32 + 262.7318996 * d,
    spinRateDegPerDay: 262.7318996,
  }),

  tethys: (d, T) => {
    const s4 = 300.0 - 7225.9 * T
    const s5 = 316.45 + 506.2 * T
    return {
      rightAscensionDeg: 40.66 - 0.036 * T + 9.66 * sinDeg(s4),
      declinationDeg: 83.52 - 0.004 * T - 1.09 * cosDeg(s4),
      primeMeridianDeg: 8.95 + 190.6979085 * d - 9.6 * sinDeg(s4) + 2.23 * sinDeg(s5),
      spinRateDegPerDay: 190.6979085,
    }
  },

  dione: (d, T) => ({
    rightAscensionDeg: 40.66 - 0.036 * T,
    declinationDeg: 83.52 - 0.004 * T,
    primeMeridianDeg: 357.6 + 131.5349316 * d,
    spinRateDegPerDay: 131.5349316,
  }),

  rhea: (d, T) => {
    const s6 = 345.2 - 1016.3 * T
    return {
      rightAscensionDeg: 40.38 - 0.036 * T + 3.1 * sinDeg(s6),
      declinationDeg: 83.55 - 0.004 * T - 0.35 * cosDeg(s6),
      primeMeridianDeg: 235.16 + 79.6900478 * d - 3.08 * sinDeg(s6),
      spinRateDegPerDay: 79.6900478,
    }
  },

  titan: (d) => ({
    rightAscensionDeg: 39.4827,
    declinationDeg: 83.4279,
    primeMeridianDeg: 186.5855 + 22.5769768 * d,
    spinRateDegPerDay: 22.5769768,
  }),

  iapetus: (d, T) => ({
    rightAscensionDeg: 318.16 - 3.949 * T,
    declinationDeg: 75.03 - 1.143 * T,
    primeMeridianDeg: 355.2 + 4.5379572 * d,
    spinRateDegPerDay: 4.5379572,
  }),

  uranus: (d) => ({
    rightAscensionDeg: 257.311,
    declinationDeg: -15.175,
    primeMeridianDeg: 203.81 - 501.1600928 * d,
    spinRateDegPerDay: -501.1600928,
  }),

  miranda: (d, T) => {
    const u11 = 141.69 + 41887.66 * T
    const u12 = 316.41 + 2863.96 * T
    return {
      rightAscensionDeg: 257.43 + 4.41 * sinDeg(u11) - 0.04 * sinDeg(2 * u11),
      declinationDeg: -15.08 + 4.25 * cosDeg(u11) - 0.02 * cosDeg(2 * u11),
      primeMeridianDeg:
        30.7 -
        254.6906892 * d -
        1.27 * sinDeg(u12) +
        0.15 * sinDeg(2 * u12) +
        1.15 * sinDeg(u11) -
        0.09 * sinDeg(2 * u11),
      spinRateDegPerDay: -254.6906892,
    }
  },

  ariel: (d, T) => {
    const u12 = 316.41 + 2863.96 * T
    const u13 = 304.01 - 51.94 * T
    return {
      rightAscensionDeg: 257.43 + 0.29 * sinDeg(u13),
      declinationDeg: -15.1 + 0.28 * cosDeg(u13),
      primeMeridianDeg: 156.22 - 142.8356681 * d + 0.05 * sinDeg(u12) + 0.08 * sinDeg(u13),
      spinRateDegPerDay: -142.8356681,
    }
  },

  umbriel: (d, T) => {
    const u11 = 141.69 + 41887.66 * T
    const u12 = 316.41 + 2863.96 * T
    const u14 = 308.71 - 93.17 * T
    return {
      rightAscensionDeg: 257.43 + 0.21 * sinDeg(u14),
      declinationDeg: -15.1 + 0.2 * cosDeg(u14),
      primeMeridianDeg: 108.05 - 86.8688923 * d - 0.09 * sinDeg(u11) + 0.06 * sinDeg(u12),
      spinRateDegPerDay: -86.8688923,
    }
  },

  titania: (d, T) => {
    const u15 = 340.82 - 75.32 * T
    return {
      rightAscensionDeg: 257.43 + 0.29 * sinDeg(u15),
      declinationDeg: -15.1 + 0.28 * cosDeg(u15),
      primeMeridianDeg: 77.74 - 41.3514316 * d + 0.08 * sinDeg(u15),
      spinRateDegPerDay: -41.3514316,
    }
  },

  oberon: (d, T) => {
    const u16 = 259.14 - 504.81 * T
    return {
      rightAscensionDeg: 257.43 + 0.16 * sinDeg(u16),
      declinationDeg: -15.1 + 0.16 * cosDeg(u16),
      primeMeridianDeg: 6.77 - 26.7394932 * d + 0.04 * sinDeg(u16),
      spinRateDegPerDay: -26.7394932,
    }
  },

  ...NEPTUNE_ROTATION_MODELS,

  // Dwarf planets. Only Pluto and Ceres have a published pole here — Eris,
  // Haumea and Makemake genuinely have none (no resolved-disk imagery to
  // derive one from), and `ROTATING_BODY_IDS` correctly does not include them;
  // `rotation.test.ts` pins that `bodyRotationAt` keeps throwing for those
  // three, and says why.

  // Post-New-Horizons solution (Pluto is tidally locked to Charon, so this
  // pole is static — no secular T term the way Uranus or Neptune's poles
  // have one). Source: NAIF generic PCK `pck00011.tpc`, BODY999_POLE_RA /
  // _POLE_DEC / _PM, which transcribes the WGCCRE-report-style constants JPL
  // maintains post-encounter; `rotation.horizons.test.ts` is what actually
  // checks this against Horizons' own orientation.
  pluto: (d) => ({
    rightAscensionDeg: 132.993,
    declinationDeg: -6.163,
    primeMeridianDeg: 302.695 + 56.3625225 * d,
    spinRateDegPerDay: 56.3625225,
  }),

  // NAIF pck00011.tpc BODY901; synchronous with Pluto, opposite prime meridian.
  charon: (d) => ({
    rightAscensionDeg: 132.993,
    declinationDeg: -6.163,
    primeMeridianDeg: 122.695 + 56.3625225 * d,
    spinRateDegPerDay: 56.3625225,
  }),

  // Dawn-mission solution. Source: NAIF `dawn_ceres_v05.tpc`,
  // BODY2000001_POLE_RA / _POLE_DEC / _PM.
  ceres: (d) => ({
    rightAscensionDeg: 291.418,
    declinationDeg: 66.764,
    primeMeridianDeg: 170.65 + 952.1532 * d,
    spinRateDegPerDay: 952.1532,
  }),
}

export type RotatingBodyId = keyof typeof MODELS & string

export const ROTATING_BODY_IDS = Object.keys(MODELS) as readonly RotatingBodyId[]

/** Rotational elements of `body` at `epochJdTt`. */
export const bodyRotationAt = (body: RotatingBodyId, epochJdTt: number): RotationElements => {
  const model = MODELS[body]
  if (!model) throw new Error(`no IAU rotation model for body: ${body}`)
  const d = epochJdTt - J2000_JD
  const T = d / DAYS_PER_JULIAN_CENTURY
  const raw = model(d, T)
  return {
    poleRightAscensionRad: normalizeAngleRad(raw.rightAscensionDeg * RAD_PER_DEG),
    poleDeclinationRad: raw.declinationDeg * RAD_PER_DEG,
    primeMeridianRad: normalizeAngleRad(raw.primeMeridianDeg * RAD_PER_DEG),
    spinRateRadPerDay: raw.spinRateDegPerDay * RAD_PER_DEG,
  }
}

/**
 * The body's north pole direction in ICRF — the third column of
 * `bodyFixedToIcrf`, and all the renderer needs for axial tilt alone.
 */
export const bodyPoleIcrf = (elements: RotationElements): Vec3 => {
  const cosDeclination = Math.cos(elements.poleDeclinationRad)
  return [
    cosDeclination * Math.cos(elements.poleRightAscensionRad),
    cosDeclination * Math.sin(elements.poleRightAscensionRad),
    Math.sin(elements.poleDeclinationRad),
  ]
}

/**
 * Rotation from body-fixed coordinates to ICRF, row-major 3×3.
 *
 * `Rz(α0 + 90°) Rx(90° − δ0) Rz(W)`, the WGCCRE definition. Its columns are the
 * body's own x, y and z axes expressed in ICRF, which is the form a renderer
 * wants: column 0 points at the prime meridian on the equator, column 2 at the
 * north pole.
 */
export const bodyFixedToIcrf = (elements: RotationElements): readonly number[] => {
  const a = elements.poleRightAscensionRad + Math.PI / 2
  const b = Math.PI / 2 - elements.poleDeclinationRad
  const w = elements.primeMeridianRad
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  return [
    ca * cw - sa * cb * sw, -ca * sw - sa * cb * cw, sa * sb,
    sa * cw + ca * cb * sw, -sa * sw + ca * cb * cw, -ca * sb,
    sb * sw, sb * cw, cb,
  ]
}
