import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
export const objectControls = Object.freeze({
  lenses: prepareLensLabels({ title: PREPARED_SHELL_TITLES.lenses, defaultLens: "normal", controls: [{
    id: "normal", label: "Monochrome", description: "Voyager and Galileo visible-light mosaic",
    title: "USGS mosaic on a 1 km grid; original image resolution varies from 400 m to 60 km per pixel. USGS normalized broad illumination and matched overlapping images. Photographed relief, coarse patches and some seams remain. Gray grid marks documented no-data and its resampled boundary. Added globe lighting is approximate.",
    thumbnailUrl: "/scenes/callisto/callisto-normal-thumbnail.webp",
  }] }, { normal: LENS_LABELS.monochrome }),
  settings: { title: PREPARED_SHELL_TITLES.settings, controls: [
    { kind: "toggle", name: "shadows", label: "Shadows", checked: false },
    { kind: "toggle", name: "orbit", label: "Orbit", checked: true },
  ] },
});
