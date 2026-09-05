import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_MERCURY_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "MESSENGER at 750 nm",
  enhanced: "USGS enhanced color + BDR coverage",
  topography: "MESSENGER shaded relief",
  interior: "Interior structure",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_MERCURY_LENSES.defaultLens,
  controls: PREPARED_MERCURY_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    title: lens.falseColor ? `${lens.label}, ${lens.filter} false color` : lens.filter,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "orbit", label: "Orbit", checked: true },
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
