import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_MARS_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Viking visible color",
  elevation: "MOLA shaded relief",
  thermal: "THEMIS infrared",
};
const lensLegends = {
  elevation: prepareLensScaleLegend({
    title: "Relative elevation",
    palette: [
      [52, 27, 142],
      [43, 102, 204],
      [45, 190, 198],
      [82, 220, 107],
      [230, 240, 88],
      [224, 102, 72],
      [242, 242, 242],
    ],
    labels: ["Lower", "Higher"],
    sourceUrl:
      "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_color_shaded_relief_463m",
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_MARS_LENSES.defaultLens,
  controls: PREPARED_MARS_LENSES.controls.map((lens) => ({
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
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
