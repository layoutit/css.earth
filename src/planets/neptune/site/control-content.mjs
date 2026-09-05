import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_NEPTUNE_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "True color + Hubble detail",
  methane: "Hubble at 619 nm",
  "near-infrared": "Hubble at 845 nm",
};
const neptuneLensSourceUrl =
  "https://archive.stsci.edu/missions/hlsp/opal/cycle32/neptune/";
const lensLegends = {
  methane: prepareLensScaleLegend({
    title: "Relative reflectance",
    palette: [[4, 17, 31], [26, 108, 139], [205, 245, 246]],
    labels: ["Lower", "Higher"],
    meta: "FQ619N",
    sourceUrl: neptuneLensSourceUrl,
  }),
  "near-infrared": prepareLensScaleLegend({
    title: "Relative reflectance",
    palette: [[7, 8, 20], [49, 46, 105], [214, 183, 244]],
    labels: ["Lower", "Higher"],
    meta: "F845M",
    sourceUrl: neptuneLensSourceUrl,
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_NEPTUNE_LENSES.defaultLens,
  controls: PREPARED_NEPTUNE_LENSES.controls.map((lens) => ({ id: lens.id, label: lens.label, thumbnailUrl: lens.thumbnailUrl, description: lensDescriptions[lens.id], legend: lensLegends[lens.id], title: lens.falseColor ? `${lens.label}, ${lens.filter} false color` : lens.label })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "rings", label: "Features", checked: true },
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
