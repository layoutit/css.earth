/** Restore l21 and replace only its dust. */
import {mkdir,writeFile} from 'node:fs/promises';
import {ROOT} from '../inputs.mts';import {loadParent,saveConfiguration,type Configuration} from '../sequence-state.mts';
import {buildNativeDust,L24} from './field.mts';
const {scene,cfg:parent}=await loadParent(21),dust=await buildNativeDust(scene);
const cfg:Configuration={...parent,version:24,parent:21,dustVersion:24,dustStrength:1.025,change:'Dust only: full native HERITAGE columns, one galaxy-wide Bell normalization, and finite foreground lane clouds.',details:{dust,maximumCorrectionRounds:3,freeParameters:'Only the bounded global dust strength. All l21 stellar colors, grades, point fluxes, source amplitudes, density, heights and camera registration remain fixed.',acceptance:'The bar close-up must show brown lanes in measured positions and bluish-white intervals. Bar color ratios stay within 2 percent; side views remain coherent. RMS is reported, never a gate.'}};
await saveConfiguration(cfg,parent.densityVersion);const source=ROOT+'src/objects/lmc-volume/source/preparation/l24/';await mkdir(source,{recursive:true});await writeFile(source+'field.json',JSON.stringify({...scene.metadata,configuration:cfg},null,2)+'\n');await writeFile(L24+'protocol.json',JSON.stringify(cfg.details,null,2)+'\n');console.log('L24_PREPARED_FROM_L21');
