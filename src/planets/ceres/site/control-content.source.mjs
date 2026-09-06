import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { SCIENCE_LENSES } from "../science-lenses.mjs";

export const objectControls = Object.freeze({
  lenses: prepareLensLabels({ title: PREPARED_SHELL_TITLES.lenses, defaultLens: "normal", controls: [
    { id: "normal", label: "Monochrome", description: "Dawn visible-light mosaic",
      title: "Dawn visible-light mosaic. Original image shadows remain; added globe lighting is approximate. Gray grid marks identified gaps; uncertain dark edges are preserved.",
      thumbnailUrl: "/scenes/ceres/ceres-normal-thumbnail.webp" },
    { id: "enhanced", label: "Enhanced color", description: "False color · gray grid marks gaps",
      title: "Dawn PIA19977, 920 / 750 / 440 nm false color. Original image shadows remain; added globe lighting is approximate. Gray grid marks identified gaps; uncertain dark edges are preserved.",
      thumbnailUrl: "/scenes/ceres/ceres-enhanced-thumbnail.webp" },
    ...SCIENCE_LENSES.map(lens => ({
      id: lens.id, label: lens.label, description: lens.description, title: lens.title,
      thumbnailUrl: `/scenes/ceres/ceres-${lens.id}-thumbnail.webp`,
      legend: { kind: "scale", title: lens.label,
        src: `/scenes/ceres/ceres-${lens.id}-legend.webp`, width: 256, height: 16,
        labels: lens.labels, meta: lens.units, sourceUrl: lens.sourceUrl },
    })),
  ] }, { normal: LENS_LABELS.monochrome, enhanced: LENS_LABELS.enhancedColor, elevation: LENS_LABELS.elevation }),
  settings: { title: PREPARED_SHELL_TITLES.settings, controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "orbit", label: "Orbit", checked: true },
  ] },
});
