import assert from "node:assert/strict";
import { sourceTest } from '../source-test.mts';
const test = sourceTest();
import { readdir, readFile } from "node:fs/promises";
import { parsePreparedObjectRuntime, parsePreparedSurfaceFeatureCatalog } from "../../../src/renderers/css/dist/index.js";

const root = new URL("../../../", import.meta.url);
const bodies = new URL("src/objects/", root);
for (const id of await readdir(bodies)) {
  const descriptor = await readFile(new URL(`${id}/prepared/features.json`, bodies), "utf8").catch(() => null);
  if (!descriptor) continue;
  const metadata: unknown = JSON.parse(descriptor);
  assert.ok(metadata && typeof metadata === "object" && "count" in metadata && typeof metadata.count === "number");
  if (!id.startsWith("comet-") && metadata.count > 5) continue;
  test(`${id}: sparse names and broad comet regions are eligible at whole-body framing without a selection`, async () => {
    const definition = parsePreparedObjectRuntime(JSON.parse(await readFile(new URL(`${id}/prepared/runtime.json`, bodies), "utf8")));
    const plan = definition.features;
    assert.ok(plan);
    const catalog = parsePreparedSurfaceFeatureCatalog(JSON.parse(await readFile(new URL(`public${plan.catalog.url}`, root), "utf8")), plan, id);
    const camera = definition.camera;
    const framingZoom = 400 / camera.logicalBodyDiameter * camera.defaultZoom;
    const share = Math.log(framingZoom / camera.minimumZoom) / Math.log(camera.maximumZoom / camera.minimumZoom);
    assert.ok(plan.policy.minimumZoomShare <= share);
    for (const feature of catalog.features) {
      // Small landing/impact sites keep their separate authored close-up tier.
      if (["LS", "IM", "SS", "RT"].includes(feature.code)) continue;
      assert.ok(feature.minimumZoomShare <= share, `${feature.name} should not require a close-up just because the catalogue is sparse`);
    }
    // Discovery changes eligibility, not the existing screen-space admission rules.
    assert.equal(plan.policy.minimumDiameterPixels, 40);
    assert.equal(plan.policy.alwaysVisibleCount, 0);
    assert.equal(plan.policy.limbCosine, .12);
  });
}
