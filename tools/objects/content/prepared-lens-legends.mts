import { isArray } from '@cssearth/core';
export interface PreparedLensLegend {
  readonly kind: "scale" | "categories";
  readonly title: string;
  meta?: string;
  readonly src?: string;
  readonly colors?: readonly string[];
  readonly labels?: readonly string[];
  readonly items?: ReadonlyArray<{
    readonly label: string;
    readonly description?: string;
    readonly color: string;
  }>;
  sourceUrl?: string;
}

function freezeArray<T>(values: readonly T[]) {
  return Object.freeze([...values]);
}

function validateLabel(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Lens legend ${field} must be a non-empty string.`);
  }
  return value;
}

function preparedRgb(value: unknown, index: number): number[] {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value)) {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16),
    ];
  }
  if (!isArray(value) || value.length !== 3 || !value.every((channel): channel is number =>
    typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
    throw new TypeError(`Lens legend palette color ${index} is invalid.`);
  }
  return [...value];
}

function serializeRgb(value: readonly number[]) {
  return `rgb(${value.join(" ")})`;
}

function prepareScaleColors(palette: readonly unknown[], sampleCount = 64) {
  const stops = palette.map(preparedRgb);
  return Array.from({ length: sampleCount }, (_, index) => {
    const position = index / (sampleCount - 1) * (stops.length - 1);
    const startIndex = Math.floor(position);
    const endIndex = Math.min(startIndex + 1, stops.length - 1);
    const amount = position - startIndex;
    return serializeRgb(stops[startIndex].map((channel, channelIndex) =>
      Math.round(channel + (stops[endIndex][channelIndex] - channel) * amount)));
  });
}

export function prepareLensScaleLegend({
  title,
  palette,
  labels = ["Low", "High"],
  meta,
  sourceUrl,
}: { title: string; palette: readonly (string | readonly number[])[]; labels?: readonly string[]; meta?: string; sourceUrl?: string }) {
  validateLabel(title, "title");
  if (!isArray(palette) || palette.length < 2) {
    throw new TypeError("Lens legend palette must contain at least two colors.");
  }
  if (!isArray(labels) || labels.length < 2) {
    throw new TypeError("Lens legend labels must contain at least two values.");
  }
  const legend: PreparedLensLegend = {
    kind: "scale",
    title,
    colors: freezeArray(prepareScaleColors(palette)),
    labels: freezeArray(labels.map((label, index) =>
      validateLabel(label, `label ${index}`))),
  };
  if (meta !== undefined) legend.meta = validateLabel(meta, "meta");
  if (sourceUrl !== undefined) {
    legend.sourceUrl = validateLabel(sourceUrl, "source URL");
  }
  return Object.freeze(legend);
}

export function prepareLensCategoryLegend({ title, items, meta, sourceUrl }: { title: string; items: readonly { label: string; description?: string; color: string | readonly number[] }[]; meta?: string; sourceUrl?: string }) {
  validateLabel(title, "title");
  if (!isArray(items) || items.length < 2) {
    throw new TypeError("Lens category legend must contain at least two items.");
  }
  const preparedItems = items.map((item, index) => Object.freeze({
    label: validateLabel(item?.label, `item ${index} label`),
    ...(item?.description === undefined ? {} : { description: validateLabel(item.description, `item ${index} description`) }),
    color: serializeRgb(preparedRgb(item?.color, index)),
  }));
  const legend: PreparedLensLegend = {
    kind: "categories",
    title,
    items: freezeArray(preparedItems),
  };
  if (meta !== undefined) legend.meta = validateLabel(meta, "meta");
  if (sourceUrl !== undefined) {
    legend.sourceUrl = validateLabel(sourceUrl, "source URL");
  }
  return Object.freeze(legend);
}
