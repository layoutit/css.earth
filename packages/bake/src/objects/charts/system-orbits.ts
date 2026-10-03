/** A star's planets drawn from above, to scale: each orbit is the one the app flies, its hosted-orbit record in @cssearth/astronomy
 * (semi-major axis in stellar radii times the star's radius, eccentricity and argument of periapsis), sampled in its own plane. The
 * plane is turned so the direction to Earth points down: a transiting planet crosses its star at the bottom of its orbit, where
 * the record's transit convention puts it (true anomaly pi/2 - omega). Inclination and the node set how the orbit is tilted on the
 * sky, which a top-down view does not show. The star is a marker, not to scale. */
import { bodyData, HOSTED_PLANET_IDS, hostedOrbit, hostedOrbitCentreId, type BodyId, type HostedPlanetId } from '@cssearth/astronomy';
import { CHART, chartDocument, chartNotes, coordinate, escapeXml } from './chart-style.ts';

/** The IAU 2012 astronomical unit, km (Resolution B2). */
const AU_KM = 149597870.7;

import { parseSystemOrbits, type SystemOrbitsRecipe } from '@cssearth/objects';
export { parseSystemOrbits, type SystemOrbitsRecipe } from '@cssearth/objects';
/** Each planet of the system as a closed path in au, in its orbital plane with Earth toward +y, innermost first. */
export function readSystemOrbits(recipe: SystemOrbitsRecipe, samples = 180) {
  const planets = HOSTED_PLANET_IDS.filter(id => hostedOrbitCentreId(id) === recipe.system);
  if (!planets.includes(recipe.highlight as HostedPlanetId)) throw new TypeError(`${recipe.id}: ${recipe.highlight} is not a hosted planet of ${recipe.system}; its planets are ${planets.join(', ') || 'none'}.`);
  const starRadiusKm = bodyData(recipe.system as BodyId).meanRadiusKm;
  if (!(starRadiusKm > 0)) throw new TypeError(`${recipe.id}: ${recipe.system} has no radius to scale its orbits by.`);
  return planets.map(id => {
    const orbit = hostedOrbit(id), e = orbit.eccentricity, omega = (orbit.argumentOfPeriapsisDegrees ?? 90) * Math.PI / 180;
    const a = orbit.semiMajorAxisStellarRadii * starRadiusKm / AU_KM;
    // Angle theta = f + omega from the line of nodes; the transit (f = pi/2 - omega) falls at theta = pi/2, toward Earth.
    const points = Array.from({ length: samples + 1 }, (_, i) => { const f = 2 * Math.PI * i / samples, r = a * (1 - e * e) / (1 + e * Math.cos(f)); return { x: r * Math.cos(f + omega), y: r * Math.sin(f + omega) }; });
    return { id, name: bodyData(id as BodyId).name, a, e, periodDays: orbit.periodDays, points, highlight: id === recipe.highlight };
  }).sort((p, q) => p.a - q.a);
}

/** A round scale-bar length under `limit` au: 1, 2 or 5 times a power of ten. */
function scaleBar(limit: number) {
  const power = 10 ** Math.floor(Math.log10(limit));
  return [5, 2, 1].map(step => step * power).find(value => value <= limit)!;
}

export function renderSystemOrbits(recipe: SystemOrbitsRecipe, orbits: ReturnType<typeof readSystemOrbits>) {
  const extent = Math.max(...orbits.flatMap(orbit => orbit.points.map(p => Math.max(Math.abs(p.x), Math.abs(p.y)))));
  const size = CHART.bottom - CHART.top, cx = (CHART.left + CHART.right) / 2, cy = (CHART.top + CHART.bottom) / 2, scale = size / 2 / extent;
  const n = coordinate, path = (points: readonly { x: number; y: number }[]) => points.map((p, i) => `${i ? 'L' : 'M'}${n(cx + p.x * scale)} ${n(cy + p.y * scale)}`).join(' ') + 'Z';
  const lines = orbits.map(orbit => `<path class="orbit" data-planet="${orbit.id}" d="${path(orbit.points)}" fill="none" stroke="${orbit.highlight ? CHART.amber : CHART.neutral}" stroke-opacity="${orbit.highlight ? 1 : .45}" stroke-width="${orbit.highlight ? 1.6 : 1}"/>`).join('');
  // Each name sits at its orbit's point farthest from Earth, the top, so labels stay clear of the transit side.
  const labels = orbits.map(orbit => { const top = orbit.points.reduce((best, p) => p.y < best.y ? p : best);
    return `<text x="${n(cx + top.x * scale)}" y="${n(cy + top.y * scale - 3)}" text-anchor="middle" fill="${orbit.highlight ? CHART.amber : CHART.label}">${escapeXml(orbit.name.split(' ').at(-1)!)}</text>`; }).join('');
  const bar = scaleBar(extent), barPx = bar * scale;
  const furniture = `<circle cx="${n(cx)}" cy="${n(cy)}" r="3" fill="${CHART.amber}"/>
<text x="0" y="13">From above, to scale</text><text x="294" y="13" text-anchor="end">Earth ↓</text>
<path d="M${n(CHART.left)} 222H${n(CHART.left + barPx)}" stroke="${CHART.label}"/><text x="${n(CHART.left + barPx + 6)}" y="226">${Number(bar.toPrecision(2))} au</text>`;
  const notes = [`The ${orbits.length} planet${orbits.length === 1 ? '' : 's'} in this map; star not to scale.`, 'A transiting planet crosses at the bottom.'];
  return chartDocument({ ...recipe, metadata: { ...recipe.metadata, planets: orbits.map(orbit => ({ id: orbit.id, semiMajorAxisAu: Number(orbit.a.toPrecision(4)), eccentricity: orbit.e, periodDays: orbit.periodDays })) } },
    furniture + lines + labels + chartNotes(notes, 252), { className: 'object-system-orbits-chart', height: 280 });
}
