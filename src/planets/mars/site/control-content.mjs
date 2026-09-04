import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_MARS_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Viking visible color",
  elevation: "MOLA shaded relief",
  thermal: "THEMIS infrared",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_MARS_LENSES.defaultLens,
  controls: PREPARED_MARS_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
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
