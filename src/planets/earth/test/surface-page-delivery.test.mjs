import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { writeEarthSurfaceDelivery } from "../tools/surface-page-delivery.mjs";

const plan = {
  encodingPages: [{ width: 16, height: 16 }],
  pages: [{ width: 16, height: 8 }, { width: 16, height: 8 }],
  pageSources: [{ page: 0, top: 0 }, { page: 0, top: 8 }],
};

for (const density of [2, 4, 8]) test(`delivery preserves accepted colors, alpha and texel phase at density ${density}`, async () => {
  const width = 2 * density;
  const raw = Buffer.from(Array.from({ length: width * width * 4 }, (_, index) =>
    index % 4 === 3 ? [0, 1, 97, 255][Math.floor(index / 4) % 4] : index * 37 % 256));
  const encoded = await sharp(raw, { raw: { width, height: width, channels: 4 } })
    .webp({ quality: 84, alphaQuality: 100 }).toBuffer();
  const accepted = await sharp(encoded).ensureAlpha().raw().toBuffer();
  const outputs = new Map();
  const receipt = await writeEarthSurfaceDelivery({ plan, density,
    encodeSourcePage: async page => { assert.equal(page, 0); return encoded; },
    writePage: async (page, bytes) => outputs.set(page, bytes),
  });
  assert.equal(receipt.source[0].sha256, createHash("sha256").update(encoded).digest("hex"));
  assert.deepEqual([...outputs.keys()], [0, 1]);
  for (const [page, bytes] of outputs) {
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [width, density]);
    const start = page * density * width * 4;
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      assert.equal(data[pixel + 3], accepted[start + pixel + 3]);
      if (data[pixel + 3]) assert.deepEqual(data.subarray(pixel, pixel + 3), accepted.subarray(start + pixel, start + pixel + 3));
    }
  }
  const repeated = new Map();
  assert.deepEqual(await writeEarthSurfaceDelivery({ plan, density,
    encodeSourcePage: async () => encoded, writePage: async (page, bytes) => repeated.set(page, bytes),
  }), receipt);
  assert.deepEqual(repeated, outputs);
});

test("delivery rejects incompatible density, source dimensions and out-of-bounds strips", async () => {
  const encoded = await sharp({ create: { width: 16, height: 16, channels: 4, background: "red" } }).webp().toBuffer();
  const run = (overrides) => writeEarthSurfaceDelivery({ plan, density: 8,
    encodeSourcePage: async () => encoded, writePage: async () => {}, ...overrides });
  await assert.rejects(run({ density: 3 }), /incompatible/);
  await assert.rejects(run({ plan: { ...plan, encodingPages: [{ width: 32, height: 16 }] } }), /dimensions/);
  await assert.rejects(run({ plan: { ...plan, pages: [{ width: 16, height: 1028 }, plan.pages[1]] } }), /bounds/);
  await assert.rejects(run({ plan: { ...plan, pageSources: [{ page: 0, top: -4 }, plan.pageSources[1]] } }), /bounds/);
  await assert.rejects(run({ plan: { ...plan, pageSources: [{ page: 0, top: 12 }, plan.pageSources[1]] } }), /bounds/);
  await assert.rejects(run({ plan: { ...plan, pageSources: [{ page: 2, top: 0 }, plan.pageSources[1]] } }), /missing/);
});
