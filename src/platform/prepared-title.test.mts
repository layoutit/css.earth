import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import { createPreparedTitleLayout, OBJECT_TITLE_STANDARD } from "./prepared-title.mts";

const source = Object.freeze({
  label: "Planet",
  viewBox: `0 0 ${OBJECT_TITLE_STANDARD.sourceViewBoxWidth} 35`,
  width: 60.25,
  height: 29.32,
  path: "M0 29V8.63H4.35Z",
  source: "Pinned font",
  sourceUrl: "https://example.test/font.ttf",
  weight: 500,
  opticalSize: 28,
  fontSize: 28,
  letterSpacing: -0.1,
  baseline: 29,
});

test("prepares a source-bound title layout deterministically", () => {
  const prepared = createPreparedTitleLayout(source);
  assert.deepEqual(createPreparedTitleLayout(source), prepared);
  assert.deepEqual(
    {
      renderViewBox: prepared.renderViewBox,
      renderWidth: prepared.renderWidth,
      renderHeight: prepared.renderHeight,
      renderPathOffsetY: prepared.renderPathOffsetY,
    },
    {
      renderViewBox: `0 0 ${OBJECT_TITLE_STANDARD.sourceViewBoxWidth} 35`,
      renderWidth: OBJECT_TITLE_STANDARD.renderedWidth,
      renderHeight: 30.1284,
      renderPathOffsetY: 0,
    },
  );
});

test("normalizes divergent title sources to the Saturn scale and baseline", () => {
  const prepared = createPreparedTitleLayout({
    ...source,
    label: "Earth",
    viewBox: "0 0 66 30",
    width: 65.277734,
    height: 20.63,
    baseline: 23,
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
  assert.equal(23 + prepared.renderPathOffsetY,
    OBJECT_TITLE_STANDARD.baseline);
});

test("rejects unexplained or unsafe title vectors", () => {
  assert.throws(() => createPreparedTitleLayout({ ...source, path: "<text>Planet</text>" }), /vector/u);
});
