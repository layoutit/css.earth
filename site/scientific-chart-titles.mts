import { PREPARED_SHELL_TITLES } from "./prepared-shell-titles.mjs";

export const SCIENTIFIC_CHART_TITLES = Object.freeze({
  reflectance: PREPARED_SHELL_TITLES.reflectance,
  photometricPhase: Object.freeze({ label: "Photometric phase curve" }),
  temperaturePressure: PREPARED_SHELL_TITLES.temperaturePressure,
});
