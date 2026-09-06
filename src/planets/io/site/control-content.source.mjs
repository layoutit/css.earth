import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
export const objectControls = Object.freeze({
 lenses: prepareLensLabels({title:PREPARED_SHELL_TITLES.lenses,defaultLens:"normal",controls:[{
  id:"normal",label:"Monochrome",description:"Voyager and Galileo visible-light mosaic",
  title:"USGS Voyager/Galileo mosaic on a 1 km grid; original detail varies from about 1 to 10 km per pixel. Gray grid marks documented no-data and its resampled boundary. Photographed terrain shading remains; globe lighting is approximate.",
  thumbnailUrl:"/scenes/io/io-normal-thumbnail.webp",
 },{
  id:"enhanced",label:"Enhanced color",description:"Galileo color on Voyager/Galileo detail",
  title:"USGS enhanced-color mosaic: near-infrared, green and violet color ratios combined with observed monochrome detail. USGS corrected broad limb darkening and matched image seams. Source color detail varies from 1.3 to 21 km per pixel. Interpolated polar color is withheld; observed monochrome remains where available. Gray grid marks missing imagery. Acquisition shading, seams and changes between mission dates can remain; globe lighting is approximate.",
  thumbnailUrl:"/scenes/io/io-enhanced-thumbnail.webp",
 }]},{normal:LENS_LABELS.monochrome,enhanced:LENS_LABELS.enhancedColor}),
 settings:{title:PREPARED_SHELL_TITLES.settings,controls:[
  {kind:"toggle",name:"shadows",label:"Shadows",checked:false},
  {kind:"toggle",name:"orbit",label:"Orbit",checked:true},
 ]},
});
