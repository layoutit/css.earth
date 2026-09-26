import { PREPARED_SHELL_TITLES } from "./prepared-shell-titles.mjs";

export const SCIENTIFIC_CHART_TITLES = Object.freeze({
  reflectance: PREPARED_SHELL_TITLES.reflectance,
  photometricPhase: Object.freeze({ label: "Photometric phase curve" }),
  temperaturePressure: PREPARED_SHELL_TITLES.temperaturePressure,
  reflectedLight: Object.freeze({ label: "Reflected light" }),
  broadbandAlbedo: Object.freeze({ label: "Broadband albedo" }),
  transmissionSpectrum: Object.freeze({ label: "Transmission spectrum" }),
});
