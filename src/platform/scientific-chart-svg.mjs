const FONT =
  "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
const GRID_COLOR = "#fff";
const GRID_OPACITY = ".05";
const LABEL_COLOR = "#b8bbc4";
const SERIES_COLOR = "#b8bbc4";
const CHART_WIDTH = 306;
const CHART_HEIGHT = 141;
const CHART_CONTENT_TRANSFORM = "scale(.95625 .9578313253)";
const CHART_SCALE_Y = 159 / 166;
const CHART_FONT_SIZE = Number((13 / CHART_SCALE_Y).toFixed(3));
const PLOT_RIGHT = 320;

export function renderReflectanceChart({
  id,
  title,
  description,
  metadata,
  points,
  maximum,
}) {
  validateChartIdentity({ id, title, description, metadata });
  if (!Array.isArray(points) || points.length < 2 ||
      points.some(({ wavelength, total }, index) =>
        !Number.isFinite(wavelength) || !Number.isFinite(total) ||
        index > 0 && wavelength <= points[index - 1].wavelength) ||
      !Number.isFinite(maximum) || maximum <= 0) {
    throw new TypeError("Reflectance chart data is incompatible.");
  }
  const first = points[0].wavelength;
  const last = points.at(-1).wavelength;
  if (first > 0.35 || last < 0.75 || last > 1.01) {
    throw new RangeError("Reflectance chart wavelength range is incompatible.");
  }
  const pointPath = points.map(({ wavelength, total }, index) => {
    const x = (wavelength - first) / (last - first) * PLOT_RIGHT;
    const y = 106 - total / maximum * 98;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const visibleStart = (0.38 - 0.35) / 0.65 * PLOT_RIGHT;
  const visibleEnd = (0.75 - 0.35) / 0.65 * PLOT_RIGHT;
  const visibleWidth = visibleEnd - visibleStart;
  const infraredWidth = PLOT_RIGHT - visibleEnd;
  const labelX = (wavelength) =>
    (wavelength - 0.35) / 0.65 * PLOT_RIGHT;

  return `<svg xmlns="http://www.w3.org/2000/svg" class="planet-reflectance-chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-labelledby="${id}-reflectance-title ${id}-reflectance-description" font-family="${FONT}" font-size="${CHART_FONT_SIZE}">
  <title id="${id}-reflectance-title">${escapeXmlText(title)}</title>
  <desc id="${id}-reflectance-description">${escapeXmlText(description)}</desc>
  <metadata>${serializeMetadata(metadata)}</metadata>
  <defs>
    <linearGradient id="${id}-visible-spectrum" gradientUnits="userSpaceOnUse" x1="${visibleStart}" x2="${visibleEnd}">
      <stop stop-color="#5d2e91"/>
      <stop offset=".12" stop-color="#4243a5"/>
      <stop offset=".26" stop-color="#2761b7"/>
      <stop offset=".4" stop-color="#2098b5"/>
      <stop offset=".53" stop-color="#35a660"/>
      <stop offset=".65" stop-color="#d5ca48"/>
      <stop offset=".76" stop-color="#e38b37"/>
      <stop offset=".88" stop-color="#d1493b"/>
      <stop offset="1" stop-color="#7d242d"/>
    </linearGradient>
  </defs>
  <g fill="${GRID_COLOR}" fill-opacity="${GRID_OPACITY}" shape-rendering="crispEdges">
    <rect x="0" y="${axisY(8)}" width="${CHART_WIDTH}" height="1"/>
    <rect x="0" y="${axisY(57)}" width="${CHART_WIDTH}" height="1"/>
  </g>
  <g transform="${CHART_CONTENT_TRANSFORM}">
  <g fill="${LABEL_COLOR}" opacity=".65">
    <text x="0" y="141">wavelength (nm)</text>
    <text x="${labelX(0.75)}" y="141" text-anchor="middle">750</text>
    <text x="${PLOT_RIGHT}" y="141" text-anchor="end">1000</text>
  </g>
  <path class="planet-chart-line" d="${pointPath}" fill="none" stroke="${SERIES_COLOR}" stroke-width="1.25" stroke-opacity=".9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision"/>
  <rect x="0" y="114" width="${visibleStart}" height="6" fill="#261735"/>
  <rect x="${visibleStart}" y="114" width="${visibleWidth}" height="6" fill="url(#${id}-visible-spectrum)"/>
  <rect x="${visibleEnd}" y="114" width="${infraredWidth}" height="6" fill="#32191d"/>
  </g>
</svg>
`;
}

export function renderTemperaturePressureChart({
  id,
  title,
  description,
  metadata,
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum,
  temperatureMaximum,
  pressureTicks,
}) {
  validateChartIdentity({ id, title, description, metadata });
  if (!Array.isArray(layers) || layers.length < 2 ||
      layers.some(({ pressure, temperature }) =>
        !Number.isFinite(pressure) || pressure <= 0 ||
        !Number.isFinite(temperature)) ||
      !Number.isFinite(pressureMinimum) || pressureMinimum <= 0 ||
      !Number.isFinite(pressureMaximum) || pressureMaximum <= pressureMinimum ||
      !Number.isFinite(temperatureMinimum) ||
      !Number.isFinite(temperatureMaximum) ||
      temperatureMaximum <= temperatureMinimum ||
      !Array.isArray(pressureTicks) || pressureTicks.length === 0 ||
      pressureTicks.some(({ pressure, label }) =>
        !Number.isFinite(pressure) || pressure < pressureMinimum ||
        pressure > pressureMaximum || typeof label !== "string")) {
    throw new TypeError("Temperature-pressure chart data is incompatible.");
  }
  const profileX = (temperature) =>
    (temperature - temperatureMinimum) /
    (temperatureMaximum - temperatureMinimum) * PLOT_RIGHT;
  const profileY = (pressure) => 8 +
    (Math.log10(pressure) - Math.log10(pressureMinimum)) /
    (Math.log10(pressureMaximum) - Math.log10(pressureMinimum)) * 114;
  const profilePath = layers.map(({ pressure, temperature }, index) =>
    `${index === 0 ? "M" : "L"}${profileX(temperature).toFixed(2)} ` +
    profileY(pressure).toFixed(2)).join(" ");
  const grid = pressureTicks.map(({ pressure }) =>
    `<rect x="0" y="${axisY(profileY(pressure))}" width="${CHART_WIDTH}" height="1"/>`
  ).join(" ");
  const temperatureMidpoint =
    (temperatureMinimum + temperatureMaximum) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" class="planet-temperature-pressure-chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-labelledby="${id}-temperature-pressure-title ${id}-temperature-pressure-description" font-family="${FONT}" font-size="${CHART_FONT_SIZE}">
  <title id="${id}-temperature-pressure-title">${escapeXmlText(title)}</title>
  <desc id="${id}-temperature-pressure-description">${escapeXmlText(description)}</desc>
  <metadata>${serializeMetadata(metadata)}</metadata>
  <g fill="${GRID_COLOR}" fill-opacity="${GRID_OPACITY}" shape-rendering="crispEdges">${grid}</g>
  <g transform="${CHART_CONTENT_TRANSFORM}">
  <g fill="${LABEL_COLOR}" opacity=".65">
    <text x="0" y="141">temperature (K)</text>
    <text x="${PLOT_RIGHT / 2}" y="141" text-anchor="middle">${temperatureMidpoint}</text>
    <text x="${PLOT_RIGHT}" y="141" text-anchor="end">${temperatureMaximum}</text>
  </g>
  <path class="planet-chart-line" d="${profilePath}" fill="none" stroke="${SERIES_COLOR}" stroke-width="1.25" stroke-opacity=".9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision"/>
  </g>
</svg>
`;
}

export function renderPhotometricPhaseChart({
  id,
  title,
  description,
  metadata,
  points,
}) {
  validateChartIdentity({ id, title, description, metadata });
  if (!Array.isArray(points) || points.length < 3 ||
      points.some(({ phaseAngle, dimmingMagnitude }, index) =>
        !Number.isFinite(phaseAngle) || phaseAngle < 0 || phaseAngle > 180 ||
        !Number.isFinite(dimmingMagnitude) ||
        index > 0 && phaseAngle <= points[index - 1].phaseAngle) ||
      points[0].phaseAngle !== 0) {
    throw new TypeError("Photometric phase chart data is incompatible.");
  }
  const lastAngle = points.at(-1).phaseAngle;
  const dimming = points.map(({ dimmingMagnitude }) => dimmingMagnitude);
  const minimum = Math.min(...dimming);
  const maximum = Math.max(...dimming);
  if (maximum - minimum <= 0) {
    throw new RangeError("Photometric phase chart has no brightness range.");
  }
  const pointPath = points.map(({ phaseAngle, dimmingMagnitude }, index) => {
    const x = phaseAngle / lastAngle * PLOT_RIGHT;
    const y = 8 + (dimmingMagnitude - minimum) / (maximum - minimum) * 98;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  const midpoint = Math.round(lastAngle / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" class="planet-photometric-phase-chart" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" role="img" aria-labelledby="${id}-photometric-phase-title ${id}-photometric-phase-description" font-family="${FONT}" font-size="${CHART_FONT_SIZE}">
  <title id="${id}-photometric-phase-title">${escapeXmlText(title)}</title>
  <desc id="${id}-photometric-phase-description">${escapeXmlText(description)}</desc>
  <metadata>${serializeMetadata(metadata)}</metadata>
  <g fill="${GRID_COLOR}" fill-opacity="${GRID_OPACITY}" shape-rendering="crispEdges">
    <rect x="0" y="${axisY(8)}" width="${CHART_WIDTH}" height="1"/>
    <rect x="0" y="${axisY(57)}" width="${CHART_WIDTH}" height="1"/>
  </g>
  <g transform="${CHART_CONTENT_TRANSFORM}">
  <g fill="${LABEL_COLOR}" opacity=".65">
    <text x="0" y="141">phase angle (°)</text>
    <text x="${PLOT_RIGHT / 2}" y="141" text-anchor="middle">${midpoint}</text>
    <text x="${PLOT_RIGHT}" y="141" text-anchor="end">${lastAngle}</text>
  </g>
  <path class="planet-chart-line" d="${pointPath}" fill="none" stroke="${SERIES_COLOR}" stroke-width="1.25" stroke-opacity=".9" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" shape-rendering="geometricPrecision"/>
  </g>
</svg>
`;
}

function validateChartIdentity({ id, title, description, metadata }) {
  if (!/^[a-z][a-z0-9-]*$/u.test(id) ||
      typeof title !== "string" || title.length === 0 ||
      typeof description !== "string" || description.length === 0 ||
      !metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new TypeError("Scientific chart identity is incompatible.");
  }
}

function axisY(value) {
  return Math.round(value * CHART_SCALE_Y);
}

function serializeMetadata(metadata) {
  let serialized;
  try {
    serialized = JSON.stringify(metadata);
  } catch (cause) {
    throw new TypeError("Scientific chart metadata is not serializable.", { cause });
  }
  if (typeof serialized !== "string") {
    throw new TypeError("Scientific chart metadata is not serializable.");
  }
  return escapeXmlText(serialized);
}

function escapeXmlText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
