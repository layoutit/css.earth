import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,mkdir,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {readCataloguePointBank,parseCatalogueProximity} from '@cssearth/objects';
import {writeCatalogueBank,readCatalogueBank} from './catalogue-banks.ts';import {prepareCatalogueProximity} from './catalogue-proximity.ts';

test('proximity preparation preserves every stacked position, color and magnitude radius, in order',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'catalogue-proximity-'));
 const frame={referenceFrame:'sun-icrf',epochJdTt:1,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:1,boundsUnits:{min:[-20,-20,-20],max:[20,20,20]}};
 const original={schema:'cssearth-catalogue-points@1',id:'dots',frame,appearance:{colorCss:'#ffffff',radiusPx:.75,opacity:.73,palette:['#ff00ff80','#00ff00ff'],paletteRadiusPx:[.5,1.25],levels:[{points:12,fullDetailUnits:10},{points:7,appearUnits:[9,2.4]},{points:3,appearUnits:[2.4,.3]}]},points:Array.from({length:22},(_,i)=>[(i-11)/10,i/10,-i/10,i%2])};
 try{await mkdir(join(dir,'prepared'));await writeFile(join(dir,'object.json'),JSON.stringify({schema:'cssearth-object@2',id:'fixture',type:'density-volume',properties:{volume:frame,preparation:{source:'source/volume.json'}}}));await writeFile(join(dir,'prepared/volume.json'),JSON.stringify({data:{frame}}));
 await writeCatalogueBank({objectDirectory:dir,id:'dots',bank:original,published:true,inventory:async()=>{}});
 await prepareCatalogueProximity(dir,'dots',{proximity:{disc:{centerUnits:[0,0,0],radiusUnits:26,halfHeightUnits:.3,fadeFraction:.5}}},true);
 const index=parseCatalogueProximity(JSON.parse(await readFile(join(dir,'prepared/catalogue-proximity.json'),'utf8')));
 const before=readCataloguePointBank(await readCatalogueBank(dir,'dots'));
 const levels=await Promise.all(index.levels.map(async level=>readCataloguePointBank(await readCatalogueBank(dir,level.file.replace(/\.bin$/u,'')))));
 assert.deepEqual(levels.flatMap(level=>level.points),before.points);
 assert.ok(levels.every(level=>level.appearance.opacity===before.appearance.opacity),'the bank gain is preserved too');
 assert.deepEqual(levels.map(level=>level.points.length),[12,7,3]);
 assert.deepEqual(index.levels.map(level=>level.appearUnits),[undefined,[9,2.4],[2.4,.3]]);
 assert.ok(levels.every(level=>JSON.stringify(level.frame)===JSON.stringify(before.frame)));
 }finally{await rm(dir,{recursive:true,force:true});}
});
