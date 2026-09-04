import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_VENUS_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  clouds: "Visible cloud deck",
  radar: "Magellan radar mosaic",
  elevation: "Magellan shaded relief",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_VENUS_LENSES.defaultLens,
  controls: PREPARED_VENUS_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
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

export const objectControls = Object.freeze({ lenses, settings });
