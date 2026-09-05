import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_PLUTO_LENSES } from "../runtime/preparedLenses.mjs";

const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_PLUTO_LENSES.defaultLens,
  controls: PREPARED_PLUTO_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lens.qualification,
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
