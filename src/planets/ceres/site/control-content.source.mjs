import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";

export const objectControls = Object.freeze({
  lenses: { title: PREPARED_SHELL_TITLES.lenses, defaultLens: "normal", controls: [
    { id: "normal", label: "Monochrome", description: "Dawn visible-light mosaic",
      title: "Dawn Framing Camera visible-light monochrome mosaic. Gray grid marks missing imagery.",
      thumbnailUrl: "/scenes/ceres/ceres-normal-thumbnail.webp" },
    { id: "enhanced", label: "Enhanced color", description: "False color · gray grid marks gaps",
      title: "Dawn PIA19977, 920 / 750 / 440 nm false color. Gray grid marks missing south-polar imagery; it is not inferred terrain.",
      thumbnailUrl: "/scenes/ceres/ceres-enhanced-thumbnail.webp" },
  ] },
  settings: { title: PREPARED_SHELL_TITLES.settings, controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "orbit", label: "Orbit", checked: true },
  ] },
});
