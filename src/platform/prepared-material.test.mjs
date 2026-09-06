import { prepareFrameLookup } from "../../tools/prepare-materials.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPreparedMaterialPublisher, preparedMaterialFrame } from "./prepared-material.mjs";
import { selectedPreparedVariant } from "./prepared-presentation.mjs";
import { initialObjectSelection } from "./object-runtime-contract.mjs";
import { retainedPresentationFixture } from "./test/object-runtime-package.mjs";
import { runtimeDefinition as definition } from "../planets/venus/runtime/definition.mjs";

test("shared scalar, atlas and roll publication matches the preserved Venus boundary sequence",()=>{
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
      assert.deepEqual({frame:actual.frame,lightRollDegrees:actual.lightRollDegrees,sunViewDirection:actual.sunViewDirection,
        shadowsEnabled:actual.rotationEnabled},record.expected);
      assert.equal(element.style.backgroundPosition,record.backgroundPosition);
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
  const { runtimeDefinition: definition } = await import("../planets/uranus/runtime/definition.mjs");
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
