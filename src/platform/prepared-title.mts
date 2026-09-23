export interface TitleSource { label: string; viewBox: string; path: string; source: string; sourceUrl: string; width: number; height: number; weight: number; opticalSize: number; fontSize: number; letterSpacing: number; baseline: number; }
export type PreparedTitle = TitleSource & ReturnType<typeof createPreparedTitleLayout> & { generator: string };

import { OBJECT_TITLE_RECIPE } from "./object-title-recipe.mts";

const SAFE_EXPORT = /^[A-Z][A-Z0-9_]*$/u;
const VIEW_BOX = /^0 0 ([1-9][0-9]*(?:\.[0-9]+)?) ([1-9][0-9]*(?:\.[0-9]+)?)$/u;

export const OBJECT_TITLE_STANDARD = Object.freeze({
  reference: OBJECT_TITLE_RECIPE.reference,
  sourceViewBoxWidth: OBJECT_TITLE_RECIPE.referenceViewBoxWidth,
  renderedWidth: OBJECT_TITLE_RECIPE.referenceRenderedWidth,
  baseline: OBJECT_TITLE_RECIPE.baseline,
  lineBoxHeight:
    OBJECT_TITLE_RECIPE.viewBoxHeight *
      (OBJECT_TITLE_RECIPE.referenceRenderedWidth /
        OBJECT_TITLE_RECIPE.referenceViewBoxWidth),
});

const OBJECT_TITLE_SCALE =
  OBJECT_TITLE_STANDARD.renderedWidth /
  OBJECT_TITLE_STANDARD.sourceViewBoxWidth;



export function createPreparedTitle(source: TitleSource, { generator }: { generator: string }) {
  validateTitleSource(source);
  if (!nonEmpty(generator)) {
    throw new TypeError("Prepared title generator is missing.");
  }
  return Object.freeze({
    ...source,
    ...createPreparedTitleLayout(source),
    generator,
  });
}

export function createPreparedTitleLayout(source: TitleSource) {
  validateTitleSource(source);
  const match = source.viewBox.match(VIEW_BOX);
  if (!match) throw new TypeError("Prepared title vector is invalid.");
  const sourceViewBoxWidth = Number(match[1]);
  const sourceViewBoxHeight = Number(match[2]);
  const renderViewBoxWidth = Math.max(sourceViewBoxWidth, source.width);
  const renderPathOffsetY = OBJECT_TITLE_STANDARD.baseline - source.baseline;
  return Object.freeze({
    renderViewBox: `0 0 ${renderViewBoxWidth} ${sourceViewBoxHeight}`,
    renderWidth: stableNumber(renderViewBoxWidth * OBJECT_TITLE_SCALE),
    renderHeight: stableNumber(sourceViewBoxHeight * OBJECT_TITLE_SCALE),
    renderPathOffsetY: stableNumber(renderPathOffsetY),
  });
}

export function serializePreparedTitleModule(exportName: string, title: PreparedTitle) {
  if (!SAFE_EXPORT.test(exportName ?? "")) {
    throw new TypeError("Prepared title export name is invalid.");
  }
  validateTitleSource(title);
  const expectedLayout = createPreparedTitleLayout(title);
  for (const [field, expected] of Object.entries(expectedLayout)) {
    if (title[field as keyof typeof expectedLayout] !== expected) {
      throw new TypeError(`Prepared title has invalid ${field}.`);
    }
  }
  if (!nonEmpty(title.generator)) {
    throw new TypeError("Prepared title provenance is incomplete.");
  }
  return [
    "// Generated. Edit the object-owned title source and rerun preparation.",
    `export const ${exportName} = Object.freeze(${JSON.stringify(title)});`,
    "",
  ].join("\n");
}

export function validateTitleSource(value: TitleSource) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Prepared title source must be an object.");
  }
  for (const field of ["label", "viewBox", "path", "source", "sourceUrl"] as const) {
    if (!nonEmpty(value[field])) {
      throw new TypeError(`Prepared title source has no ${field}.`);
    }
  }
  if (!VIEW_BOX.test(value.viewBox) ||
      !/^M[-0-9.]/u.test(value.path) || /[<>"'`]/u.test(value.path)) {
    throw new TypeError("Prepared title vector is invalid.");
  }
  for (const field of [
    "width",
    "height",
    "weight",
    "opticalSize",
    "fontSize",
    "letterSpacing",
    "baseline",
  ] as const) {
    if (!Number.isFinite(value[field])) {
      throw new TypeError(`Prepared title source has invalid ${field}.`);
    }
  }
  return value;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function stableNumber(value: number) {
  return Number(value.toFixed(4));
}
