import { array, boolean, number, optional, shape, text } from '../../../../../tools/objects/geographic-pages/source-records.mts';

const scene = shape({name:text,file:text,sha256:optional(text)});
const capture = shape({planet:text,scenes:optional(array(scene)),states:optional(array(scene)),shell:optional(shape({sha256:text}))});
export const parseSaturnBaseline = shape({viewport:shape({width:number,height:number}),deviceScaleFactor:number,
  captures:optional(array(capture)),reports:optional(array(capture))});
const disc = shape({sampleCount:number,mean:number,standardDeviation:number,p10:number,p50:number,p90:number,
  centerMean:number,limbMean:number,centerToLimbDifference:number});
const nullable = <T,>(parse:(value:unknown)=>T) => (value:unknown):T|null => value===null?null:parse(value);
export const parseVisualView = shape({planet:text,name:text,lens:nullable(text),controlPitch:number,zoom:number,
  file:text,sha256:text,disc:nullable(disc)});
export const parseMercuryBaseline = shape({mercury:shape({planet:text,views:array(parseVisualView),
  runtime:shape({cameraCount:number,bodyLeafCount:number,materialLeafCount:number,skyboxFaceCount:number,
    canvasCount:number,sceneSvgCount:number,stageElementCount:number,
    stableDomIdentity:boolean,loadedPreparedAssetUrls:array(text)}),
  maximumCompositorLayer:shape({width:number,height:number,area:number}),externalRequests:array(text),browserProblems:array(text)})});
