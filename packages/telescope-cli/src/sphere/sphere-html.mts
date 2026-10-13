/** Serialize the standard prepared sphere and its CSS camera at export time. */
import { parseHTML } from 'linkedom';
import { serializePreparedScene } from '@cssearth/renderer/rendering/view/prepared-scene-serialization.ts';
import { initialObjectSelection } from '@cssearth/renderer/runtime/object-contract.ts';
import { publishPreparedNativeView } from '@cssearth/renderer/rendering/view/prepared-native-view.ts';
import { preparedSceneMatrix, distanceForSilhouetteRadius } from '@cssearth/engine';
import { serializePreparedMatrix4 } from '@cssearth/core';
import { CAMERA_POSE_SCHEMA, parsePreparedWorldCameraFrame, type ObjectRuntimeDefinition } from '@cssearth/objects';
import type { SharedView } from '@cssearth/renderer/navigation/camera/view-url.ts';

const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
/** What the page reads of a prepared measurement sphere (`measurementSphere`): its one-dataset runtime, frame,
 * CSS and the data URLs that replace its asset URLs. */
export interface PreparedMeasurementSphere {readonly definition:ObjectRuntimeDefinition;readonly worldFrame:unknown;readonly css:string;readonly embeddedAssets:Readonly<Record<string,string>>}
export function sphereHtml(prepared:PreparedMeasurementSphere, metadata:Record<string,unknown>, title:string, legend:string):string {
  const {definition}=prepared,frame=parsePreparedWorldCameraFrame(prepared.worldFrame);
  if(!frame)throw new TypeError('Sphere requires its prepared physical frame');
  const selection=initialObjectSelection(definition.controls);
  const navigation=definition.variants[0].navigation?.camera;
  const distanceM=distanceForSilhouetteRadius(frame.bodyRadiusM,1000,230,[0,0]);
  const saved:SharedView={camera:{distanceKilometers:distanceM/1000,pose:{schema:CAMERA_POSE_SCHEMA,scene:serializePreparedMatrix4(preparedSceneMatrix(definition.camera,
    navigation?.controlPitch??definition.camera.defaultControlPitchDegrees,navigation?.controlYaw??definition.camera.defaultControlYawDegrees))}},
    playback:{speed:1,motionRequested:false,times:[]},preparedEpochJdTt:frame.epochJdTt};
  const embedded={...definition,assets:{...definition.assets,entries:definition.assets.entries.map(entry=>({...entry,url:prepared.embeddedAssets[entry.url]}))}};
  const markup=serializePreparedScene(embedded);
  const {document}=parseHTML(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; base-uri 'none'"><title>${escape(title)}</title><style>${prepared.css}</style></head><body><div class="object-viewport"><div id="stage" class="object-stage"></div></div><header><h1>${escape(title)}</h1><p>${escape(legend)}</p><p>Prepared fixed view · offline</p></header><details><summary>Measurement and provenance</summary><pre>${escape(JSON.stringify(metadata,null,2))}</pre></details></body></html>`);
  const stage=document.getElementById('stage')!;
  stage.className=['object-stage',...markup.classes].join(' ');
  stage.setAttribute('style',markup.style);stage.dataset.objectId=definition.id;
  for(const [key,value] of Object.entries(markup.attributes))stage.setAttribute(key,value);
  stage.innerHTML=markup.html;
  publishPreparedNativeView(embedded,selection,stage,frame,saved);
  const style=document.createElement('style');
  style.textContent=`
:root{color-scheme:dark;font:14px system-ui;background:#111;color:#ddd}body{margin:0}#stage{position:absolute;inset:0;container-type:size}header{position:fixed;top:24px;left:24px;pointer-events:none;z-index:3}h1{font-size:18px;font-weight:500;margin:0 0 8px}p{margin:6px 0;color:#aaa}details{position:fixed;bottom:20px;left:24px;right:24px;z-index:3;max-height:35vh;overflow:auto;background:#111d}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer}.object-viewport{position:fixed;inset:0;overflow:hidden;container-type:size}`;
  document.head.append(style);
  // Original prepared identities stay in the inert provenance; only rendered URLs are embedded.
  let html=document.toString();
  for(const [url,data] of Object.entries(prepared.embeddedAssets))html=html.replaceAll(url,data);
  const payload={definition,worldFrame:prepared.worldFrame,embeddedAssets:prepared.embeddedAssets,metadata};
  return html.replace('</body>',`<template id="prepared">${escape(JSON.stringify(payload))}</template></body>`);
}
