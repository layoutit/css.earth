/** Opt-in production replay against the accepted bank restored from the committed R2 inventory. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';
import {parsePreparedGalaxyStations} from '@cssearth/objects';

test('the default production command replays every 13/13/7 merged-copy slab and accepted sky byte',{
 skip:process.env.CSSEARTH_GALAXY_FULL_REPLAY!=='1',timeout:600_000,
},()=>{
 const directory='src/objects/milky-way-volume/prepared/';
 const inventory='src/objects/milky-way-volume/inventory.json';
 const acceptedInventory=execFileSync('git',['show','HEAD:'+inventory]);
 assert.deepEqual(readFileSync(inventory),acceptedInventory,'replay needs the committed accepted inventory, without a rebake changing its baseline');
 const restore=spawnSync(process.execPath,['packages/bake/cli/setup-assets.mts','--object=milky-way-volume'],{encoding:'utf8',timeout:120_000,maxBuffer:4*1024*1024});
 assert.equal(restore.status,0,restore.stdout+restore.stderr);
 const tuner=parsePreparedGalaxyStations(JSON.parse(readFileSync(directory+'galaxy-stations/tuner.json','utf8')));
 const files=[...([['x',13],['y',13],['z',7]] as const).flatMap(([axis,count])=>Array.from({length:count},(_,i)=>`b30-slices/${axis}/${String(i).padStart(3,'0')}.png`)),
  ...tuner.stations.flatMap(station=>['px','nx','py','ny','pz','nz'].map(face=>`galaxy-stations/${station.id}/${face}.webp`))];
 assert.equal(files.length,39);
 const accepted=new Map(files.map(file=>[file,readFileSync(directory+file)]));
 const run=spawnSync(process.execPath,['packages/bake/cli/prepare-milky-way-layers.mts'],{encoding:'utf8',timeout:570_000,maxBuffer:4*1024*1024});
 assert.equal(run.status,0,run.stdout+run.stderr+String(run.error??''));
 assert.match(run.stdout,/MILKY WAY SETTLED BAKE VERIFIED 33 SLABS \+ 1 SKIES \+ 6 DOT LEVELS/u);
 for(const [file,bytes]of accepted)assert.deepEqual(readFileSync(directory+file),bytes,file);
 assert.deepEqual(readFileSync(inventory),acceptedInventory,'the complete delivered closure must reproduce the committed inventory');
 console.log('PRODUCTION REPLAY VERIFIED: 33 slabs and 6 sky faces');
});
