import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import {
  prepareLensCategoryLegend,
  prepareLensScaleLegend,
} from "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_SATURN_LENSES } from "../runtime/preparedLenses.mjs";
import saturnInterior from "../source/interior/manifest.json" with { type: "json" };

const lensDescriptions = {
  normal: "Visible color",
  ultraviolet: "Hubble at 225 nm",
  methane: "Hubble at 889 nm",
  thermal: "Cassini infrared",
  "cross-section": "Interior structure",
};
const saturnLensSourceUrl = PREPARED_SATURN_LENSES.provenance.bodySourceUrl;
const lensLegends = Object.fromEntries([
  ...PREPARED_SATURN_LENSES.controls
    .filter((lens) => lens.falseColorPalette)
    .map((lens) => [lens.id, prepareLensScaleLegend({
      title: lens.id === "thermal"
        ? "Relative thermal response"
        : "Relative reflectance",
      palette: lens.falseColorPalette,
      labels: ["Lower", "Higher"],
      meta: lens.filter,
      sourceUrl: lens.sourceUrls?.[0] ?? saturnLensSourceUrl,
    })]),
  ["cross-section", prepareLensCategoryLegend({
    title: "Structure",
    meta: "Schematic",
    sourceUrl: saturnInterior.sources[0].url,
    items: [
      { label: "Molecular envelope", description: "Outer atmosphere", color: saturnInterior.palette.molecularEnvelope },
      { label: "Metallic hydrogen", description: "Conductive layer", color: saturnInterior.palette.metallicHydrogen },
      { label: "Diffuse core", description: "Rock and ice mixture", color: saturnInterior.palette.diffuseCore },
      { label: "Deep core", description: "Central region", color: saturnInterior.palette.deepCore },
    ],
  })],
]);
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_SATURN_LENSES.defaultLens,
  controls: PREPARED_SATURN_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    legend: lensLegends[lens.id],
    title: lens.falseColor
      ? `${lens.label}, ${lens.filter} false color`
      : lens.label,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "rings", label: "Features", checked: true },
  ],
};

export const objectControls = Object.freeze({
  lenses: prepareLensLabels(lenses, {
    "normal": LENS_LABELS.visibleColor,
    "ultraviolet": LENS_LABELS.ultraviolet,
    "methane": LENS_LABELS.methane,
    "thermal": LENS_LABELS.thermalInfrared,
    "cross-section": LENS_LABELS.crossSection,
  }),
  settings,
});
