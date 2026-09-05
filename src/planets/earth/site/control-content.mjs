import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  normal: "Blue Marble + WorldCover 2021",
  "buenos-aires-noise": "2025 daytime estimates · dBA",
  topography: "Land and seafloor relief",
  "night-lights": "Black Marble night lights",
  "cross-section": "Interior structure",
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_EARTH_LENSES.defaultLens,
  controls: PREPARED_EARTH_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    title: `${lens.label}: ${lens.qualification}`,
    legend: lens.legend,
    legendNote: lens.id === "buenos-aires-noise" ? "APrA · 2025 daytime estimates. Uncolored areas have no estimate." : undefined,
  })),
};
const settings = {
  title: PREPARED_SHELL_TITLES.settings,
  controls: [
    { kind: "cycle", name: "speed", label: "Speed", state: "normal" },
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "atmosphere", label: "Atmosphere", checked: true },
  ],
};

export const objectControls = Object.freeze({ lenses, settings });
