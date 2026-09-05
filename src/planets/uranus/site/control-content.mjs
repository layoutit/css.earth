import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_URANUS_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Hubble visible color",
  methane: "Hubble at 727 nm",
  "near-infrared": "Hubble at 845 nm",
};
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
  defaultLens: PREPARED_URANUS_LENSES.defaultLens,
  controls: PREPARED_URANUS_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    legend: lensLegends[lens.id],
    title: lens.falseColor ? `${lens.label}: ${lens.qualification}` : lens.qualification,
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
