import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_SUN_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  photosphere: "HMI continuum",
  magnetic: "HMI radial field",
  chromosphere: "AIA at 304 Å",
  corona: "AIA at 171 Å",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_SUN_LENSES.defaultLens,
  controls: PREPARED_SUN_LENSES.controls.map((lens) => ({
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
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
