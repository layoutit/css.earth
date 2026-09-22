import { requireObjectRuntimeDefinition } from '../../tools/contract/object-runtime-contract.mts';
import { requireRecord, requireString, requireFiniteNumber } from '../../tools/sources/source-values.mts';
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import { test } from "node:test";
import { preparePerspectiveCamera } from "./prepare-perspective-camera.mts";
import PREPARED_MERCURY_SCENE from "../../src/objects/mercury/prepared/scene.json" with { type: "json" };
import mercury from "../../src/objects/mercury/prepared/runtime.json" with { type: "json" };
const ceres = requireObjectRuntimeDefinition(await loadObjectTestDefinition('ceres'));
const ceresCamera = requireRecord(ceres.camera);
const projection = requireRecord(ceres.sky.projection);
const ceresSky = { ...ceres.sky, projection: {
  horizontalFovDegrees: requireFiniteNumber(projection.horizontalFovDegrees),
  focalLengthOverViewportWidth: requireFiniteNumber(projection.focalLengthOverViewportWidth),
  cssPerspective: requireString(projection.cssPerspective),
} };

test("Mercury's prepared camera reproduces the shared recipe", () => {
  assert.deepEqual(preparePerspectiveCamera({ sky: PREPARED_MERCURY_SCENE.starfield }), PREPARED_MERCURY_SCENE.camera);
});

test("Ceres's prepared camera keeps geometry scale separate from silhouette framing", () => {
  assert.deepEqual(preparePerspectiveCamera({ sky: ceresSky }), ceres.camera);
  const transform = requireString(ceresCamera.defaultTransform).match(/^scale\(([^)]+)\)/);
  assert.ok(transform);
  assert.equal(transform[1], String(ceres.camera.sceneScale));
  assert.equal(requireRecord(ceresCamera.state).zoom, 1.1);
});

test("elongated-body framing changes only the prepared viewport fit", () => {
  const options = { sky: ceresSky, radius: 110 };
  const normal = preparePerspectiveCamera(options);
  const elongated = preparePerspectiveCamera({ ...options, framingScale: 0.75 });
  assert.deepEqual({ ...elongated, responsiveFit: normal.responsiveFit }, normal);
  assert.equal(elongated.responsiveFit.portraitBaseWidthShare / normal.responsiveFit.portraitBaseWidthShare, 0.75);
  assert.equal(elongated.responsiveFit.maximumHeightShare, normal.responsiveFit.maximumHeightShare * 0.75);
  assert.equal(elongated.logicalBodyDiameter, 220);
  for (const framingScale of [0, -1, 1.1, NaN, Infinity]) {
    assert.throws(() => preparePerspectiveCamera({ ...options, framingScale }), /framing scale/);
  }
});

for (const [id, definition] of [["ceres", ceres], ["mercury", mercury]] as const) {
  test(`${id} mesh vertices and lighting use the same world radius through perspective zoom`, () => {
    const { camera, tree, viewBindings } = definition;
    const radius = camera.logicalBodyDiameter / 2;
    const fit = viewBindings.find(binding => binding.kind === "silhouette-fit");
    assert.ok(fit && fit.kind === "silhouette-fit");
    assert.equal(typeof fit.unitScale, "number");
    assert.ok(typeof fit.unitScale === "number");
    const body = tree.nodes.findIndex(node => node.className?.split(" ").includes(`${id}-body`));
    const surface = tree.nodes.filter(node => node.parent === body && node.tag === "s" && !node.className?.includes("polar"));
    assert.ok(surface.length > 0);
    for (const leaf of surface) {
      const match = leaf.style.match(/matrix3d\(([^)]+)/);
      assert.ok(match);
      const m = match[1].split(",").map(Number);
      // The CSS origin is a prepared surface vertex, in PolyCSS units.
      const meshRadius = Math.hypot(m[12], m[13], m[14]) / m[15] * camera.sceneScale;
      // Prepared seam overlap adds under 0.003 world units at these vertices.
      assert.ok(Math.abs(meshRadius - radius) < 0.01, `${id}: mesh radius ${meshRadius}, world radius ${radius}`);
      for (const distance of [1.2, 2, 4, 20].map(scale => scale * radius)) {
        const projectedMesh = 1100 * meshRadius / Math.sqrt(distance ** 2 - meshRadius ** 2);
        const projectedModel = 1100 * radius / Math.sqrt(distance ** 2 - radius ** 2);
        const overlayRadius: number = projectedModel * fit.unitScale * camera.logicalBodyDiameter / 2;
        assert.ok(Math.abs(projectedMesh - overlayRadius) < 0.1,
          `${id}: mesh ${projectedMesh}px, overlay ${overlayRadius}px at distance ${distance}`);
      }
    }
  });
}
