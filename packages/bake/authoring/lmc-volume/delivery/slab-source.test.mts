import assert from 'node:assert/strict';import test from 'node:test';
import {projectCatalogue} from '../catalogue-render.mts';import {makeRaster} from '../inputs.mts';import {outsideCamera} from '../render.mts';import {volumeObject,planarBasis} from '../catalogue-volume.mts';import type {CatalogueScene} from '../catalogue-scene.mts';import {slabDomain} from '../../milky-way-dust/galaxy-slab-domain.mts';
test('local LMC transfer excludes a foreground cloud outside its own interval',()=>{
 const map=makeRaster(4,20);map.mask.fill(1);
 const source=volumeObject({id:'source',owner:'source',kind:'ball',component:3,center:[0,0,-.5],basis:planarBasis(0),axes:[.1,.1,.1],inner:0,color:[1,1,1],weight:1,source:'fixture'}),dust=volumeObject({...source,id:'dust',owner:'dust',kind:'dust',center:[0,0,.5],axes:[.3,.3,.1]});
 const scene:CatalogueScene={objects:[source],dust:[dust],owners:[{id:'source',kind:'cluster',component:3,prior:1,maximum:2,measuredAge:false,logAge:null,aliases:[]}],sources:{warp:map,dust:map,young:[map,map,map],youngCoverage:map,youngFraction:0,oldColor:[1,1,1],gas:map,metadata:{}},colors:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]],dustArea:1,molecularFraction:1,metadata:{}};
 const camera=outsideCamera(0,16,1),domain=slabDomain(2,-1,0),sum=(domainArg?:typeof domain)=>projectCatalogue(scene,camera,.06,undefined,domainArg).objects[0].rgb.reduce((a,b)=>a+b,0),local=sum(domain),whole=sum();
 scene.dust=[];assert.equal(sum(domain),local,'An unrelated foreground cloud cannot tint a local slab');assert.ok(whole<local*.5,'The same cloud must still attenuate the complete reference');
 const empty=projectCatalogue(scene,camera,.06,undefined,slabDomain(2,0,1));assert.equal(empty.objects[0].rgb.reduce((a,b)=>a+b,0),0,'An emitter cannot be attributed to an unrelated slab');
});
