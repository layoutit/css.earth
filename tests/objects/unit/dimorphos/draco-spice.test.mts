import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodePds4GeometryCube } from '../../../../tools/objects/terrestrial-layers/pds4-geometry-cube.mts';
import { loadSurfaceObservation, validateSurfaceObservation } from '../../../../tools/objects/surface-observations/index.mts';
import { fitBackplaneCamera } from '../../../../tools/objects/surface-observations/cameras.mts';
import { fixtureRecord } from '../../../../tools/contract/test-values.mts';
import { decodeSpiceCameraFrame } from '../../../../tools/objects/terrestrial-layers/spice-camera.mts';
import { project } from '../../../../tools/objects/terrestrial-layers/osiris-geo.mts';
import { parseRadialLoaderConfig } from '../../../../tools/objects/terrestrial-layers/radial-source.mts';
import { loadRadialTerrain, requireTerrainMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { loadKernelSet } from '../../../../tools/spice/kernel-set.mts';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { parseSpiceCamera } from '../../../../tools/objects/terrestrial-layers/source-records.mts';

/**
 * The DRACO cube carries the archive's own SPICE intercepts for every pixel.
 * Deriving the camera from the mission kernels instead and projecting those
 * intercepts back into the image proves the kernel subset end to end: DAF,
 * SPK types 1, 2, 5, 8 and 13, CK type 3, the frame kernel chain through a
 * switch frame and a fixed-offset quaternion, the parameterized Dimorphos
 * frame, SCLK and leap seconds, light time and stellar aberration.
 */
const root = resolve(import.meta.dirname, '../../../../src/objects/dimorphos/source');
const config = JSON.parse((await readFile(resolve(root, 'preparation/terrestrial.json'))).toString('utf8'));
const mosaic = config.raster.surfaceObservations.find((recipe: { id: string }) => recipe.id === 'draco');
const cubeRecipe = { ...mosaic, ...mosaic.frames.find((frame: { id: string }) => frame.id === 't-minus-11s') };
const name = 'dart_0401930040_12262_01_geo.fits';
const kernels = ['lsk/naif0012.tls', 'pck/pck00010.tpc', 'pck/didymos_system_15.tpc', 'fk/dart_009.tf', 'fk/didymos_system_007.tf', 'ik/dart_draco_003.ti', 'sclk/dart_sclk_0204.tsc',
  'spk/de430.bsp', 'spk/didymos_barycenter_s205_v01.bsp', 'spk/didymos_system_s542_v01.bsp', 'spk/dart_struct_v04.bsp', 'spk/dart_2022_231_2022_269_rec_v03.bsp',
  'spk/dart_2022_269_2022_269_rec_v03.bsp', 'spk/dart_2022_269_2022_269_spc_v04.bsp', 'ck/dart_2022_269_2022_269_spc_v04.bc'].map(path => `spice/${path}`);
/** The same frame through the kernel route: the cube's I/F plane is the image; nothing else of the cube is read. */
const recipe = {
  id: 'draco-spice', format: 'spice-camera', consumer: 'draco-spice', filter: cubeRecipe.filter, frames: [{ id: 'draco-spice', path: cubeRecipe.path, startTime: cubeRecipe.startTime }],
  metadata: { label: 'DRACO image (SPICE camera)', coverage: cubeRecipe.metadata.coverage },
  spice: { kernels, observer: -135, target: 120065803, bodyFrame: 'DIMORPHOS_FIXED', instrument: -135102, clock: { header: 'ACQTMSOC', spacecraft: -135 }, aberration: 'LT+S',
    pixels: { focalLength: { key: 'FOCAL_LENGTH', unit: 'mm' }, pixelPitch: { key: 'PIXEL_SIZE', unit: 'micrometre' }, center: 'DETECTOR_CENTER', boresight: 'BORESIGHT',
      samples: 'PIXEL_SAMPLES', lines: 'PIXEL_LINES', frame: 'FOV_FRAME', origin: 0, column: '-X', row: '-Y' },
    image: { quantity: 'I/F', plane: 1, header: { MISSION: 'DART', INSTRUME: 'DRACO', SRCFILE: 'dart_0401930040_12262_01.fits', SCLKNAME: 'dart_sclk_0204.tsc' }, missingValueKeys: ['MISPXVAL', 'PXOUTWIN'], saturationKey: 'SATPXVAL' } },
  transfer: cubeRecipe.transfer, photometry: cubeRecipe.photometry, display: cubeRecipe.display,
};
const bytes = await readFile(resolve(root, cubeRecipe.path));
const cube = decodePds4GeometryCube(bytes, await readFile(resolve(root, cubeRecipe.labelPath), 'utf8'), { fileName: name, cube: cubeRecipe.cube, filter: cubeRecipe.filter });
const set = await loadKernelSet(kernels.map(path => resolve(root, path)));
const frame = decodeSpiceCameraFrame(bytes, set, parseSpiceCamera(recipe.spice), recipe.filter);
const camera = frame.camera, report = frame.qualityReport;

test('the spacecraft clock, leap seconds and kernel chain reproduce the archived exposure epoch and range', t => {
  validateSurfaceObservation(recipe, config.geometry.radialTerrain);
  assert.equal(report.exposure.clock, '0401930040:07327');
  assert.ok(Math.abs(report.exposure.et - Number(cube.header.ACQTM_ET)) < 1e-6, `ET ${report.exposure.et} vs header ${cube.header.ACQTM_ET}`);
  assert.equal(frame.startTime, cubeRecipe.startTime);
  assert.equal(frame.startTime, `${String(cube.header.ACQ_UTC).trim()}Z`);
  assert.equal(report.camera.instrumentFrame, 'DART_DRACO');
  assert.ok(Math.abs(report.camera.focalLengthPixels - 2628.3343 / 0.013) < 1e-6);
  assert.deepEqual(report.camera.center, [511.5, 511.5]);
  // The header range comes from the spc_v03 solution the archive cites; the archived v04 kernels place the camera 13 m further out.
  assert.ok(Math.abs(report.camera.rangeKm - Number(cube.header.PSCRNG)) < 0.05, `range ${report.camera.rangeKm} km vs header ${cube.header.PSCRNG}`);
  assert.equal(report.camera.aberration, 'LT+S');
  // Stellar aberration is the observer's barycentric velocity across the line of sight over c.
  const velocity = set.ephemeris.state(-135, 0, report.exposure.et).velocity, target = set.ephemeris.state(120065803, -135, report.exposure.et).position, range = Math.hypot(...target);
  const across = Math.hypot(velocity[1] * target[2] - velocity[2] * target[1], velocity[2] * target[0] - velocity[0] * target[2], velocity[0] * target[1] - velocity[1] * target[0]) / range;
  assert.ok(Math.abs(report.camera.aberrationMicroradians - Math.asin(across / 299792.458) * 1e6) < 0.01, `${report.camera.aberrationMicroradians} µrad of stellar aberration`);
  t.diagnostic(`ET ${report.exposure.et} (header ${cube.header.ACQTM_ET}); range ${report.camera.rangeKm.toFixed(4)} km (header ${cube.header.PSCRNG}); light time ${(report.camera.lightTimeSeconds * 1e3).toFixed(3)} ms; aberration ${report.camera.aberrationMicroradians.toFixed(2)} µrad`);
  assert.equal(report.kernels.length, 15);
  assert.equal(report.saturatedPixels, 0);
});

test('the kernel-derived camera projects every archived intercept back to its pixel within a pixel', t => {
  let count = 0, sumX = 0, sumY = 0, squared = 0;
  const residuals: number[][] = [];
  for (let i = 0; i < cube.width * cube.height; i += 7) if (cube.valid(i)) {
    const [x, y, depth] = project(camera.matrix, cube.xyz(i)), dx = x - i % cube.width, dy = y - Math.floor(i / cube.width);
    assert.ok(depth > 0);
    residuals.push([dx, dy]); sumX += dx; sumY += dy; squared += dx * dx + dy * dy; count++;
  }
  const rms = Math.sqrt(squared / count), meanX = sumX / count, meanY = sumY / count;
  const centred = Math.sqrt(residuals.reduce((s, [dx, dy]) => s + (dx - meanX) ** 2 + (dy - meanY) ** 2, 0) / count);
  assert.ok(count > 18000, `${count} archived intercepts`);
  // The archive used the spc_v03 pointing and s527 system ephemeris; the archived v04/s542 kernels move the frame by under half a pixel.
  assert.ok(rms < 1, `rms residual ${rms.toFixed(3)} px`);
  assert.ok(Math.hypot(meanX, meanY) < 0.75, `mean offset (${meanX.toFixed(3)}, ${meanY.toFixed(3)}) px`);
  assert.ok(centred < 0.05, `residual about the mean offset ${centred.toFixed(4)} px`);
  // The camera fitted to the archived intercepts and the kernel camera stand within 50 m of each other.
  const fitted = fitBackplaneCamera(cube);
  const separationMeters = Math.hypot(...camera.positionKm.map((v, k) => v - fitted.positionKm[k])) * 1000;
  assert.ok(separationMeters < 50, `camera positions differ by ${separationMeters.toFixed(1)} m`);
  t.diagnostic(`${count} intercepts: rms ${rms.toFixed(3)} px, mean offset (${meanX.toFixed(3)}, ${meanY.toFixed(3)}) px, ${centred.toFixed(4)} px about it; kernel camera ${separationMeters.toFixed(1)} m from the fitted camera`);
});

test('the kernel Sun direction agrees with JPL Horizons; the archived phase plane sits 0.87° above the kernel geometry', t => {
  // JPL Horizons, DART (-135) to the Sun (10), geometric ICRF vector in km at JD 2459849.46900369 TDB (the header ACQ_JDAT),
  // queried 2026-09-12 with EPHEM_TYPE=VECTORS, CENTER='@-135', REF_PLANE=FRAME, VEC_TABLE=2, OUT_UNITS=KM-S.
  const horizonsSun = [-1.556582689982448e8, -1.581378731881942e7, 2.558965618695050e6];
  const ourSun = set.ephemeris.state(10, -135, report.exposure.et).position;
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, k) => s + v * b[k], 0);
  const separation = Math.acos(Math.min(1, dot(ourSun, horizonsSun) / Math.hypot(...ourSun) / Math.hypot(...horizonsSun))) * 180 / Math.PI;
  assert.ok(separation < 1e-4, `Sun direction differs from Horizons by ${separation}°`);
  // Phase at the target centre from the Horizons Sun and the kernel target vector; ours applies LT+S from the body, 0.004° away.
  const target = set.ephemeris.state(120065803, -135, report.exposure.et).position;
  const horizonsPhase = Math.acos(dot(target.map(v => -v), horizonsSun.map((v, k) => v - target[k])) / Math.hypot(...target) / Math.hypot(...horizonsSun.map((v, k) => v - target[k]))) * 180 / Math.PI;
  assert.ok(Math.abs(report.camera.phaseAngleDegrees - horizonsPhase) < 0.02, `phase ${report.camera.phaseAngleDegrees}° vs Horizons ${horizonsPhase}°`);
  // The archive's phase plane disagrees with that geometry by a constant 0.866°; its incidence plane shows the same offset in the median.
  const differences: number[] = [];
  for (let i = 0; i < cube.width * cube.height; i += 97) if (cube.valid(i)) {
    const ray = cube.xyz(i).map((v, k) => v - camera.positionKm[k]), length = Math.hypot(...ray);
    differences.push(Math.acos(-dot(ray, camera.sunDirection) / length) * 180 / Math.PI - cube.planes.PHASE_ANGLE_IMAGE[i] * 180 / Math.PI);
  }
  differences.sort((a, b) => a - b);
  const median = differences[differences.length >> 1], spread = differences[differences.length - 1] - differences[0];
  assert.ok(differences.length > 1000);
  assert.ok(median > -0.9 && median < -0.84, `kernel phase minus archived phase: median ${median.toFixed(4)}°`);
  assert.ok(spread < 0.01, `the offset is constant across the frame to ${spread.toFixed(4)}°`);
  t.diagnostic(`Sun direction ${separation.toExponential(2)}° from Horizons; phase ${report.camera.phaseAngleDegrees.toFixed(4)}° (Horizons ${horizonsPhase.toFixed(4)}°); archived phase plane offset ${(-median).toFixed(4)}° ± ${(spread / 2).toFixed(4)}°`);
});

