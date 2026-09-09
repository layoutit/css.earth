import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const xyz = ([lat, lon, radius]) => {
  if (![lat,lon,radius].every(Number.isFinite) || Math.abs(lat) > 90 || radius <= 0) throw new Error('Invalid SBMT spherical coordinates.');
  lat *= Math.PI / 180; lon *= Math.PI / 180; radius *= 1000;
  return [radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat)];
};
const attrs = text => Object.fromEntries([...text.matchAll(/([\w]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));

export function decodeSbmtPaths(text, expectedShapeModel) {
  const header = /<lines\s+([^>]+)>/.exec(text);
  if (!expectedShapeModel || attrs(header?.[1] ?? '').shapemodel !== expectedShapeModel || !text.includes('</lines>')) throw new Error('SBMT path model changed.');
  return [...text.matchAll(/<path\s+([^>]+)\/>/g)].map(m => {
    const a = attrs(m[1]), v = a.vertices.trim().split(/\s+/).map(Number);
    if (v.length < 6 || v.length % 3 || !v.every(Number.isFinite)) throw new Error('Invalid SBMT path coordinates.');
    return {name: a.name, color: a.color, points: Array.from({length: v.length / 3}, (_, i) => xyz(v.slice(i * 3, i * 3 + 3)))};
  });
}

export function decodeSbmtLocations(text) {
  return text.trim().split(/\r?\n/).map(line => {
    const f = line.split('\t'), point = f.slice(2, 5).map(n => Number(n) * 1000);
    if (f.length !== 18 || !point.every(Number.isFinite)) throw new Error('Invalid SBMT ellipse location.');
    const position = xyz(f.slice(5, 8).map(Number));
    if (Math.hypot(...point.map((n, i) => n - position[i])) > .001) throw new Error('SBMT Cartesian and spherical coordinates disagree.');
    return {name: f[1], color: f[15], point};
  });
}

/** Symbols are prepared on the released 3D surface. A fixed cartographic width
 * is explicit; it is never presented as a fracture width or a boulder diameter.
 * Project each short segment independently and withhold failed correspondence. */
export async function loadSbmtSymbols(root, profile, mesh) {
  const paths = decodeSbmtPaths(await readFile(resolve(root, profile.paths), 'utf8'), profile.shapeModel);
  const locations = decodeSbmtLocations(await readFile(resolve(root, profile.locations), 'utf8'));
  if (paths.length !== profile.expectedPaths || locations.length !== profile.expectedLocations) throw new Error('SBMT inventory changed.');
  const segments = [], report = {paths: paths.length, locations: locations.length, acceptedLocations: 0, rejectedLocations: 0,
    acceptedSegments: 0, rejectedSegments: 0, maximumRegistrationDistanceMeters: 0,
    lineWidthMeters: profile.lineWidthMeters, locationDiameterMeters: profile.locationDiameterMeters, features: []};
  const project = p => {
    const hit = mesh.closestPoint(p, profile.maximumRegistrationDistanceMeters);
    if (hit) report.maximumRegistrationDistanceMeters = Math.max(report.maximumRegistrationDistanceMeters, hit.distanceMeters);
    return hit?.point;
  };
  function category(color) {
    const value = profile.colorCategories[color];
    if (!Number.isSafeInteger(value)) throw new Error('Unmapped SBMT symbol color: ' + color);
    return value;
  }
  for (const path of paths) {
    const id = report.features.length + 1, value = category(path.color);
    report.features.push({id, name: path.name, category: value, kind: 'path'});
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], length = Math.hypot(...b.map((n, j) => n - a[j]));
      const steps = Math.max(1, Math.ceil(length / profile.maximumSegmentMeters));
      let previous = project(a);
      for (let step = 1; step <= steps; step++) {
        const next = project(a.map((n, j) => n + (b[j] - n) * step / steps));
        if (previous && next && Math.hypot(...next.map((n, j) => n - previous[j])) <= profile.maximumSegmentMeters * 2) {
          segments.push({a: previous, b: next, radius: profile.lineWidthMeters / 2, category: value, id}); report.acceptedSegments++;
        } else report.rejectedSegments++;
        previous = next;
      }
    }
  }
  for (const location of locations) {
    const id = report.features.length + 1, value = category(location.color), point = project(location.point);
    report.features.push({id, name: location.name, category: value, kind: 'location'});
    if (point) {segments.push({a: point, b: point, radius: profile.locationDiameterMeters / 2, category: value, id}); report.acceptedLocations++;}
    else report.rejectedLocations++;
  }
  const cellSize = Math.max(profile.lineWidthMeters, profile.locationDiameterMeters, profile.maximumSegmentMeters * 2), cells = new Map();
  for (const segment of segments) {
    segment.delta = segment.b.map((n, i) => n - segment.a[i]); segment.squared = segment.delta.reduce((s, n) => s + n * n, 0);
    const low = segment.a.map((n, i) => Math.floor((Math.min(n, segment.b[i]) - segment.radius) / cellSize));
    const high = segment.a.map((n, i) => Math.floor((Math.max(n, segment.b[i]) + segment.radius) / cellSize));
    for (let x = low[0]; x <= high[0]; x++) for (let y = low[1]; y <= high[1]; y++) for (let z = low[2]; z <= high[2]; z++) {
      const key = `${x},${y},${z}`;
      if (!cells.has(key)) cells.set(key, []); cells.get(key).push(segment);
    }
  }
  return {report, sample(point) {
    const candidates = cells.get(point.map(n => Math.floor(n / cellSize)).join(',')) ?? [];
    let selected, best = Infinity;
    for (const s of candidates) {
      const t = s.squared ? Math.max(0, Math.min(1, point.reduce((sum, n, i) => sum + (n - s.a[i]) * s.delta[i], 0) / s.squared)) : 0;
      const distance = Math.hypot(...point.map((n, i) => n - s.a[i] - t * s.delta[i]));
      const score = distance / s.radius;
      if (score <= 1 && (score < best || score === best && s.id < selected.id)) {selected = s; best = score;}
    }
    return selected;
  }};
}
