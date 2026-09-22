import {required} from '../../../../tools/contract/test-values.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parsePdsRadiusTable} from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
const root=new URL('../../../../src/objects/gkunhomdima/source/',import.meta.url);
test('Gǃkúnǁʼhòmdímà preserves the published Maclaurin axes and orbit-alignment assumption',async()=>{
 const config=JSON.parse((await readFile(new URL('preparation/terrestrial.json',root))).toString('utf8'));
 const mesh=parsePdsRadiusTable(await readFile(new URL('shape/ellipsoid.tab',root),'utf8'),config.geometry.radialTerrain.grid);
 for(const [lon,lat,r]of [[0,0,329000],[90,0,329000],[0,90,294000]] as const)assert.ok(Math.abs(required(mesh.sample(lon,lat))-r)<1e-5);
 const data=JSON.parse((await readFile(new URL('measurements.json',root))).toString('utf8'));
 assert.equal(data.horizons,'229762;');assert.match(data.shapeMeaning,/satellite orbit is assumed equatorial/);
 const rotation=JSON.parse((await readFile(new URL('preparation/rotation.json',root))).toString('utf8'));
 assert.equal(rotation.rightAscensionDegrees,20.6);assert.equal(rotation.declinationDegrees,46.25);assert.equal(rotation.periodHours,undefined);
 const content=JSON.parse((await readFile(new URL('content/object.json',root))).toString('utf8'));
 assert.ok(content.settings.controls.every((c: { checked: boolean; })=>c.checked===false));
});