test('the seam derives per-pixel geometry on the retained OBJ from the kernel camera within the transfer bound', async t => {
  const source = await createSourceManifest({ planetId: 'dimorphos', planetName: 'Dimorphos', sourceRoot: root });
  // Preparation's own terrain: the retained OBJ as the source mesh, and the display faces whose samples set the display range.
  const radial = await loadRadialTerrain({ config: parseRadialLoaderConfig(config), sourceDirectory: root, source });
  if (!radial) throw new Error('Dimorphos has no radial terrain.');
  const grid = requireTerrainMesh(radial.grid);
  const observation = await loadSurfaceObservation({ sourceDirectory: root, source, recipe, radial: { grid, faces: radial.faces },
    config: { geometry: { radius: config.geometry.radius, radiusKm: config.geometry.radiusKm, radialTerrain: config.geometry.radialTerrain }, raster: config.raster } });
  const prepared = observation.report, geometry = fixtureRecord(prepared, 'frames', 0, 'geometry'), coverage = fixtureRecord(prepared, 'frames', 0, 'pixels');
  assert.ok(Number(geometry.geometryPixels) > 100000, JSON.stringify(geometry));
  assert.equal(fixtureRecord(prepared, 'display').units, 'relative disk-normalized I/F; linear grayscale display');
  // 128,423 modeled on-body pixels against 128,291 archived; the Lommel-Seeliger limits reject the terminator side.
  assert.ok(Math.abs(Number(coverage.geometryPixels) - cube.qualityReport.geometryPixels) < 0.005 * cube.qualityReport.geometryPixels, JSON.stringify(coverage));
  assert.ok(Number(coverage.acceptedPixels) > 70000, JSON.stringify(coverage));
  // Modeled intercepts on the 0.972 m OBJ against the archived 0.243 m DSK intercepts: a sampled surface point seen by both.
  let sampled = 0, maximum = 0, sum = 0;
  for (let i = 0; i < cube.width * cube.height; i += 211) if (cube.valid(i)) {
    const sample = observation.samplePoint(cube.xyz(i).map(v => v * 1000 / (config.geometry.radiusKm * 1000 / config.geometry.radius)));
    if (sample.reason !== undefined) continue;
    sampled++; maximum = Math.max(maximum, sample.separationMeters ?? 0); sum += sample.separationMeters ?? 0;
  }
  assert.ok(sampled > 300, `${sampled} sampled archived intercepts qualified`);
  assert.ok(maximum <= recipe.transfer.maximumSeparationMeters, `separation up to ${maximum.toFixed(3)} m`);
  assert.ok(sum / sampled < 0.5, `mean separation ${(sum / sampled).toFixed(3)} m`);
  t.diagnostic(`${JSON.stringify(coverage)}; ${sampled} archived intercepts sampled, separation mean ${(sum / sampled).toFixed(3)} m, maximum ${maximum.toFixed(3)} m`);
  // Incidence from OBJ facet normals with the kernel Sun sits below the archived incidence plane by the same offset as the phase plane;
  // the facet-scale spread is the 0.972 m OBJ against the 0.243 m DSK.
  const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, k) => s + v * b[k], 0), unit = (v: number[]) => { const n = Math.hypot(...v); return v.map(x => x / n); };
  const eye = camera.positionKm.map(v => v * 1000), offsets: number[] = [];
  for (let i = 0; i < cube.width * cube.height; i += 97) if (cube.valid(i)) {
    const point = cube.xyz(i).map(v => v * 1000), ray = unit(point.map((v, k) => v - eye[k])), hit = grid.intersect(eye, ray);
    if (!hit) continue;
    const [a, b, c] = grid.indices[hit.faceId].map(k => grid.positions[k]), u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]);
    const normal = unit([u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]);
    offsets.push(Math.acos(Math.max(-1, Math.min(1, dot(normal, camera.sunDirection)))) * 180 / Math.PI - cube.planes.INCIDENCE_ANGLE_IMAGE[i] * 180 / Math.PI);
  }
  offsets.sort((a, b) => a - b);
  const medianIncidence = offsets[offsets.length >> 1];
  assert.ok(offsets.length > 1000 && medianIncidence > -1.2 && medianIncidence < -0.4, `median incidence offset ${medianIncidence.toFixed(3)}° over ${offsets.length} pixels`);
  t.diagnostic(`incidence from OBJ normals minus archived: median ${medianIncidence.toFixed(3)}°, p10 ${offsets[Math.floor(offsets.length * 0.1)].toFixed(2)}°, p90 ${offsets[Math.floor(offsets.length * 0.9)].toFixed(2)}°`);
});
