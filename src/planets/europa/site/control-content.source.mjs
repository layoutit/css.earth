import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
export const objectControls = Object.freeze({
 lenses: prepareLensLabels({title:PREPARED_SHELL_TITLES.lenses,defaultLens:"normal",controls:[{
  id:"normal",label:"Monochrome",description:"Voyager and Galileo visible-light mosaic",
  title:"USGS Voyager/Galileo mosaic. Source resolution varies from about 200 m to 20 km per pixel. Gray grid marks documented no-data and its resampled boundary. Original image shading remains; globe lighting is approximate.",
  thumbnailUrl:"/scenes/europa/europa-normal-thumbnail.webp",
 },{
  id:"enhanced",label:"Enhanced color",description:"Galileo color over monochrome",
  title:"Calibrated Galileo observations: 756 nm → red, 559 nm → green, 404 nm → blue, at 1.4–1.6 km per pixel. About 19% of the surface has all three bands. Elsewhere, observed monochrome remains; the gray grid marks gaps in both sources. Original photographed shading and brightness seams remain; added globe lighting is approximate.",
  thumbnailUrl:"/scenes/europa/europa-enhanced-thumbnail.webp",
 }]},{normal:LENS_LABELS.monochrome,enhanced:LENS_LABELS.enhancedColor}),
 settings:{title:PREPARED_SHELL_TITLES.settings,controls:[
  {kind:"toggle",name:"shadows",label:"Shadows",checked:false},
  {kind:"toggle",name:"orbit",label:"Orbit",checked:true},
 ]},
});
