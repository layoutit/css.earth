import {required} from '../../../../tools/contract/test-values.mts';
import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('earth');
import { runtimeDefinition } from "../../unit/earth/prepared-fixture.mts";
import { objectRuntimePackageTests, retainedPresentationFixture } from "../../../../src/platform/test/object-runtime-package.mts";
import { mountPreparedPresentation } from "../../../../src/renderers/css/dist/testing.js";
import { initialObjectSelection } from "../../../../src/renderers/css/dist/testing.js";
test("Earth keeps each held material image and rotation paired until its directional row is decoded", () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  const Matrix = globalThis.DOMMatrix, calls: {projection:string;degrees:number|undefined}[] = [];
  const rotations=new WeakMap<object,number>();
  // The fixture does not calculate matrices. Record the actual requested native
  // operations so a rotation of an old image cannot pass as an unchanged style.
  Object.defineProperty(globalThis,"DOMMatrix",{configurable:true,value:class extends Matrix {
    rotate(degrees: number) { rotations.set(this,degrees); return this; }
    multiply(other: DOMMatrixInit) { calls.push({ projection: this.toString(), degrees: rotations.get(other) }); return this; }
  }});
  try {
    const presentation = mountPreparedPresentation(f.stage, f.context, runtimeDefinition);
    const mesh = required(f.stage.querySelectorAll("*").find(node => node.className === "polycss-mesh earth-material"));
    const [lighting, atmosphere] = mesh.children;
    const projection = { lighting: lighting.style.transform, atmosphere: atmosphere.style.transform };
    const capture = () => [lighting, atmosphere].map(leaf => ({ image: leaf.style.backgroundImage,
      position: leaf.style.backgroundPosition, size: leaf.style.backgroundSize, frame: leaf.dataset.materialFrame }));
    const initialSelection = initialObjectSelection(runtimeDefinition.controls);
    function publish({ z, roll, available = [], shadows = true, lensId = "normal" }: {z:number;roll:number;available?:string[];shadows?:boolean;lensId?:string}) {
      const radial = Math.sqrt(1 - z * z), direction = [Math.cos(roll) * radial, Math.sin(roll) * radial, z];
      const keys = runtimeDefinition.assets.entries.map(entry => entry.key).filter(key =>
        !key.startsWith("lighting:") && !key.startsWith("atmosphere:") || available.includes(key.split(":")[0]));
      const ready = new Set(keys), resources = { ...f.resources, has: (key: string) => ready.has(key), readyKeys: () => keys,
        url: (key: string) => ready.has(key) ? f.resources.url(key) : null };
      const selection = { ...initialSelection, lensId, shadows, atmosphere: true };
      const view = { ...f.view, controlPitch: 40, controlYaw: 0, zoom: 1.1,
        counterRotation: "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)",
        sunViewDirection: direction, skySunViewDirection: [direction[0], -direction[1], -direction[2]],
        reference: { sceneMatrix:f.view.sceneMatrix, sunViewDirection: [1, 0, 0], skySunViewDirection: [1, 0, 0] } };
      calls.length = 0;
      presentation.commitSelection({ selection, view, resources });
      presentation.publishFrame({ selection, view, resources });
      return capture();
    }
    const original = publish({ z: .1, roll: 0, available: ["lighting", "atmosphere"] });
    assert.equal(calls.length, 2);
    assert.deepEqual(publish({ z: .6, roll: 1.3 }), original);
    assert.equal(calls.length, 0, "neither held image may rotate while the new rows are missing");

    const partial = publish({ z: .6, roll: 1.3, available: ["lighting"] });
    assert.notDeepEqual(partial[0], original[0]);
    assert.deepEqual(partial[1], original[1]);
    assert.deepEqual(calls.map(call => call.projection), [projection.lighting]);
    const complete = publish({ z: .6, roll: 1.3, available: ["lighting", "atmosphere"] });
    assert.deepEqual(complete[0], partial[0]);
    assert.notDeepEqual(complete[1], partial[1]);
    assert.deepEqual(calls.map(call => call.projection), [projection.atmosphere]);

    const shadowless = publish({ z: .6, roll: 1.3, shadows: false });
    assert.equal(shadowless[0].frame, "shadowless");
    assert.deepEqual(calls, [{ projection: projection.lighting, degrees: 0 }]);
    assert.deepEqual(publish({ z: -.4, roll: 2.7 }), shadowless);
    assert.equal(calls.length, 0, "a mode change cannot rotate the retained shadowless image");
    assert.deepEqual(publish({ z: -.4, roll: 2.7, lensId: "cross-section", available: ["lighting", "atmosphere"] }), shadowless);
    assert.equal(calls.length, 0, "hidden directional materials retain their last complete publication");
    publish({ z: -.4, roll: 2.7, available: ["lighting", "atmosphere"] });
    assert.deepEqual(calls.map(call => call.projection), [projection.lighting, projection.atmosphere]);
  } finally { f.restore(); }
});
