import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_MOON_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  surface: "LRO visible-colour surface",
  topography: "LOLA elevation",
  crust: "GRAIL crustal thickness",
};
const moonSourceUrl = "https://svs.gsfc.nasa.gov/4014/";
const lensLegends = {
  topography: prepareLensScaleLegend({
    title: "Relative elevation",
    palette: [
      [45, 70, 174],
      [43, 174, 208],
      [45, 183, 114],
      [222, 234, 74],
      [214, 77, 55],
    ],
    labels: ["Lower", "Higher"],
    sourceUrl: moonSourceUrl,
  }),
  crust: prepareLensScaleLegend({
    title: "Relative crustal thickness",
    palette: [
      [51, 47, 166],
      [37, 194, 226],
      [29, 223, 99],
      [237, 231, 44],
      [234, 55, 25],
      [239, 239, 239],
    ],
    labels: ["Thinner", "Thicker"],
    sourceUrl: moonSourceUrl,
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_MOON_LENSES.defaultLens,
  controls: PREPARED_MOON_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    legend: lensLegends[lens.id],
    title: `${lens.label}: ${lens.qualification}`,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
  ],
};

export const objectControls = Object.freeze({
  lenses: prepareLensLabels(lenses, {
    "surface": LENS_LABELS.visibleColor,
    "topography": LENS_LABELS.elevation,
  }),
  settings,
});
