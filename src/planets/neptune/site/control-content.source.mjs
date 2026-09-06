import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_LENS_CONTROLS } from "./preparedLensControls.mjs";

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
  defaultLens: PREPARED_LENS_CONTROLS.defaultLens,
  controls: PREPARED_LENS_CONTROLS.controls.map((lens) => ({
    ...lens,
    legend: lensLegends[lens.id],
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
    "methane": LENS_LABELS.methane,
    "near-infrared": LENS_LABELS.nearInfrared,
  }),
  settings,
});
