import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_JUPITER_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Hubble visible color",
  ultraviolet: "Hubble at 275 nm",
  methane: "Hubble at 889 nm",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_JUPITER_LENSES.defaultLens,
  controls: PREPARED_JUPITER_LENSES.controls.map((lens) => ({
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
    { kind: "toggle", name: "rings", label: "Rings", checked: true },
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
