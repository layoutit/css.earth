import { RAD_PER_DEG } from './angles.js'

// NAIF pck00011, BODY8 and BODY801/803-808 rotational elements.
// Days and Julian centuries since J2000; outputs in degrees.
const sinDeg = (deg: number): number => Math.sin(deg * RAD_PER_DEG)
const cosDeg = (deg: number): number => Math.cos(deg * RAD_PER_DEG)

export const NEPTUNE_ROTATION_MODELS = {
  neptune: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    return {
      rightAscensionDeg: 299.36 + 0.7 * sinDeg(n),
      declinationDeg: 43.46 - 0.51 * cosDeg(n),
      primeMeridianDeg: 249.978 + 541.1397757 * d - 0.48 * sinDeg(n),
      spinRateDegPerDay: 541.1397757,
    }
  },

  triton: (d: number, T: number) => {
    const n7 = 177.85 + 52.316 * T
    let rightAscensionDeg = 299.36
    let declinationDeg = 41.17
    let primeMeridianDeg = 296.53 - 61.2572637 * d
    const raCoefficients = [-32.35, -6.28, -2.08, -0.74, -0.28, -0.11, -0.07, -0.02, -0.01]
    const decCoefficients = [22.55, -2.1, 0.55, 0.16, 0.05, 0.02, 0.01]
    const wCoefficients = [22.25, 6.73, 2.05, 0.74, 0.28, 0.11, 0.05, 0.02, 0.01]
    for (let k = 0; k < raCoefficients.length; k++) rightAscensionDeg += raCoefficients[k]! * sinDeg((k + 1) * n7)
    for (let k = 0; k < decCoefficients.length; k++) declinationDeg += decCoefficients[k]! * cosDeg((k + 1) * n7)
    for (let k = 0; k < wCoefficients.length; k++) primeMeridianDeg += wCoefficients[k]! * sinDeg((k + 1) * n7)
    return { rightAscensionDeg, declinationDeg, primeMeridianDeg, spinRateDegPerDay: -61.2572637 }
  },

  // NAIF pck00011: BODY807; N5 = 35.36 + 14325.4 T.
  larissa: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    const n5 = 35.36 + 14325.4 * T
    return {
      rightAscensionDeg: 299.36 + 0.7 * sinDeg(n) - 0.27 * sinDeg(n5),
      declinationDeg: 43.41 - 0.51 * cosDeg(n) - 0.2 * cosDeg(n5),
      primeMeridianDeg: 179.41 + 649.053447 * d - 0.48 * sinDeg(n) + 0.19 * sinDeg(n5),
      spinRateDegPerDay: 649.053447,
    }
  },

  proteus: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    const n6 = 142.63 + 2824.6 * T
    return {
      rightAscensionDeg: 299.27 + 0.7 * sinDeg(n) - 0.05 * sinDeg(n6),
      declinationDeg: 42.91 - 0.51 * cosDeg(n) - 0.04 * cosDeg(n6),
      primeMeridianDeg: 93.38 + 320.7654228 * d - 0.48 * sinDeg(n) + 0.04 * sinDeg(n6),
      spinRateDegPerDay: 320.7654228,
    }
  },

  naiad: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    const k = 323.92 + 62606.6 * T
    return {
      rightAscensionDeg: 299.36 + 0.7 * sinDeg(n) + (-6.49) * sinDeg(k) + 0.25 * sinDeg(2 * k),
      declinationDeg: 43.36 - 0.51 * cosDeg(n) + (-4.75) * cosDeg(k) + 0.09 * cosDeg(2 * k),
      primeMeridianDeg: 254.06 + 1222.8441209 * d - 0.48 * sinDeg(n) + 4.4 * sinDeg(k) - 0.27 * sinDeg(2 * k),
      spinRateDegPerDay: 1222.8441209,
    }
  },

  thalassa: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    const k = 220.51 + 55064.2 * T
    return {
      rightAscensionDeg: 299.36 + 0.7 * sinDeg(n) + (-0.28) * sinDeg(k),
      declinationDeg: 43.45 - 0.51 * cosDeg(n) + (-0.21) * cosDeg(k),
      primeMeridianDeg: 102.06 + 1155.7555612 * d - 0.48 * sinDeg(n) + 0.19 * sinDeg(k),
      spinRateDegPerDay: 1155.7555612,
    }
  },

  despina: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    const k = 354.27 + 46564.5 * T
    return {
      rightAscensionDeg: 299.36 + 0.7 * sinDeg(n) + (-0.09) * sinDeg(k),
      declinationDeg: 43.45 - 0.51 * cosDeg(n) + (-0.07) * cosDeg(k),
      primeMeridianDeg: 306.51 + 1075.7341562 * d - 0.49 * sinDeg(n) + 0.06 * sinDeg(k),
      spinRateDegPerDay: 1075.7341562,
    }
  },

  galatea: (d: number, T: number) => {
    const n = 357.85 + 52.316 * T
    const k = 75.31 + 26109.4 * T
    return {
      rightAscensionDeg: 299.36 + 0.7 * sinDeg(n) + (-0.07) * sinDeg(k),
      declinationDeg: 43.43 - 0.51 * cosDeg(n) + (-0.05) * cosDeg(k),
      primeMeridianDeg: 258.09 + 839.6597686 * d - 0.48 * sinDeg(n) + 0.05 * sinDeg(k),
      spinRateDegPerDay: 839.6597686,
    }
  },

}
