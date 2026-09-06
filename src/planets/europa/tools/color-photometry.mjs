import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { EUROPA_SOURCE_ROOT } from "./preparation-paths.mjs";
import { assertEuropaSourceBytes, europaSourceManifest, validateEuropaSourceGroup } from "./source-manifest.mjs";

const radians = Math.PI / 180;
export const COLOR_PHOTOMETRY = Object.freeze({
  model: "Lunar-Lambert",
  // Qualified per observation: preserve the accepted March correction and
  // reduce the remaining June/December gradients with a gentler mixed disk.
  observationWeights: Object.freeze({ "14ESGLOCOL01": 1, "12ESGLOCOL01": 0.5, "G1ESGLOBAL01": 0.5 }),
  referenceIncidenceDegrees: 30, referenceEmissionDegrees: 0,
  maximumIncidenceDegrees: 75, maximumEmissionDegrees: 75,
  phaseNormalization: false, radiusKm: 1560.8,
});

// All source interpretation happens during preparation. The pinned Horizons
// vectors use the controlled images' exact ETs and their adjusted body frame,
// not the legacy PDS west-longitude estimates. No network access is needed.
export async function loadColorGeometry() {
  const entries = await validateEuropaSourceGroup("photometry");
  const vectors = {};
  for (const name of ["sun", "galileo"]) {
    const path = `photometry/horizons-${name}.json`;
    const bytes = await readFile(resolve(EUROPA_SOURCE_ROOT, path));
    assertEuropaSourceBytes(europaSourceManifest().documents.find(entry => entry.path === path), bytes);
    const { response } = JSON.parse(bytes);
    vectors[name] = response.result.split("$$SOE")[1].split("$$EOE")[0].trim().split("\n").map(line => {
      const [jd, , ...position] = line.split(",");
      return { et: (Number(jd) - 2451545) * 86400, position: position.slice(0, 3).map(Number) };
    });
  }
  const geometry = new Map();
  for (const entry of entries) {
    const label = await readFile(resolve(EUROPA_SOURCE_ROOT, entry.path), "utf8");
    const et = Number(label.match(/CkTableStartTime\s*=\s*([^\s]+)/)[1]);
    const frame = controlledBodyFrame(label, et);
    const transform = name => {
      const sample = vectors[name].find(row => Math.abs(row.et - et) < 0.001);
      if (!sample || !sample.position.every(Number.isFinite)) throw new Error(`Missing capture geometry: ${entry.id}`);
      return frame.map(axis => axis.reduce((sum, value, i) => sum + value * sample.position[i], 0));
    };
    geometry.set(entry.imageId, { sun: transform("sun"), observer: transform("galileo") });
  }
  return geometry;
}

// NAIF text-PCK orientation: R3(W) R1(90-Dec) R3(90+RA),
// including the label's nutation/precession terms. Rows are body axes in ICRF.
export function controlledBodyFrame(label, et) {
  const array = key => label.match(new RegExp(`\\b${key}\\s*=\\s*\\(([^)]+)\\)`))[1].split(",").map(Number);
  const centuries = et / (86400 * 36525), days = et / 86400;
  const rates = array("SysNutPrec1");
  const arguments_ = array("SysNutPrec0").map((value, i) => (value + rates[i] * centuries) * radians);
  const angle = (key, periodic, fn, time) => (array(key).reduce((sum, value, i) => sum + value * time ** i, 0) +
    array(periodic).reduce((sum, value, i) => sum + value * fn(arguments_[i]), 0)) * radians;
  const ra = angle("PoleRa", "PoleRaNutPrec", Math.sin, centuries);
  const dec = angle("PoleDec", "PoleDecNutPrec", Math.cos, centuries);
  const w = angle("PrimeMeridian", "PmNutPrec", Math.sin, days);
  const x = [-Math.sin(ra), Math.cos(ra), 0];
  const y = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  return [
    x.map((value, i) => Math.cos(w) * value + Math.sin(w) * y[i]),
    x.map((value, i) => -Math.sin(w) * value + Math.cos(w) * y[i]),
    [Math.cos(ra) * Math.cos(dec), Math.sin(ra) * Math.cos(dec), Math.sin(dec)],
  ];
}

// A spherical disk correction, not a fitted Europa albedo or terrain model.
// Oblique observations are withheld; real monochrome supplies those pixels.
export function colorPhotometricGain(normal, geometry, weight) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error("Missing or invalid observation disk weight");
  const cosine = position => {
    const v = position.map((value, i) => value - COLOR_PHOTOMETRY.radiusKm * normal[i]);
    return normal.reduce((sum, value, i) => sum + value * v[i], 0) / Math.hypot(...v);
  };
  const mu0 = cosine(geometry.sun), mu = cosine(geometry.observer);
  if (!Number.isFinite(mu0) || !Number.isFinite(mu) ||
      mu0 < Math.cos(COLOR_PHOTOMETRY.maximumIncidenceDegrees * radians) ||
      mu < Math.cos(COLOR_PHOTOMETRY.maximumEmissionDegrees * radians)) return null;
  // ISIS Lunar-Lambert: weight 0 is Lambert, weight 1 is Lommel-Seeliger.
  const disk = (incidence, emission) => (1 - weight) * incidence + 2 * weight * incidence / (incidence + emission);
  return disk(Math.cos(COLOR_PHOTOMETRY.referenceIncidenceDegrees * radians),
    Math.cos(COLOR_PHOTOMETRY.referenceEmissionDegrees * radians)) / disk(mu0, mu);
}
