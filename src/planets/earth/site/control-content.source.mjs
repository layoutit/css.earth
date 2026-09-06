import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensCategoryLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";
import earthInterior from "../source/interior/earth-interior.json" with { type: "json" };

const lensDescriptions = {
  normal: "Blue Marble + WorldCover 2021",
  topography: "Land and seafloor relief",
  "night-lights": "Black Marble night lights",
  "cross-section": "Interior structure",
};
const lensLegends = {
  "cross-section": prepareLensCategoryLegend({
    title: "Structure",
    meta: "Schematic",
    sourceUrl: earthInterior.sourceUrl,
    items: earthInterior.layers.map((layer) => ({
      label: layer.label,
      description: layer.innerRadiusKm === 0
        ? "to the center"
        : `${layer.innerRadiusKm.toLocaleString("en-US")} km inner radius`,
      color: layer.color,
    })),
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_EARTH_LENSES.defaultLens,
  geographicCapacity: 8,
  controls: PREPARED_EARTH_LENSES.controls.map((lens) => ({
    id: lens.id,
    ...(lens.entityIds ? { entityIds: lens.entityIds } : {}),
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    title: `${lens.label}: ${lens.qualification}`,
    legend: lens.legend ?? lensLegends[lens.id],
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
