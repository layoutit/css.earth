/** Serialize the standard prepared sphere and its CSS camera at export time. */
import { parseHTML } from 'linkedom';
import { serializePreparedScene } from '../../../prepared/serialize-prepared-scene.mts';
import { initialObjectSelection } from '@cssearth/renderer/runtime/object-contract.ts';
import { publishPreparedNativeView } from '@cssearth/renderer/rendering/prepared-native-view.ts';
import { preparedSceneMatrix } from '@cssearth/renderer/navigation/prepared-camera-basis.ts';
import { serializePreparedMatrix4 } from '@cssearth/core';
import { parsePreparedWorldCameraFrame } from '@cssearth/renderer/validation/world-frame.ts';
import { distanceForSilhouetteRadius } from '@cssearth/renderer/solar-system/heliocentric-geometry.ts';
import { addNativeCamera } from '../../../experiments/native-scroll/native-camera.mts';
import { addNativeResizeInput } from '../../../experiments/native-scroll/resize-input.mts';
import { carryViewportValues } from '../../../experiments/native-scroll/carry-values.mts';
import type { measurementSphere } from './sphere-lane.mts';
import type { SharedView } from '@cssearth/renderer/navigation/view-url.ts';

const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
type Prepared=Awaited<ReturnType<typeof measurementSphere>>;
export function sphereHtml(prepared:Prepared, metadata:Record<string,unknown>, title:string, legend:string):string {
  const {definition}=prepared,frame=parsePreparedWorldCameraFrame(prepared.worldFrame);
  if(!frame)throw new TypeError('Sphere requires its prepared physical frame');
  const selection=initialObjectSelection(definition.controls);
  const navigation=definition.variants[0].navigation?.camera;
  const distanceM=distanceForSilhouetteRadius(frame.bodyRadiusM,1000,230,[0,0]);
  const saved:SharedView={camera:{distanceKilometers:distanceM/1000,pose:{schema:'cssearth-camera-pose@2',scene:serializePreparedMatrix4(preparedSceneMatrix(definition.camera,
    navigation?.controlPitch??definition.camera.defaultControlPitchDegrees,navigation?.controlYaw??definition.camera.defaultControlYawDegrees))}},
    playback:{speed:1,motionRequested:false,times:[]},preparedEpochJdTt:frame.epochJdTt};
  const embedded={...definition,assets:{...definition.assets,entries:definition.assets.entries.map(entry=>({...entry,url:prepared.embeddedAssets[entry.url]}))}};
  const markup=serializePreparedScene(embedded);
  const {document}=parseHTML(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'"><title>${escape(title)}</title><style>${prepared.css}</style></head><body><div class="object-viewport"><div id="stage" class="object-stage"></div><div class="object-input-surface" tabindex="0"></div></div><header><h1>${escape(title)}</h1><p>${escape(legend)}</p><p class="native-help">Drag to rotate · scroll to zoom</p><p class="native-unsupported">This browser shows the fixed view; native drag requires CSS view timelines and resize handles.</p></header><details><summary>Measurement and provenance</summary><pre>${escape(JSON.stringify(metadata,null,2))}</pre></details></body></html>`);
  const stage=document.getElementById('stage')!;
  stage.className=['object-stage',...markup.classes].join(' ');
  stage.setAttribute('style',markup.style);stage.dataset.objectId=definition.id;
  for(const [key,value] of Object.entries(markup.attributes))stage.setAttribute(key,value);
  stage.innerHTML=markup.html;
  const publication=publishPreparedNativeView(embedded,selection,stage,frame,saved);
  const camera=addNativeCamera(document,embedded,selection,frame,publication,{surfaceOnly:true});
  const style=document.createElement('style');
  style.textContent=`
:root{color-scheme:dark;font:14px system-ui;background:#111;color:#ddd}body{margin:0}#stage{position:fixed;inset:0;min-width:240px;min-height:240px;container-type:size;--object-viewport-zoom-divisor:1}header{position:fixed;top:24px;left:24px;pointer-events:none;z-index:3}h1{font-size:18px;font-weight:500;margin:0 0 8px}p{margin:6px 0;color:#aaa}details{position:fixed;bottom:20px;left:24px;right:24px;z-index:3;max-height:35vh;overflow:auto;background:#111d}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer}
@property --native-log-distance{syntax:'<number>';inherits:false;initial-value:0}
@property --native-distance-m{syntax:'<number>';inherits:false;initial-value:0}
@property --native-dolly-m{syntax:'<number>';inherits:false;initial-value:0}
@property --native-radius-px{syntax:'<number>';inherits:false;initial-value:230}
@keyframes native-scroll-distance{0%{--native-log-distance:${Math.log(.7)}}10%{--native-log-distance:0}100%{--native-log-distance:${Math.log(3)}}}
.object-input-surface{position:absolute;inset:0;z-index:2}.object-viewport{position:fixed;inset:0;min-width:240px;min-height:240px;overflow:hidden;isolation:isolate;container-type:size;--native-focal:${definition.camera.projection!.cssPerspective};--native-distance-m:calc(${distanceM} * exp(var(--native-log-distance)));--native-dolly-m:calc(var(--native-distance-m) - ${distanceM});--native-radius-px:calc(var(--native-focal) / 1px * ${frame.bodyRadiusM} / sqrt(pow(var(--native-distance-m), 2) - ${frame.bodyRadiusM**2}))}
@supports (animation-timeline:view()) and selector(::-webkit-resizer){
.object-input-surface{overflow-x:hidden;overflow-y:auto;scrollbar-width:none;touch-action:pan-y;overscroll-behavior:contain;scroll-timeline:--native-zoom y}
.object-input-surface::-webkit-scrollbar{display:none}.object-input-surface::after{content:'';display:block;height:3600px}
.native-zoom-start{display:block;height:100%;scroll-initial-target:nearest;scroll-snap-align:start;outline:none}
.polycss-scene{translate:0 0 calc(var(--native-dolly-m) / ${frame.metersPerUnit} * -1px)}
.native-unsupported{display:none}}
@supports not ((animation-timeline:view()) and selector(::-webkit-resizer)){.native-help{display:none}}
${camera.css}
${addNativeResizeInput(document)}`;
  document.head.append(style);
  const initial=document.createElement('span');initial.className='native-zoom-start';initial.setAttribute('autofocus','');initial.setAttribute('tabindex','-1');initial.setAttribute('aria-label','Sphere zoom');
  document.querySelector('.object-input-surface')!.append(initial);
  carryViewportValues(document,[...document.querySelectorAll('style')].map(node=>node.textContent??'').join('\n'));
  // Original prepared identities stay in the inert provenance; only rendered URLs are embedded.
  let html=document.toString();
  for(const [url,data] of Object.entries(prepared.embeddedAssets))html=html.replaceAll(url,data);
  const payload={definition,worldFrame:prepared.worldFrame,context:prepared.context,embeddedAssets:prepared.embeddedAssets,metadata};
  return html.replace('</body>',`<template id="prepared">${escape(JSON.stringify(payload))}</template></body>`);
}
