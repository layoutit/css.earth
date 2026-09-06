import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_JUPITER_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Hubble visible color",
  ultraviolet: "Hubble at 275 nm",
  methane: "Hubble at 889 nm",
};
const lensLegends = {
  ultraviolet: prepareLensScaleLegend({
    title: "Relative reflectance",
    palette: [[8, 7, 31], [78, 50, 143], [229, 216, 255]],
    labels: ["Lower", "Higher"],
    meta: "F275W",
    sourceUrl: PREPARED_JUPITER_LENSES.provenance.spectralSourceUrl,
  }),
  methane: prepareLensScaleLegend({
    title: "Relative reflectance",
    palette: [[2, 15, 19], [18, 89, 100], [201, 248, 239]],
    labels: ["Lower", "Higher"],
    meta: "FQ889N",
    sourceUrl: PREPARED_JUPITER_LENSES.provenance.spectralSourceUrl,
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_JUPITER_LENSES.defaultLens,
  controls: PREPARED_JUPITER_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    legend: lensLegends[lens.id],
    title: `${lens.measurement}. ${lens.qualification}`,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "rings", label: "Rings", checked: true },
  ],
};

export const objectControls = Object.freeze({
  lenses: prepareLensLabels(lenses, {
    "normal": LENS_LABELS.visibleColor,
    "ultraviolet": LENS_LABELS.ultraviolet,
    "methane": LENS_LABELS.methane,
  }),
  settings,
});
