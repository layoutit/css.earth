/** Two one-dimensional models of a star's corona, each from published numbers of that star: gas at rest at one temperature,
 * and Parker's isothermal wind; and the two published relations that stand in for a temperature or a mass loss nobody has
 * measured. Densities are electrons per cubic centimetre; radii are in stellar radii. */

export const K_B = 1.380649e-16, HYDROGEN_MASS_G = 1.6735575e-24, PROTON_MASS_G = 1.67262192e-24, G_CGS = 6.6743e-8;
export const SOLAR_MASS_G = 1.98841e33, SOLAR_RADIUS_CM = 6.957e10, KELVIN_PER_KEV = 1.160451812e7, SECONDS_PER_YEAR = 3.15576e7;
/** Mean particle mass of fully ionised gas of solar composition, in hydrogen masses; and the mass per free electron. */
export const MEAN_PARTICLE = 0.6, MASS_PER_ELECTRON = 1.17;

/** Radiated power per unit emission measure, Λ(T) = 10^-18.8 T^-1/2 erg cm³ s⁻¹: the single power law of Rosner, Tucker & Vaiana
 * (1978, ApJ 220, 643) for solar metallicity, as arXiv:2303.17469 prints it after its equation 13. It is the total loss, not
 * the loss inside an X-ray band, so an emission measure from a band luminosity is a lower bound. */
export const LOSS = Object.freeze({ logChi: -18.8, alpha: -0.5 });
export const lossFunction = (kelvin: number) => 10 ** LOSS.logChi * kelvin ** LOSS.alpha;

/** Gas at rest at one temperature under the star's gravity: n(r) = n0 exp(-(R/H)(1 - R/r)), H = kT / (μ m_H g). The base
 * density n0 is the one whose emission measure, integrated to `outerRadii`, radiates the X-ray luminosity. */
export function hydrostaticCorona(input: { xrayLuminosityErgS: number; kelvin: number; massSolar: number; radiusSolar: number; outerRadii: number }) {
  const radiusCm = input.radiusSolar * SOLAR_RADIUS_CM, gravity = G_CGS * input.massSolar * SOLAR_MASS_G / radiusCm ** 2;
  const scaleHeightRadii = K_B * input.kelvin / (MEAN_PARTICLE * HYDROGEN_MASS_G * gravity) / radiusCm;
  const shape = (x: number) => Math.exp(-(1 - 1 / x) / scaleHeightRadii);
  let integral = 0; const steps = 8000, dx = (input.outerRadii - 1) / steps;
  for (let i = 0; i < steps; i++) { const x = 1 + (i + 0.5) * dx; integral += shape(x) ** 2 * x * x * dx; }
  const emissionMeasure = input.xrayLuminosityErgS / lossFunction(input.kelvin);
  const base = Math.sqrt(emissionMeasure / (4 * Math.PI * radiusCm ** 3 * integral));
  return { kelvin: input.kelvin, scaleHeightRadii, emissionMeasure, basePerCm3: base, density: (x: number) => base * shape(x) };
}

/** Parker's (1958, ApJ 128, 664) isothermal wind: Mach² - ln Mach² = 4 ln(r/rc) + 4 rc/r - 3, slower than sound inside
 * rc = GM / (2 cs²) and faster outside. Mass conservation gives the density: n = Ṁ / (4π r² m u). */
export function parkerWind(input: { massLossGramsPerSecond: number; kelvin: number; massSolar: number; radiusSolar: number }) {
  const radiusCm = input.radiusSolar * SOLAR_RADIUS_CM, sound = Math.sqrt(K_B * input.kelvin / (MEAN_PARTICLE * HYDROGEN_MASS_G));
  const criticalRadii = G_CGS * input.massSolar * SOLAR_MASS_G / (2 * sound * sound) / radiusCm;
  const mach = (x: number) => {
    const target = 4 * Math.log(x / criticalRadii) + 4 * criticalRadii / x - 3;
    let low = x < criticalRadii ? 1e-12 : 1, high = x < criticalRadii ? 1 : 1e6;
    for (let i = 0; i < 200; i++) { const mid = (low + high) / 2, value = mid - Math.log(mid);
      if ((value > target) === (x < criticalRadii)) low = mid; else high = mid; }
    return Math.sqrt((low + high) / 2);
  };
  const speedKmS = (x: number) => mach(x) * sound / 1e5;
  const density = (x: number) => input.massLossGramsPerSecond / (4 * Math.PI * (x * radiusCm) ** 2 * MASS_PER_ELECTRON * HYDROGEN_MASS_G * mach(x) * sound);
  return { kelvin: input.kelvin, soundKmS: sound / 1e5, criticalRadii, speedKmS, basePerCm3: density(1), density };
}

/** The X-ray flux leaving each square centimetre of the surface, erg s⁻¹ cm⁻². */
export const xraySurfaceFlux = (xrayLuminosityErgS: number, radiusSolar: number) => xrayLuminosityErgS / (4 * Math.PI * (radiusSolar * SOLAR_RADIUS_CM) ** 2);

/** Johnstone & Güdel (2015, A&A 578, A129, equation 4): the mean coronal temperature of a low-mass main-sequence star from
 * its X-ray surface flux, T = 0.11 F_X^0.26 million kelvin, fitted to 24 stars with F_X from 4.4e3 to 4.0e7. */
export const JOHNSTONE_GUEDEL_2015 = Object.freeze({ coefficientMK: 0.11, index: 0.26, surfaceFluxRange: [4.44e3, 4.04e7] as const });
export const coronalTemperatureFromSurfaceFlux = (surfaceFlux: number) => JOHNSTONE_GUEDEL_2015.coefficientMK * 1e6 * surfaceFlux ** JOHNSTONE_GUEDEL_2015.index;

/** Wood et al. (2021, ApJ 915, 37): the mass loss through each unit of surface rises as F_X^0.77 (their section 5.1). The
 * paper prints the slope and no normalisation. `anchorLogSurfaceFlux` is the F_X at which a line of that slope through the
 * median of the paper's own Table 3 has the Sun's mass loss per unit surface: the 11 single main-sequence stars with an
 * astrospheric detection (models.test.mts holds the rows). Those stars lie about the line with an rms of `scatterDex`; the one
 * farthest below it, π¹ UMa, is `lowestDex` under. */
export const WOOD_2021 = Object.freeze({ index: 0.77, anchorLogSurfaceFlux: 4.53, scatterDex: 0.69, lowestDex: -1.58, highestDex: 0.77, stars: 11, solarMassLossSolarMassesPerYear: 2e-14 });
/** Mass loss in units of the Sun's, from that relation. */
export const massLossFromSurfaceFlux = (surfaceFlux: number, radiusSolar: number) => radiusSolar ** 2 * (surfaceFlux / 10 ** WOOD_2021.anchorLogSurfaceFlux) ** WOOD_2021.index;
