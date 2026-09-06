import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";

export const objectControls = Object.freeze({
  lenses: { title: PREPARED_SHELL_TITLES.lenses, defaultLens: "normal", controls: [
    { id: "normal", label: "Monochrome", description: "Dawn visible-light mosaic",
      title: "Dawn Framing Camera visible-light monochrome mosaic",
      thumbnailUrl: "/scenes/ceres/ceres-normal-thumbnail.webp" },
    { id: "enhanced", label: "Enhanced color", description: "False color · polar gaps",
      title: "Dawn PIA19977, 920 / 750 / 440 nm false color. Black south-polar areas have no image coverage.",
      thumbnailUrl: "/scenes/ceres/ceres-enhanced-thumbnail.webp" },
  ] },
  settings: { title: PREPARED_SHELL_TITLES.settings, controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "orbit", label: "Orbit", checked: true },
  ] },
});
