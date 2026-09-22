import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('saturn');
import {readPreparedFixture} from '../../fixtures.mts';
const [presentation,scene]=await Promise.all([readPreparedFixture('saturn','runtime'),readPreparedFixture('saturn','scene')]);
test('mounts prepared PolyCSS texture leaves under retained planet groups',async()=>{
 const [css,preparer]=await Promise.all([
  readFile(new URL('../../../../src/renderers/css/styles/saturn-surfaces.css',import.meta.url),'utf8'),
  readFile(new URL('../../../../tools/objects/material-composition/layered-oblate.mts',import.meta.url),'utf8'),
 ]);
 assert.equal(scene.schema,'csssaturn-prepared-runtime-scene@1');
 assert.equal(scene.transport.sourceSchema,'csssaturn-prepared-retained-scene@30');
 assert.equal(scene.transport.runtimeSourceParsing,false);
 assert.deepEqual(Object.keys(scene.bodyBands[0].leaves[0]).sort(),['className','projectiveTextureLayer','style','tag']);
 const nodes=presentation.tree.nodes;
 assert.equal(nodes.filter(node=>node.className?.split(/\s+/).includes('polycss-camera')).length,1);
 assert.equal(nodes.filter(node=>node.className?.split(/\s+/).includes('saturn-cutaway')).length,1);
 assert.ok(nodes.some((node: { attributes: { [x: string]: string; }; })=>node.attributes['data-prepared-projection']==='single-leaf'));
 assert.equal(nodes.some(node=>node.className==='polycss-projective-texture'),false);
 const data=JSON.stringify(presentation);
 assert.doesNotMatch(data,/bodyVisibility|createPreparedBodyVisibility|PREPARED_SATURN_MOON|saturn-moon|devicePixelRatio/);
 assert.doesNotMatch(data,/canvas|getContext\(|new DOMMatrix|loadPreparedOrbitBank|DecompressionStream/);
 assert.match(css,/\.saturn-ring-plane > s/);
 assert.match(css,/\.saturn-body\s*\{/);
 assert.match(css,/\.planet-stage:where\(\[data-object-id="saturn"\]\)\.saturn-hide-rings/);
 assert.match(css,/\.planet-stage:where\(\[data-object-id="saturn"\]\)\.saturn-hide-shadows/);
 assert.doesNotMatch(css,/saturn-moon|filter\s*:|mask(?:-image)?\s*:|clip-path\s*:|mix-blend-mode\s*:|gradient\(/);
 assert.match(preparer,/function preparedAtlasDimensions\(/);
 assert.doesNotMatch(JSON.stringify(scene),/--polycss-atlas-(?:width|height):64px|--saturn-surface-size/);
 // Dormant moon and face-visibility preparation no longer belongs to consumer JSON.
 assert.equal('planetFaceRetention' in scene,false);
 assert.equal('moons' in scene,false);
});
