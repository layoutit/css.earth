/**
 * Length units, all expressed in metres. IAU 2012 / IAU 2015 nominal values.
 *
 * Frames declare their unit through these constants, which is what lets the
 * frame tree convert between a spacecraft measured in metres and a galaxy
 * catalogue measured in megaparsecs without either side losing precision.
 */
export const M_PER_KM = 1e3
export const M_PER_AU = 1.495978707e11
export const M_PER_LY = 9.4607304725808e15
export const M_PER_PC = 3.0856775814913673e16
export const M_PER_KPC = M_PER_PC * 1e3
export const M_PER_MPC = M_PER_PC * 1e6

/** Solar values, IAU 2015 Resolution B3 nominal. */
export const SOLAR_MASS_KG = 1.98892e30
export const SOLAR_RADIUS_M = 6.957e8
export const SOLAR_LUMINOSITY_W = 3.828e26

/** Speed of light, exact by definition. */
export const C_M_PER_S = 299792458
