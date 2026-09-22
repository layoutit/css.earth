import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  scalePreparedBackgroundAddresses,
  scalePreparedPixelLengths,
} from "../renderers/css/dist/preparation.js";

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
    getPropertyValue(property: string) {
      return properties.get(property) ?? "";
    },
    setProperty(property: string, value: string) {
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

const { applyPreparedProjectiveLayout } = await import("../renderers/css/dist/preparation.js");
test("scaled projective leaves reject missing prepared dimensions and texture size", () => {
  for (const missing of ["width", "height", "backgroundSize"]) {
    const style = { width: "64px", height: "64px", backgroundSize: "1024px 512px", [missing]: "" };
    assert.throws(() => applyPreparedProjectiveLayout(style, null, 2), new RegExp(missing));
    const layout = { [missing]: missing === "backgroundSize" ? "1024px 512px" : "64px" };
    applyPreparedProjectiveLayout(style, layout, 2);
    assert.equal(style[missing], layout[missing]);
  }
});
test("existing explicit atlas dimensions and addresses remain unchanged when defaults are supplied", () => {
  const values: Record<string, string> = { "--polycss-atlas-width": "256px", "--polycss-atlas-height": "256px" };
  const style = { width: "", height: "", backgroundSize: "512px 256px", getPropertyValue: (name: string) => values[name] ?? "" };
  const before = { ...style };
  applyPreparedProjectiveLayout(style, { width: "64px", height: "64px", backgroundSize: "1024px 512px" }, 2);
  assert.deepEqual(style, before);
});
test("unscaled CSS leaves retain their existing layout contract", () => {
  const style = { width: "", height: "", backgroundSize: "" };
  applyPreparedProjectiveLayout(style, null, 1);
  assert.deepEqual(style, { width: "", height: "", backgroundSize: "" });
});
