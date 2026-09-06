import { LENS_LABELS, prepareLensLabels } from "../../../../site/prepare-lens-labels.mjs";
import { PREPARED_SHELL_TITLES } from "../../../../site/prepared-shell-titles.mjs";
export const objectControls = Object.freeze({
 lenses: prepareLensLabels({title:PREPARED_SHELL_TITLES.lenses,defaultLens:"normal",controls:[{
  id:"normal",label:"Monochrome",description:"Voyager and Galileo visible-light mosaic",
  title:"USGS Voyager/Galileo mosaic at a 1 km map grid. Original observations vary from about 400 m to 20 km per pixel. Gray grid marks documented missing imagery. Photographed terrain shading remains; added globe lighting is approximate.",
  thumbnailUrl:"/scenes/ganymede/ganymede-normal-thumbnail.webp",
 },{
  id:"enhanced",label:"Enhanced color",description:"USGS infrared color over monochrome",
  title:"USGS color mosaic combines infrared, green and violet observations with sharper monochrome detail. The source is photometrically normalized and brightness matched. Monochrome remains at the poles, in missing color coverage, and across the source's 210–250° west sector whose red channel was synthesized. This is enhanced color, not natural color; source resolution and seams vary.",
  thumbnailUrl:"/scenes/ganymede/ganymede-enhanced-thumbnail.webp",
 }]},{normal:LENS_LABELS.monochrome,enhanced:LENS_LABELS.enhancedColor}),
 settings:{title:PREPARED_SHELL_TITLES.settings,controls:[
  {kind:"toggle",name:"shadows",label:"Shadows",checked:false},
  {kind:"toggle",name:"orbit",label:"Orbit",checked:true},
 ]},
});
