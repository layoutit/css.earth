import { createHash } from "node:crypto";

import { PLANET_TITLE_RECIPE } from "./planet-title-recipe.mjs";

const SHA256 = /^[0-9a-f]{64}$/u;
const SAFE_EXPORT = /^[A-Z][A-Z0-9_]*$/u;
const VIEW_BOX = /^0 0 ([1-9][0-9]*(?:\.[0-9]+)?) ([1-9][0-9]*(?:\.[0-9]+)?)$/u;

export const PLANET_TITLE_STANDARD = Object.freeze({
  reference: PLANET_TITLE_RECIPE.reference,
  sourceViewBoxWidth: PLANET_TITLE_RECIPE.referenceViewBoxWidth,
  renderedWidth: PLANET_TITLE_RECIPE.referenceRenderedWidth,
  baseline: PLANET_TITLE_RECIPE.baseline,
  lineBoxHeight:
    PLANET_TITLE_RECIPE.viewBoxHeight *
      (PLANET_TITLE_RECIPE.referenceRenderedWidth /
        PLANET_TITLE_RECIPE.referenceViewBoxWidth),
});

const PLANET_TITLE_SCALE =
  PLANET_TITLE_STANDARD.renderedWidth /
  PLANET_TITLE_STANDARD.sourceViewBoxWidth;

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createPreparedTitle(source, { inputSha256, generator }) {
  validateTitleSource(source);
  if (!SHA256.test(inputSha256 ?? "")) {
    throw new TypeError("Prepared title input hash is invalid.");
  }
  if (!nonEmpty(generator)) {
    throw new TypeError("Prepared title generator is missing.");
  }
  return Object.freeze({
    ...source,
    ...createPreparedTitleLayout(source),
    inputSha256,
    generator,
  });
}

export function createPreparedTitleLayout(source) {
  validateTitleSource(source);
  const match = source.viewBox.match(VIEW_BOX);
  const sourceViewBoxWidth = Number(match[1]);
  const sourceViewBoxHeight = Number(match[2]);
  const renderViewBoxWidth = Math.max(sourceViewBoxWidth, source.width);
  const renderPathOffsetY = PLANET_TITLE_STANDARD.baseline - source.baseline;
  return Object.freeze({
    renderViewBox: `0 0 ${renderViewBoxWidth} ${sourceViewBoxHeight}`,
    renderWidth: stableNumber(renderViewBoxWidth * PLANET_TITLE_SCALE),
    renderHeight: stableNumber(sourceViewBoxHeight * PLANET_TITLE_SCALE),
    renderPathOffsetY: stableNumber(renderPathOffsetY),
  });
}

export function serializePreparedTitleModule(exportName, title) {
  if (!SAFE_EXPORT.test(exportName ?? "")) {
    throw new TypeError("Prepared title export name is invalid.");
  }
  validateTitleSource(title);
  const expectedLayout = createPreparedTitleLayout(title);
  for (const [field, expected] of Object.entries(expectedLayout)) {
    if (title[field] !== expected) {
      throw new TypeError(`Prepared title has invalid ${field}.`);
    }
  }
  if (!SHA256.test(title.inputSha256 ?? "") || !nonEmpty(title.generator)) {
    throw new TypeError("Prepared title provenance is incomplete.");
  }
  return [
    "// Generated. Edit the object-owned title source and rerun preparation.",
    `export const ${exportName} = Object.freeze(${JSON.stringify(title)});`,
    "",
  ].join("\n");
}

export function validateTitleSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Prepared title source must be an object.");
  }
  for (const field of ["label", "viewBox", "path", "source", "sourceUrl"]) {
    if (!nonEmpty(value[field])) {
      throw new TypeError(`Prepared title source has no ${field}.`);
    }
  }
  if (!VIEW_BOX.test(value.viewBox) ||
      !/^M[-0-9.]/u.test(value.path) || /[<>"'`]/u.test(value.path)) {
    throw new TypeError("Prepared title vector is invalid.");
  }
  if (!SHA256.test(value.sourceSha256 ?? "")) {
    throw new TypeError("Prepared title font hash is invalid.");
  }
  for (const field of [
    "width",
    "height",
    "weight",
    "opticalSize",
    "fontSize",
    "letterSpacing",
    "baseline",
  ]) {
    if (!Number.isFinite(value[field])) {
      throw new TypeError(`Prepared title source has invalid ${field}.`);
    }
  }
  return value;
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function stableNumber(value) {
  return Number(value.toFixed(4));
}
