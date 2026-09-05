import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_URANUS_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Hubble visible color",
  methane: "Hubble at 727 nm",
  "near-infrared": "Hubble at 845 nm",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_URANUS_LENSES.defaultLens,
  controls: PREPARED_URANUS_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
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
