/** Two one-dimensional models of a star's corona, each from published numbers of that star: gas at rest at one temperature,
 * and Parker's isothermal wind. Densities are electrons per cubic centimetre; radii are in stellar radii. */

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
