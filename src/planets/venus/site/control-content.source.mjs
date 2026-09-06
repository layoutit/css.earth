import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_VENUS_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  clouds: "Visible cloud deck",
  radar: "Magellan radar mosaic",
  elevation: "Magellan shaded relief",
};
const lensLegends = {
  elevation: prepareLensScaleLegend({
    title: "Relative elevation",
    palette: [
      [52, 24, 111],
      [41, 85, 151],
      [40, 152, 132],
      [104, 173, 69],
      [205, 105, 82],
      [231, 202, 190],
    ],
    labels: ["Lower", "Higher"],
    sourceUrl:
      "https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_colorized_topographic_mosaic_6600m",
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_VENUS_LENSES.defaultLens,
  controls: PREPARED_VENUS_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    legend: lensLegends[lens.id],
    title: lens.qualification,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "atmosphere", label: "Atmosphere", checked: true },
    { kind: "toggle", name: "stars", label: "Stars", checked: true },
  ],
};

export const objectControls = Object.freeze({
  lenses: prepareLensLabels(lenses, {
    "elevation": LENS_LABELS.elevation,
  }),
  settings,
});
