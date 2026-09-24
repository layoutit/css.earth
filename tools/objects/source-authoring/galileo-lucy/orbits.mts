// Prepare explicitly illustrative moon phases using published size/period constraints.
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { evaluatePublishedOrbit } from '../../../../packages/astronomy/tools/body-epoch-ephemeris.mts';
import { parsePublishedParameters } from '../../../../packages/astronomy/tools/lib/ephemeris-records.mts';
import { bodies, celestiaCommit, celestiaUrl } from './catalog.mts';
const epochJdTt = 2461286.5;
const write = async (path: string, value: unknown) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n'); };
const rad = Math.PI / 180;
const eclipticPoleToIcrf = (longitude: number, latitude: number) => {
  const v = [Math.cos(latitude * rad) * Math.cos(longitude * rad), Math.cos(latitude * rad) * Math.sin(longitude * rad), Math.sin(latitude * rad)];
  const epsilon = 84381.448 / 3600 * rad;
  const y = v[1] * Math.cos(epsilon) - v[2] * Math.sin(epsilon), z = v[1] * Math.sin(epsilon) + v[2] * Math.cos(epsilon);
  return { rightAscensionDegrees: (Math.atan2(y, v[0]) / rad + 360) % 360, declinationDegrees: Math.asin(z) / rad };
};
for (const body of bodies) {
  const s = `src/objects/${body.id}/source`;
  const pole = body.id === 'dactyl' ? { rightAscensionDegrees: 168.76, declinationDegrees: -87.1 } : eclipticPoleToIcrf(95.53, -87.05);
  await write(`${s}/preparation/rotation.json`, { schema: 'cssearth-display-orientation@1', ...pole,
    periodHours: body.periodHours, phase: 'arbitrary-display-phase', displayMeridianDegrees: 0,
    source: body.id === 'dactyl' ? 'Belton et al. (1996); candidate period from Celestia/Petit et al. (1997); parent pole from Ida package' : 'https://doi.org/10.3847/PSJ/ade23c',
    coordinateSystem: 'ICRF/J2000, right-handed Z-up model; illustrative zero meridian',
    qualification: body.id === 'dactyl' ? 'Retrograde parent-equatorial approximation to the approximately 172-degree encounter inclination; synchronous spin is assumed, not measured.' : body.id === 'selam' ? 'Assumed pole shared with Dinkinesh; synchronous spin approximation. No present rotational phase measurement.' : 'Published pole and period; authored mesh meridian is illustrative, not registered to the mission body frame.' });
  if (body.parent === 'sun') continue;
  const parameters = { schema: 'cssearth-published-mutual-orbit@1', id: body.id, centerBodyId: body.parent,
    placement: 'approximate', referenceFrame: body.id === 'dactyl' ? 'EQJ2000' : 'ECLIPJ2000', epochJd: epochJdTt,
    timeScale: 'TT', timeQualification: 'An illustrative zero mean anomaly is assigned at the shared TT scene epoch. This is not a propagation of a measured encounter phase or a prediction of present position.',
    semiMajorAxisKm: body.id === 'dactyl' ? 82.3 : 3.11, eccentricity: body.id === 'dactyl' ? .15 : 0,
    inclinationDegrees: body.id === 'dactyl' ? 177.1 : 177.05,
    ascendingNodeDegrees: body.id === 'dactyl' ? 258.76 : 185.53,
    argumentPeriapsisDegrees: 0, meanAnomalyDegrees: 0,
    meanMotionDegreesPerDay: 360 / (body.periodHours / 24), quadraticMeanAnomalyDegreesPerYear2: 0,
    citation: { title: body.id === 'dactyl' ? 'Celestia candidate orbit based on Belton (1996) and Petit (1997)' : 'A Contact Binary Satellite of the Asteroid (152830) Dinkinesh',
      url: body.id === 'dactyl' ? `${celestiaUrl}/data/asteroids.ssc` : body.sourceUrl,
      locator: body.id === 'dactyl' ? 'Dactyl EllipticalOrbit: a=82.3 km, e=0.15, P=0.96534 days only; SSC node, anomaly and argument are not imported.' : 'Levison et al. (2024): 3.11 ± 0.05 km, 52.67 ± 0.04 h; Jackson et al. (2025): primary ecliptic pole (95.53, −87.05) degrees.' },
    modelQualification: body.qualification,
    derivedAssumptions: body.id === 'dactyl' ? 'Plane taken opposite the existing Ida pole (RA 348.76, Dec 87.1 degrees). This neglects the roughly 8-degree mutual inclination and does not select a unique stable solution. Periapsis and phase are illustrative.' : 'Circular equatorial approximation using the primary pole: i=90−beta, ascending node=lambda+90. No node or phase fit is claimed.',
    gravityQualification: 'Effective GM=a^3(2pi/P)^2 ensures the display conic agrees with its chosen period. The zero moon GM is a massless display approximation, not a mass measurement.' };
  await write(`${s}/orbit/published-parameters.json`, parameters);
  const bytes = await readFile(`${s}/orbit/published-parameters.json`), state = evaluatePublishedOrbit(parsePublishedParameters(parameters), epochJdTt);
  const gm = parameters.semiMajorAxisKm ** 3 * (parameters.meanMotionDegreesPerDay * rad / 86400) ** 2;
  await write(`${s}/validation/epoch-state.json`, { schema: 'cssearth-published-body-epoch-ephemeris@1', id: body.id, centerBodyId: body.parent,
    epochJdTt, referenceFrame: 'ICRF', units: 'KM-D', correction: 'NONE', runtimeExtrapolation: false,
    ...state, gravitationalParametersKm3PerS2: { combined: gm, body: 0, parent: gm },
    source: { path: 'source/orbit/published-parameters.json', bytes: bytes.length, sha256: sha256(bytes) },
    limitations: [body.qualification, parameters.derivedAssumptions, parameters.gravityQualification],
    validation: { sourceEpochState: state, scope: 'Arithmetic consistency of the declared illustrative conic only; no independent 2026 phase or astrometric residual is available.' } });
  if (body.id === 'dactyl') {
    await mkdir(`${s}/reference`, { recursive: true });
    await copyFile('output/galileo-lucy/celestia/asteroids.ssc', `${s}/reference/asteroids.ssc`);
    await copyFile('tools/objects/source-authoring/galileo-lucy/source/GPL-2.0-or-later.txt', `${s}/reference/GPL-2.0-or-later.txt`);
    await write(`${s}/reference/celestia.json`, { repository: 'CelestiaProject/CelestiaContent', commit: celestiaCommit,
      license: 'GPL-2.0-or-later', use: 'Dactyl candidate semimajor axis, eccentricity and period; retain the catalog copyright header. Generic rough sphere, stock texture and SSC reference frame are excluded.' });
  }
}
