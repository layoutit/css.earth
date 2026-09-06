import { loadObjectTestDefinition } from '../../tools/object-test-data.mjs';
import { prepareFrameLookup } from "../../tools/prepare-materials.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPreparedMaterialPublisher, preparedMaterialFrame } from '../renderers/css/dist/testing.js';
import { selectedPreparedVariant } from '../renderers/css/dist/testing.js';
import { initialObjectSelection } from '../renderers/css/dist/testing.js';
import { retainedPresentationFixture } from "./test/object-runtime-package.mjs";
import definition from "../../src/planets/venus/prepared/runtime.json" with {type: "json"};

test("Venus preserves roll and shadow boundaries while selecting physical directional phases",()=>{
  const reference=JSON.parse(readFileSync(new URL("./test/fixtures/venus-material-reference.json",import.meta.url)));
  assert.ok(reference.records.length>400);assert.match(reference.source.sha256,/^[a-f0-9]{64}$/);
  const f=retainedPresentationFixture(definition);
  try{
    const track=definition.materials[0],element=f.document.createElement("s");
    const first=track.banks[0].frames[track.defaultFrame];
    element.style.backgroundSize=first.backgroundSize;element.style.backgroundPosition=first.backgroundPosition;
    const publisher=createPreparedMaterialPublisher(track,element,definition.camera);
    for(const record of reference.records){
      const selection={...initialObjectSelection(definition.controls),shadows:record.shadows};
      const view={sunViewDirection:record.direction,skySunViewDirection:definition.sun.referenceViewDirection,
        controlPitch:definition.camera.defaultControlPitchDegrees,controlYaw:definition.camera.defaultControlYawDegrees};view.reference=view;
      publisher.publish(selectedPreparedVariant(definition,selection).materials[0],view,f.resources);
      const actual=publisher.observe();
      // The physical camera now supplies the real Sun depth. The original
      // raster contains 31 directional samples across [-.98,.98], followed
      // by its fixed shadowless sample; the former artistic phase warp is gone.
      const frame = record.shadows
        ? Math.max(0, Math.min(30, Math.round((record.direction[2] + .98) / 1.96 * 30))) : 31;
      assert.deepEqual({frame:actual.frame,lightRollDegrees:actual.lightRollDegrees,sunViewDirection:actual.sunViewDirection,
        shadowsEnabled:actual.rotationEnabled},{...record.expected,frame});
      assert.equal(element.style.backgroundPosition,`${-(frame % 8) * 512}px ${-Math.floor(frame / 8) * 512}px`);
      assert.equal(element.style.backgroundSize,record.backgroundSize);
      assert.equal(element.style.getPropertyValue("--venus-light-roll"),record.rotation);
    }
    const writes=publisher.observe();
    assert.ok(writes.addressWrites>0);assert.ok(writes.transformWrites>0);
  }finally{f.restore();}
});

test("frame mapping consumes numeric bounds independently of the presentation identity",()=>{
  const mapping=prepareFrameLookup(41,z=>Math.round(Math.max(0,Math.min(40,(z+1)*20))));
  for(const [z,expected] of [[-2,0],[-1,0],[-.5,10],[0,20],[.5,30],[1,40],[2,40]])
    assert.equal(preparedMaterialFrame(mapping,{sunViewDirection:[0,0,z]},definition.camera),expected);
});

test("metadata observation and unchanged publication have no extra material writes",()=>{
  const f=retainedPresentationFixture(definition);
  try{
    const track=definition.materials[0],element=f.document.createElement("s"),publisher=createPreparedMaterialPublisher(track,element,definition.camera);
    const selection=initialObjectSelection(definition.controls),selected=selectedPreparedVariant(definition,selection).materials[0];
    const view={sunViewDirection:[1,0,0],controlPitch:0,controlYaw:0};view.reference=view;
    publisher.publish(selected,view,f.resources);const before=publisher.observe();
    assert.deepEqual(publisher.observe(),before);publisher.publish(selected,view,f.resources);
    assert.deepEqual(publisher.observe(),before);
  }finally{f.restore();}
});

test("prepared address caching survives native URL serialization and still publishes a changed decoded URL", async () => {
  const definition = await loadObjectTestDefinition('uranus');
  const f = retainedPresentationFixture(definition);
  f.resources.has = () => true;
  try {
    const track = definition.materials[0], element = f.document.createElement("s");
    element.style.transform = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
    let image = "", writes = 0;
    Object.defineProperty(element.style, "backgroundImage", { get: () => image,
      set(value) { writes++; image = value.replace(/^url\(([^\"]+)\)$/, 'url("$1")'); } });
    const selected = selectedPreparedVariant(definition, { ...initialObjectSelection(definition.controls), shadows: false }).materials[0];
    const publisher = createPreparedMaterialPublisher(track, element, definition.camera);
    const view = { controlPitch: 89, sunViewDirection: [1, 0, 0], reference: { sunViewDirection: [1, 0, 0] } };
    publisher.publish(selected, view, f.resources); assert.equal(writes, 1);
    publisher.publish(selected, { ...view, sunViewDirection: [0, 0, -1] }, f.resources); assert.equal(writes, 1);
    publisher.publish(selected, view, { ...f.resources, url: key => f.resources.url(key) + '?decoded=2' }); assert.equal(writes, 2);
  } finally { f.restore(); }
});

test("invalid material mappings fail before lookup expansion", () => {
  for (const value of [NaN, Infinity, -1, .5, 4]) {
    assert.throws(() => prepareFrameLookup(4, () => value), /inside its prepared bank/);
  }
  assert.throws(() => prepareFrameLookup(0, () => 0), /positive frame count/);
  assert.throws(() => prepareFrameLookup(4, z => z === -1 ? 0 : z === 1 ? 3 : NaN), /inside its prepared bank/);
});
