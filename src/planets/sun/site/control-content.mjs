import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
import { prepareLensScaleLegend } from
  "../../../../site/prepared-lens-legends.mjs";
import { PREPARED_SUN_LENSES } from "../runtime/preparedLenses.mjs";

const lensDescriptions = {
  photosphere: "HMI continuum",
  magnetic: "HMI radial field",
  chromosphere: "AIA at 304 Å",
  corona: "AIA at 171 Å",
};
const lensLegends = {
  magnetic: prepareLensScaleLegend({
    title: "Radial magnetic field",
    palette: [[28, 95, 190], [95, 32, 11], [255, 224, 110]],
    labels: ["−250", "0", "+250"],
    meta: "G",
    sourceUrl: "https://jsoc.stanford.edu/HMI/LOS_Synoptic_charts.html",
  }),
  chromosphere: prepareLensScaleLegend({
    title: "Relative EUV intensity",
    palette: [[19, 0, 0], [205, 23, 0], [255, 224, 92]],
    labels: ["Lower", "Higher"],
    meta: "304 Å",
    sourceUrl: "https://sdo.gsfc.nasa.gov/data/synoptic/",
  }),
  corona: prepareLensScaleLegend({
    title: "Relative EUV intensity",
    palette: [[11, 8, 0], [210, 133, 0], [255, 248, 176]],
    labels: ["Lower", "Higher"],
    meta: "171 Å",
    sourceUrl: "https://sdo.gsfc.nasa.gov/data/synoptic/",
  }),
};
const lenses = {
  title: PREPARED_SHELL_TITLES.lenses,
  defaultLens: PREPARED_SUN_LENSES.defaultLens,
  controls: PREPARED_SUN_LENSES.controls.map((lens) => ({
    id: lens.id,
    label: lens.label,
    thumbnailUrl: lens.thumbnailUrl,
    description: lensDescriptions[lens.id],
    legend: lensLegends[lens.id],
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
