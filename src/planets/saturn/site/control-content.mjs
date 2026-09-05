import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_SATURN_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Visible color",
  ultraviolet: "Hubble at 225 nm",
  methane: "Hubble at 889 nm",
  thermal: "Cassini infrared",
  "cross-section": "Interior structure",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_SATURN_LENSES.defaultLens,
  controls: PREPARED_SATURN_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    title: lens.falseColor
      ? `${lens.label}, ${lens.filter} false color`
      : lens.label,
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
