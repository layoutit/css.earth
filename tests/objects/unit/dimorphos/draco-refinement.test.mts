import assert from 'node:assert/strict';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('dimorphos');
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodePds4GeometryCube } from '../../../../tools/objects/terrestrial-layers/pds4-geometry-cube.mts';
import { decodeSpiceCameraFrame } from '../../../../tools/objects/terrestrial-layers/spice-camera.mts';
import { refineCameraByLimb, rotateCamera } from '../../../../tools/objects/terrestrial-layers/limb-refinement.mts';
import { project } from '../../../../tools/objects/terrestrial-layers/osiris-geo.mts';
import { loadObjShape } from '../../../../tools/objects/terrestrial-layers/obj-shape.mts';
import { requireTerrainMesh } from '../../../../tools/objects/terrestrial-layers/radial-terrain.mts';
import { loadKernelSet } from '../../../../tools/spice/kernel-set.mts';
import { parseSpiceCamera } from '../../../../tools/objects/terrestrial-layers/source-records.mts';

/**
 * The archived DRACO intercepts give per-pixel truth for the camera, so the
 * limb refinement can be measured: the kernel camera starts 0.5 px from the
 * archive; perturbed by tens and hundreds of pixels it must come back to the
 * archive within a pixel using nothing but the image and the retained OBJ.
 */
const root = resolve(import.meta.dirname, '../../../../src/objects/dimorphos/source');
const config = JSON.parse((await readFile(resolve(root, 'preparation/terrestrial.json'))).toString('utf8'));
const mosaic = config.raster.surfaceObservations.find((recipe: { id: string }) => recipe.id === 'draco');
const cubeRecipe = { ...mosaic, ...mosaic.frames.find((frame: { id: string }) => frame.id === 't-minus-11s') };
const kernels = ['lsk/naif0012.tls', 'pck/pck00010.tpc', 'pck/didymos_system_15.tpc', 'fk/dart_009.tf', 'fk/didymos_system_007.tf', 'ik/dart_draco_003.ti', 'sclk/dart_sclk_0204.tsc',
  'spk/de430.bsp', 'spk/didymos_barycenter_s205_v01.bsp', 'spk/didymos_system_s542_v01.bsp', 'spk/dart_struct_v04.bsp', 'spk/dart_2022_231_2022_269_rec_v03.bsp',
  'spk/dart_2022_269_2022_269_rec_v03.bsp', 'spk/dart_2022_269_2022_269_spc_v04.bsp', 'ck/dart_2022_269_2022_269_spc_v04.bc'].map(path => `spice/${path}`);
const spice = { kernels, observer: -135, target: 120065803, bodyFrame: 'DIMORPHOS_FIXED', instrument: -135102, clock: { header: 'ACQTMSOC', spacecraft: -135 }, aberration: 'LT+S',
  pixels: { focalLength: { key: 'FOCAL_LENGTH', unit: 'mm' }, pixelPitch: { key: 'PIXEL_SIZE', unit: 'micrometre' }, center: 'DETECTOR_CENTER', boresight: 'BORESIGHT',
    samples: 'PIXEL_SAMPLES', lines: 'PIXEL_LINES', frame: 'FOV_FRAME', origin: 0, column: '-X', row: '-Y' },
  image: { quantity: 'I/F', plane: 1, missingValueKeys: ['MISPXVAL', 'PXOUTWIN'], saturationKey: 'SATPXVAL' } };
// The 0.972 m OBJ limb is about three pixels coarse and boulders roughen the real one: a 2.5 px budget on the limb itself.
const refinement = { method: 'mesh-limb', maximumCorrectionDegrees: 0.2, maximumResidualPixels: 2.5, minimumControls: 48, searchPixels: 400, maximumControls: 1500 };
const name = 'dart_0401930040_12262_01_geo.fits', bytes = await readFile(resolve(root, cubeRecipe.path));
const cube = decodePds4GeometryCube(bytes, await readFile(resolve(root, cubeRecipe.labelPath), 'utf8'), { fileName: name, cube: cubeRecipe.cube, filter: cubeRecipe.filter });
const set = await loadKernelSet(kernels.map(path => resolve(root, path)));
const frame = decodeSpiceCameraFrame(bytes, set, parseSpiceCamera(spice), cubeRecipe.filter);
const mesh = requireTerrainMesh(await loadObjShape(resolve(root, config.geometry.radialTerrain.path), config.geometry.radialTerrain.grid));

