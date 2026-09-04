import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_MOON_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  surface: "LRO visible-colour surface",
  topography: "LOLA elevation",
  crust: "GRAIL crustal thickness",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_MOON_LENSES.defaultLens,
  controls: PREPARED_MOON_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    title: `${lens.label}: ${lens.qualification}`,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
