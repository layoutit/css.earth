import { validatePreparedCssSky } from '../sky/css-sky-validation.js';
import type { PreparedCssSky } from '../sky/css-sky-types.js';
import type { PreparedCssVolume } from '../../volume/delivery/css-volume-types.js';

export interface PreparedGalaxyStation {
 readonly id:string; readonly positionM:readonly[number,number,number]; readonly sky:string; readonly clouds:string;
}
export interface PreparedGalaxyStations {
 readonly schema:'cssearth-galaxy-stations@1'; readonly stations:readonly PreparedGalaxyStation[];
 readonly hysteresisM:number; readonly fadeMs:number;
 readonly replacesBanks:readonly string[];
 readonly farFadeStartM:number;readonly farFullDistanceM:number;
 /** Fixed gain applied after the complete far station has composited its optical pieces. */
 readonly farImageOpacity:number;
 /** Fixed Sun-centered interval for the NASA/inside-sky transition. */
 readonly insideSkyFade?:{readonly centerM:readonly[number,number,number];readonly startM:number;readonly endM:number};
 /** One display exposure for the complete picture, interpolated in log distance and log gain. */
 readonly autoExposure?:{readonly places:readonly {readonly positionM:readonly[number,number,number];readonly insideOpacity:number;readonly innerDistanceM:number;readonly outerDistanceM:number}[]};
 /** Ordered prepared camera paths. Interpolate the enclosing segment by position. */
 readonly interpolation?:{readonly paths:readonly (readonly string[])[];
  readonly insidePlaces?:readonly {readonly positionM:readonly[number,number,number];readonly fadeStartM:number;readonly fullDistanceM:number}[]};
}
function record(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Expected galaxy station record.');return v as Record<string,unknown>;}
function positive(v:unknown,label:string):number{if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw new TypeError(`Invalid station ${label}.`);return v;}
function path(v:unknown):string{if(typeof v!=='string'||!v||v.startsWith('/')||v.split('/').some(part=>!part||part==='.'||part==='..')||!/^[a-zA-Z0-9_./-]+$/u.test(v))throw new TypeError('Invalid station resource path.');return v;}
export function parsePreparedGalaxyStations(v:unknown):PreparedGalaxyStations{
 const r=record(v);if(r.schema!=='cssearth-galaxy-stations@1'||!Array.isArray(r.stations)||!r.stations.length||r.stations.length>10000)throw new TypeError('Invalid galaxy station index.');
 const ids=new Set<string>();const stations=r.stations.map(value=>{const s=record(value);if(typeof s.id!=='string'||!/^[a-z0-9-]+$/u.test(s.id)||ids.has(s.id))throw new TypeError('Invalid or duplicate station identity.');ids.add(s.id);
 if(!Array.isArray(s.positionM)||s.positionM.length!==3||s.positionM.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw new TypeError('Invalid station position.');
 const positionM:[number,number,number]=[s.positionM[0],s.positionM[1],s.positionM[2]];
 return{id:s.id,positionM,sky:path(s.sky),clouds:path(s.clouds)};});
 if(!Array.isArray(r.replacesBanks)||r.replacesBanks.some(id=>typeof id!=='string'||!/^[a-z0-9-]+$/u.test(id)))throw new TypeError('Invalid station bank replacements.');
 const farFadeStartM=positive(r.farFadeStartM,'far fade start'),farFullDistanceM=positive(r.farFullDistanceM,'far full distance');
 if(farFullDistanceM<=farFadeStartM)throw new TypeError('Station far fade distances must increase.');
 const farImageOpacity=r.farImageOpacity===undefined?1:positive(r.farImageOpacity,'far image opacity');
 if(farImageOpacity>1)throw new TypeError('Station far image opacity must not exceed one.');
 let insideSkyFade:PreparedGalaxyStations['insideSkyFade'];
 if(r.insideSkyFade!==undefined){const e=record(r.insideSkyFade),startM=positive(e.startM,'inside sky start'),endM=positive(e.endM,'inside sky end');
 if(endM<=startM||!Array.isArray(e.centerM)||e.centerM.length!==3||e.centerM.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new TypeError('Invalid inside sky fade.');
 insideSkyFade={centerM:[e.centerM[0],e.centerM[1],e.centerM[2]],startM,endM};}
 let interpolation:PreparedGalaxyStations['interpolation'];
 let autoExposure:PreparedGalaxyStations['autoExposure'];
 if(r.autoExposure!==undefined){const e=record(r.autoExposure);if(!Array.isArray(e.places)||!e.places.length||e.places.length>2)throw new TypeError('Exposure requires one or two connected places.');
 const places=e.places.map(value=>{const p=record(value);if(!Array.isArray(p.positionM)||p.positionM.length!==3||p.positionM.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new TypeError('Invalid exposure position.');
 const positionM:[number,number,number]=[p.positionM[0],p.positionM[1],p.positionM[2]],insideOpacity=positive(p.insideOpacity,'inside opacity'),innerDistanceM=positive(p.innerDistanceM,'inner distance'),outerDistanceM=positive(p.outerDistanceM,'outer distance');
 if(insideOpacity>1||outerDistanceM<=innerDistanceM)throw new TypeError('Invalid exposure range.');return{positionM,insideOpacity,innerDistanceM,outerDistanceM};});
 if(places.length===2&&places[0]!.positionM.every((v,i)=>v===places[1]!.positionM[i]))throw new TypeError('Exposure places must be distinct.');autoExposure={places};}
 if(r.interpolation!==undefined){const p=record(r.interpolation);if(!Array.isArray(p.paths)||!p.paths.length||p.paths.length>100)throw new TypeError('Invalid station interpolation paths.');
 const paths=p.paths.map(value=>{if(!Array.isArray(value)||value.length<2||value.some(id=>typeof id!=='string'||!ids.has(id))||new Set(value).size!==value.length)throw new TypeError('Invalid station interpolation path.');
 const names:string[]=value;for(let i=1;i<names.length;i++){const a=stations.find(s=>s.id===names[i-1])!,b=stations.find(s=>s.id===names[i])!;if(a.positionM.every((v,j)=>v===b.positionM[j]))throw new TypeError('Station segment must have length.');}return names;});
 let insidePlaces:NonNullable<PreparedGalaxyStations['interpolation']>['insidePlaces'];if(p.insidePlaces!==undefined){if(!Array.isArray(p.insidePlaces)||p.insidePlaces.length>100)throw new TypeError('Invalid inside places.');insidePlaces=p.insidePlaces.map(value=>{const place=record(value);if(!Array.isArray(place.positionM)||place.positionM.length!==3||place.positionM.some(v=>typeof v!=='number'||!Number.isFinite(v)))throw new TypeError('Invalid inside place position.');const positionM:[number,number,number]=[place.positionM[0],place.positionM[1],place.positionM[2]],fadeStartM=positive(place.fadeStartM,'place fade start'),fullDistanceM=positive(place.fullDistanceM,'place full distance');if(fullDistanceM<=fadeStartM)throw new TypeError('Inside place fade must increase.');return{positionM,fadeStartM,fullDistanceM};});}
 interpolation={paths,...(insidePlaces?{insidePlaces}:{})};}
 return{schema:'cssearth-galaxy-stations@1',stations,hysteresisM:positive(r.hysteresisM,'hysteresis'),fadeMs:positive(r.fadeMs,'fade time'),replacesBanks:r.replacesBanks,farFadeStartM,farFullDistanceM,farImageOpacity,...(interpolation?{interpolation}:{}),...(autoExposure?{autoExposure}:{}),...(insideSkyFade?{insideSkyFade}:{})};
}
export function parseGalaxyStationSky(v:unknown):{sky:PreparedCssSky;resources:PreparedCssVolume['resources'];imageOpacity:number;exposureOpacity:number}{
 const r=record(v);if(!Array.isArray(r.resources)||r.resources.length!==6)throw new TypeError('Station sky needs six resources.');
 const resources=r.resources.map(value=>{const a=record(value),width=positive(a.width,'image width'),height=positive(a.height,'image height'),bytes=positive(a.bytes,'image bytes');
 if(![width,height,bytes].every(Number.isSafeInteger))throw new TypeError('Station image metadata must be integral.');return{path:path(a.path),width,height,bytes};});
 if(new Set(resources.map(r=>r.path)).size!==6)throw new TypeError('Station sky resource paths must be unique.');
 const imageOpacity=r.imageOpacity===undefined?1:positive(r.imageOpacity,'complete image opacity');
 if(imageOpacity>1)throw new TypeError('Station complete image opacity must not exceed one.');
 const exposureOpacity=r.exposureOpacity===undefined?1:positive(r.exposureOpacity,'exposure opacity');if(exposureOpacity>1)throw new TypeError('Station exposure must not exceed one.');
 return{sky:validatePreparedCssSky(r.sky,resources),resources,imageOpacity,exposureOpacity};
}
