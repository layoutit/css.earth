import assert from "node:assert/strict";
import test from "node:test";

import {
  scalePreparedBackgroundAddresses,
  scalePreparedPixelLengths,
} from "./prepared-projective-texture-leaf.mjs";

test("scales every prepared pixel address in multi-layer backgrounds", () => {
  assert.equal(
    scalePreparedPixelLengths("-16px -8px, 0px 24.5px", 2.5),
    "-40px -20px, 0px 61.25px",
  );
  assert.equal(
    scalePreparedPixelLengths("1040px 520px, 2080px 1040px", 2),
    "2080px 1040px, 4160px 2080px",
  );
});

test("scales variable-backed prepared background addresses", () => {
  const properties = new Map([
    ["--mercury-surface-position", "-8px -680px"],
  ]);
  const style = {
    backgroundPosition: "var(--mercury-surface-position)",
    backgroundSize: "1040px 768px",
    getPropertyValue(property) {
      return properties.get(property) ?? "";
    },
    setProperty(property, value) {
      properties.set(property, value);
    },
  };

  scalePreparedBackgroundAddresses(style, 4);

  assert.equal(
    properties.get("--mercury-surface-position"),
    "-32px -2720px",
  );
  assert.equal(style.backgroundPosition, "var(--mercury-surface-position)");
  assert.equal(style.backgroundSize, "4160px 3072px");
});
