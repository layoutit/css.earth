import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_LENS_CONTROLS } from "./preparedLensControls.mjs";

const uranusLensSourceUrl =
  "https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-33";
const lensLegends = {
  methane: prepareLensScaleLegend({
    title: "Relative reflectance",
    palette: [[5, 18, 23], [25, 105, 116], [196, 243, 238]],
    labels: ["Lower", "Higher"],
    meta: "FQ727N",
    sourceUrl: uranusLensSourceUrl,
  }),
  "near-infrared": prepareLensScaleLegend({
    title: "Relative reflectance",
    palette: [[7, 5, 24], [61, 44, 132], [237, 214, 255]],
    labels: ["Lower", "Higher"],
    meta: "F845M",
    sourceUrl: uranusLensSourceUrl,
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

export const objectControls = Object.freeze({ lenses, settings });