/** RMS and mean offset of the archived intercepts projected through `matrix`, every 13th on-body pixel. */
function archiveResidual(matrix: number[][]) {
  let count = 0, sx = 0, sy = 0, squared = 0;
  for (let i = 0; i < cube.width * cube.height; i += 13) if (cube.valid(i)) {
    const [x, y] = project(matrix, cube.xyz(i)), dx = x - i % cube.width, dy = y - Math.floor(i / cube.width);
    sx += dx; sy += dy; squared += dx * dx + dy * dy; count++;
  }
  return { count, rms: Math.sqrt(squared / count), offset: Math.hypot(sx / count, sy / count) };
}

test('refining the kernel camera against the OBJ limb keeps it within the archive residual', t => {
  const before = archiveResidual(frame.camera.matrix);
  const { camera, report } = refineCameraByLimb(frame, mesh, refinement);
  const after = archiveResidual(camera.matrix);
  assert.ok(before.rms < 0.6, `kernel camera ${before.rms.toFixed(3)} px from the archive`);
  assert.ok(after.rms < 1, `refined camera ${after.rms.toFixed(3)} px from the archive`);
  assert.ok(report.correction.boresightShiftPixels < 1.5, `refinement moved the boresight ${report.correction.boresightShiftPixels.toFixed(3)} px`);
  assert.ok(report.holdoutMatchedFraction > 0.9, `${report.holdoutMatchedFraction} of the holdout edges match the refined limb`);
  assert.ok(report.residuals.after.holdout.rmsPixels <= refinement.maximumResidualPixels);
  assert.ok(report.edgePoints.fit >= refinement.minimumControls && report.edgePoints.holdout >= refinement.minimumControls);
  t.diagnostic(`archive residual ${before.rms.toFixed(3)} px -> ${after.rms.toFixed(3)} px (offset ${before.offset.toFixed(3)} -> ${after.offset.toFixed(3)} px); limb holdout ${report.residuals.before.holdout.rmsPixels.toFixed(3)} -> ${report.residuals.after.holdout.rmsPixels.toFixed(3)} px on ${report.residuals.after.holdout.count} points; ${report.edgePoints.found} edges, ${report.edgePoints.unlitOrUnmatched} unlit or unmatched; boresight shift ${report.correction.boresightShiftPixels.toFixed(3)} px; threshold ${report.threshold.toExponential(3)}`);
});

test('a camera pushed 30 and 150 pixels off the archive comes back within a pixel from the limb alone', t => {
  const microradiansPerPixel = 4.946e-6;
  for (const [pixels, roll] of [[30, 0], [150, 0.003]] as const) {
    // A rotation about an axis across the line of sight moves the image by `pixels`; `roll` turns it about the boresight.
    const boresight = frame.camera.positionKm.map(v => -v), n = Math.hypot(...boresight), b = boresight.map(v => v / n);
    const across = [b[1], -b[0], 0], m = Math.hypot(...across), axis = across.map(v => v / m * pixels * microradiansPerPixel);
    const perturbed = rotateCamera(frame.camera, [axis[0] + b[0] * roll, axis[1] + b[1] * roll, axis[2] + b[2] * roll]);
    const displaced = archiveResidual(perturbed.matrix);
    assert.ok(displaced.rms > pixels * 0.8, `perturbation displaced the archive by ${displaced.rms.toFixed(1)} px`);
    const { camera, report } = refineCameraByLimb({ ...frame, camera: perturbed }, mesh, refinement);
    const recovered = archiveResidual(camera.matrix);
    assert.ok(recovered.rms < 1, `${pixels} px perturbation recovered to ${recovered.rms.toFixed(3)} px`);
    t.diagnostic(`${pixels} px${roll ? ` and ${(roll * 180 / Math.PI).toFixed(2)}° roll` : ''}: archive residual ${displaced.rms.toFixed(1)} px -> ${recovered.rms.toFixed(3)} px; limb holdout ${report.residuals.after.holdout.rmsPixels.toFixed(3)} px; correction ${report.correction.degrees.toFixed(4)}°`);
  }
});
