import assert from "node:assert/strict";
import test from "node:test";

import {
  createPreparedTitle,
  PLANET_TITLE_STANDARD,
  serializePreparedTitleModule,
  sha256,
} from "./prepared-title.mjs";

const source = Object.freeze({
  label: "Planet",
  viewBox: `0 0 ${PLANET_TITLE_STANDARD.sourceViewBoxWidth} 35`,
  width: 60.25,
  height: 29.32,
  path: "M0 29V8.63H4.35Z",
  source: "Pinned font",
  sourceUrl: "https://example.test/font.ttf",
  sourceSha256: "a".repeat(64),
  weight: 500,
  opticalSize: 28,
  fontSize: 28,
  letterSpacing: -0.1,
  baseline: 29,
});

test("prepares and serializes a source-bound title deterministically", () => {
  const inputSha256 = sha256("source title");
  const prepared = createPreparedTitle(source, {
    inputSha256,
    generator: "adapter/tools/prepare-title.mjs",
  });
  const first = serializePreparedTitleModule("PREPARED_PLANET_TITLE", prepared);
  const second = serializePreparedTitleModule("PREPARED_PLANET_TITLE", prepared);
  assert.equal(first, second);
  assert.match(first, new RegExp(inputSha256, "u"));
  assert.match(first, /adapter\/tools\/prepare-title\.mjs/u);
  assert.deepEqual(
    {
      renderViewBox: prepared.renderViewBox,
      renderWidth: prepared.renderWidth,
      renderHeight: prepared.renderHeight,
      renderPathOffsetY: prepared.renderPathOffsetY,
    },
    {
      renderViewBox: `0 0 ${PLANET_TITLE_STANDARD.sourceViewBoxWidth} 35`,
      renderWidth: PLANET_TITLE_STANDARD.renderedWidth,
      renderHeight: 30.1284,
      renderPathOffsetY: 0,
    },
  );
});

test("normalizes divergent title sources to the Saturn scale and baseline", () => {
  const prepared = createPreparedTitle({
    ...source,
    label: "Earth",
    viewBox: "0 0 66 30",
    width: 65.277734,
    height: 20.63,
    baseline: 23,
  }, {
    inputSha256: "b".repeat(64),
    generator: "adapter/tools/prepare-title.mjs",
  });
  assert.deepEqual(
    {
      renderViewBox: prepared.renderViewBox,
      renderWidth: prepared.renderWidth,
      renderHeight: prepared.renderHeight,
      renderPathOffsetY: prepared.renderPathOffsetY,
    },
    {
      renderViewBox: "0 0 66 30",
      renderWidth: 56.8136,
      renderHeight: 25.8244,
      renderPathOffsetY: 6,
    },
  );
  assert.equal(prepared.baseline + prepared.renderPathOffsetY,
    PLANET_TITLE_STANDARD.baseline);
});

test("rejects unexplained or unsafe title vectors", () => {
  assert.throws(() => createPreparedTitle({ ...source, path: "<text>Planet</text>" }, {
    inputSha256: "b".repeat(64),
    generator: "prepare-title.mjs",
  }), /vector/u);
  assert.throws(() => createPreparedTitle(source, {
    inputSha256: "not-a-hash",
    generator: "prepare-title.mjs",
  }), /hash/u);
  assert.throws(() => serializePreparedTitleModule("unsafe-name", {
    ...source,
    inputSha256: "b".repeat(64),
    generator: "prepare-title.mjs",
  }), /export name/u);
});
