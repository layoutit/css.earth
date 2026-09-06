import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { PREPARED_JUPITER_LIGHTING as lighting } from "../runtime/preparedLighting.mjs";
import { runtimeDefinition } from "../runtime/definition.mjs";
import {
  prepareJupiterMaterialFrame,
  applyJupiterLinearLight,
  measurePublishedJupiterAtmosphereReference,
} from "../tools/prepare-atmosphere.mjs";
import { createPreparedMaterialPublisher } from "../../../platform/prepared-material.mjs";
import { selectedPreparedVariant } from "../../../platform/prepared-presentation.mjs";
import { initialObjectSelection } from "../../../platform/object-runtime-contract.mjs";
import { retainedPresentationFixture } from "../../../platform/test/object-runtime-package.mjs";

const luminance = (frame, x, y) => {
  const offset = (y * frame.width + x) * 4;
  const alpha = frame.data[offset + 3] / 255;
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, channel) =>
    sum + weight * (frame.data[offset + channel] * alpha +
      lighting.shadow.referenceChannel * (1 - alpha)), 0);
};

test("prepared lighting follows phase with a fixed reference projection", () => {
  const dark = prepareJupiterMaterialFrame(-1);
  const half = prepareJupiterMaterialFrame(0);
  const full = prepareJupiterMaterialFrame(1);
  assert.ok(luminance(full, 256, 256) > luminance(dark, 256, 256) + 80);
  const [x, y] = half.cameraLightDirection;
  assert.ok(luminance(half, Math.round(256 + x * 120), Math.round(256 + y * 120)) >
    luminance(half, Math.round(256 - x * 120), Math.round(256 - y * 120)) + 40);
  assert.deepEqual(dark.projection, full.projection);
  for (const frame of [dark, half, full]) {
    const offset = (256 * 512 + 500) * 4;
    assert.deepEqual([...frame.data.subarray(offset, offset + 4)], [0, 0, 0, 0]);
  }
});

test("Hubble photometry and the absence of an exterior halo remain source-backed", async () => {
  assert.deepEqual(await measurePublishedJupiterAtmosphereReference(),
    lighting.atmosphere.sourceReference);
  assert.equal(applyJupiterLinearLight(160, 0.5), 116);
});

test("published dark, half and full phase tiles reproduce from the preparation inputs", async () => {
  for (const index of [0, 90, 180]) {
    const sample = lighting.presentations[index];
    const row = lighting.rows[sample.rowIndex];
    const data = await sharp(new URL(`../../../../public${row.url}`, import.meta.url).pathname)
      .extract({
        left: (index % lighting.transport.framesPerRow) * 528 + 8,
        top: 8,
        width: 512,
        height: 512,
      }).raw().toBuffer();
    const prepared = prepareJupiterMaterialFrame(sample.lightViewZ).data;
    // Transparent RGB is discarded by lossless WebP. Compare visible texels.
    for (let offset = 0; offset < data.length; offset += 4) {
      assert.equal(data[offset + 3], prepared[offset + 3]);
      // Compositing the translucent raw tile quantizes premultiplied RGB
      // before lossless WebP encoding; allow one 8-bit compositing step.
      const alpha = data[offset + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        assert.ok(Math.abs(data[offset + channel] - prepared[offset + channel]) * alpha <= 1);
      }
    }
  }
});

test("Jupiter uses the common ellipsoid publisher and unchanged views do not rewrite materials", () => {
  const f = retainedPresentationFixture(runtimeDefinition);
  const track = runtimeDefinition.materials[0];
  try {
    const element = f.document.createElement("s");
    const publisher = createPreparedMaterialPublisher(track, element, runtimeDefinition.camera);
    const selected = selectedPreparedVariant(runtimeDefinition, {
      ...initialObjectSelection(runtimeDefinition.controls),
      shadows: true,
    }).materials[0];
    const matrix = "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)";
    const view = {
      sceneMatrix: matrix,
      sunViewDirection: [1, 0, 0],
      counterRotationFor: () => matrix,
    };
    view.reference = view;
    const resources = { ...f.resources, has: () => true };
    publisher.publish(selected, view, resources);
    assert.equal(publisher.observe().appliedFrame, 90);
    const before = publisher.observe();
    publisher.publish(selected, view, resources);
    assert.deepEqual(publisher.observe(), before);
    publisher.publish(selected, { ...view, sunViewDirection: [0, 1, 0] }, resources);
    assert.equal(publisher.observe().appliedFrame, 90);
    assert.equal(publisher.observe().lightRollDegrees, 90);
  } finally {
    f.restore();
  }
});
