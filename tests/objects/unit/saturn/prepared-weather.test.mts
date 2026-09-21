import assert from 'node:assert/strict';
import test from 'node:test';
import {readPreparedFixture} from '../../fixtures.mts';
const scene=await readPreparedFixture('saturn','scene');
test('does not paste an authored weather texture over the visible dataset',async()=>{
 const styles=scene.bodyBands.flatMap(band=>band.leaves).map((leaf: {style:string|string[]})=>Array.isArray(leaf.style)?leaf.style.join(';'):leaf.style);
 assert.ok(styles.length>0);
 assert.ok(styles.every(style=>!style.includes('saturn-weather.webp')));
 assert.ok(styles.every(style=>!style.includes('background-image:url(/scenes/saturn/saturn-weather.webp)')));
 const definition=await readPreparedFixture('saturn','runtime');
 assert.ok(definition.assets.entries.every((entry: {url:string})=>entry.url!=='/scenes/saturn/saturn-weather.webp'));
 assert.doesNotMatch(JSON.stringify(definition),/saturn-weather|preparedWeather|weatherTarget/);
 const provenance=await readPreparedFixture('saturn','provenance') as {
  sources:{id:string}[];
  products:{id:string;limitations:string[]}[];
 };
 assert.ok(provenance.sources.every(source=>source.id!=='saturn-approved-static-weather'));
 const visible=provenance.products.find(product=>product.id==='normal');
 assert.ok(visible);
 assert.match(visible.limitations.join(' '),/Hubble OPAL 2025A body/);
 assert.match(visible.limitations.join(' '),/Cassini PIA21611 north pole/);
});
