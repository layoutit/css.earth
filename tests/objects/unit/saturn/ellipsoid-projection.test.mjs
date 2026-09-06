import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { PREPARED_PRESENTATION } from "../runtime/preparedPresentation.mjs";
import { PREPARED_SATURN_RUNTIME_SCENE } from "../runtime/preparedSceneRuntime.mjs";
import { createPreparedEllipsoidProjection, readPreparedCounterMatrix, readPreparedMatrix4 } from "../../../platform/prepared-ellipsoid-projection.mjs";

test("generic ellipsoid projection exactly preserves the independently captured native Saturn poses", async () => {
  const reference = JSON.parse(await readFile(new URL("./fixtures/ellipsoid-projection-reference.json", import.meta.url), "utf8"));
  assert.equal(reference.referenceCommit, "3cc7bbe1a4b4cc88b9b974704c03afd3dd49b164");
  assert.equal(reference.samples.length, 96);
  const originalScene = reference.sources.find(source => source.path.endsWith("preparedSceneRuntime.mjs"));
  assert.equal(createHash("sha256").update(await readFile(new URL("../runtime/preparedSceneRuntime.mjs", import.meta.url))).digest("hex"), originalScene.sha256);
  for (const module of reference.modules) {
    assert.equal(module.status, 200);
    assert.equal(module.headers["x-cssearth-audit-source"], reference.sourceIdentity);
    assert.equal(module.headers["x-cssearth-audit-session"], reference.serverIdentity.session);
  }
  const rotation = PREPARED_PRESENTATION.materials.find(track => track.id === "exterior").rotation;
  const publish = createPreparedEllipsoidProjection(rotation);
  for (const [index, sample] of reference.samples.entries()) {
    assert.equal(publish(sample), sample.transform, `independent native projection ${index}`);
    assert.deepEqual(readPreparedCounterMatrix(sample.counterMatrix, rotation.projection), readPreparedMatrix4(sample.counterNative));
  }
});

test("the cutaway's lower-density frame bank is expanded during preparation without a private runtime mapper", () => {
  const track = PREPARED_PRESENTATION.materials.find(track => track.id === "interior");
  const source = PREPARED_SATURN_RUNTIME_SCENE.interior.atmosphere;
  assert.equal(track.frame.count, 256); assert.equal(source.frameCount, 128);
  assert.deepEqual(track.banks.map(bank => bank.id), ["normal", "normal-no-shadows", "normal-ringless", "normal-ringless-no-shadows"]);
  for (const bank of track.banks) for (let frame = 0; frame < 256; frame++) {
    const index = Math.round(frame / 255 * 127);
    const original = source.runtimeShards.variants[bank.id].presentations[index];
    assert.equal(bank.frames[frame].backgroundPosition, original.backgroundPosition);
    assert.equal(bank.frames[frame].backgroundSize, original.backgroundSize);
    assert.equal(bank.frames[frame].frame, frame);
  }
});
