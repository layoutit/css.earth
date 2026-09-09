function freezeArray(values) {
  return Object.freeze([...values]);
}

function validateLabel(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`Lens legend ${field} must be a non-empty string.`);
  }
  return value;
}

function preparedRgb(value, index) {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value)) {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16),
    ];
  }
  if (!Array.isArray(value) || value.length !== 3 || value.some((channel) =>
    !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new TypeError(`Lens legend palette color ${index} is invalid.`);
  }
  return [...value];
}

function serializeRgb(value) {
  return `rgb(${value.join(" ")})`;
}

function prepareScaleColors(palette, sampleCount = 64) {
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
}) {
  validateLabel(title, "title");
  if (!Array.isArray(palette) || palette.length < 2) {
    throw new TypeError("Lens legend palette must contain at least two colors.");
  }
  if (!Array.isArray(labels) || labels.length < 2) {
    throw new TypeError("Lens legend labels must contain at least two values.");
  }
  const legend = {
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

export function prepareLensCategoryLegend({ title, items, meta, sourceUrl }) {
  validateLabel(title, "title");
  if (!Array.isArray(items) || items.length < 2) {
    throw new TypeError("Lens category legend must contain at least two items.");
  }
  const preparedItems = items.map((item, index) => Object.freeze({
    label: validateLabel(item?.label, `item ${index} label`),
    ...(item?.description === undefined ? {} : { description: validateLabel(item.description, `item ${index} description`) }),
    color: serializeRgb(preparedRgb(item?.color, index)),
  }));
  const legend = {
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
