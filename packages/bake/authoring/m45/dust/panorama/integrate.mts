import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { requireArray, requireFiniteNumber, requireRecord } from '@cssearth/core';
import type { PreparedCssVolume, PreparedVolumeLeaf, Vector3 } from '@cssearth/objects';
import { compileCssSky, SKY_BASES, skyRay, type BakedSky, type BakedSkyFace } from '@cssearth/bake/sky';
import type { Field } from '../field/density.mts';
import type { Transport } from '../physics/illumination.mts';
import type { Vec } from '../physics/types.mts';
import { foregroundSelection } from '../field/foreground.mts';

interface WideOptions { field: Field; transport: Transport; frame: PreparedCssVolume['frame']; out: string; pilot: boolean }
export interface FixedWideResult {
  count: number; texels: number; metadata: Record<string, unknown>; partPath: string; recordPath: string;
  quads: PreparedVolumeLeaf[]; resources: PreparedCssVolume['resources'];
}
interface RasterFace { basis: typeof SKY_BASES[number]; path: string; bytes: number; nonzero: number; peakAlpha: number; maximumRadiance: number }
const TEXELS = 256, DISPLAY_RADIUS_PC = 100000, MAX_STEP_PC = 1, NEAR_STEP_PC = .125;
const OBSERVER: Vec = [0, 0, -1.1585], MODE = 'fixed-panorama';
const save = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const srgb = (v: number) => v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055;

function interval(origin: Vec, direction: Vec, min: Vec, max: Vec): [number, number] | null {
  let low = 0, high = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(direction[a]!) < 1e-14) { if (origin[a]! < min[a]! || origin[a]! > max[a]!) return null; continue; }
    const x = (min[a]! - origin[a]!) / direction[a]!, y = (max[a]! - origin[a]!) / direction[a]!;
    low = Math.max(low, Math.min(x, y)); high = Math.min(high, Math.max(x, y));
  }
  return high > low && Number.isFinite(high) ? [low, high] : null;
}
function faceGeometry(basis: typeof SKY_BASES[number], image: RasterFace): BakedSkyFace {
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const;
  // The compiler uses these numeric vertices without rotating them. They are LOCAL bank coordinates;
  // the volume runtime transports the bank's quaternion once, unlike the global ICRF sky runtime.
  const vertices: Vector3[] = corners.map(([u, v]) => [0, 1, 2].map(a =>
    OBSERVER[a]! + DISPLAY_RADIUS_PC * (basis.forwardIcrf[a]! + u * basis.rightIcrf[a]! + v * basis.upIcrf[a]!)) as Vector3);
  return { ...basis, texturePath: image.path, widthPx: TEXELS, heightPx: TEXELS, bytes: image.bytes,
    vertices, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] };
}

/** Six immutable transparent cube faces; display depth is an explicit far-panorama approximation. */
export async function prepareWide({ field, transport, frame, out, pilot }: WideOptions): Promise<FixedWideResult> {
  const started = Date.now(), destination = resolve(out);
  if (!destination.startsWith(resolve('.local/pleiades-dust') + '/')) throw new Error('Pleiades wide output must remain local');
  await mkdir(join(destination, 'cirrus-native'), { recursive: true });
  if (!pilot) {
    const prior = requireRecord(JSON.parse(await readFile(join(dirname(destination), 'pilot', 'wide-native-record.json'), 'utf8')));
    if (prior.executionComplete !== true || prior.pilot !== true || prior.mode !== MODE || prior.texels !== TEXELS ||
        prior.displayRadiusPc !== DISPLAY_RADIUS_PC || prior.maximumStepPc !== MAX_STEP_PC || prior.nearStepPc !== NEAR_STEP_PC ||
        JSON.stringify(prior.panoramaObserverPc) !== JSON.stringify(OBSERVER)) throw new Error('Matching positive R2 fixed-panorama pilot required');
  }
  const old = requireRecord(JSON.parse(await readFile('src/objects/milky-way-pleiades-dust/source/parameters.json', 'utf8'))), display = requireRecord(old.display);
  const exposure = requireFiniteNumber(display.exposure), inputGains = requireArray(display.gains).map(value => requireFiniteNumber(value));
  if (inputGains.length !== 3 || !(exposure > 0) || inputGains.some(v => !(v > 0))) throw new Error('Positive inherited display required');
  const gains: Vec = [inputGains[0]!, inputGains[1]!, inputGains[2]!];
  const selection = foregroundSelection(field), galactic = transport.source([0, 0, -1], selection.earthEye, 'galactic');
  const source = new Float64Array(3), total = new Float64Array(3), rasters: RasterFace[] = [], faceRecords: Record<string, unknown>[] = [];
  const plan = SKY_BASES;
  for (const basis of plan) {
    const rgba = new Uint8Array(TEXELS * TEXELS * 4), radiance = new Float32Array(TEXELS * TEXELS * 3);
    let nonzero = 0, peakAlpha = 0, maximumRadiance = 0, integrationSamples = 0;
    for (let y = 0; y < TEXELS; y++) for (let x = 0; x < TEXELS; x++) {
      const direction = skyRay(basis, 2 * (x + .5) / TEXELS - 1, 1 - 2 * (y + .5) / TEXELS);
      const segment = interval(OBSERVER, direction, field.bounds.min, field.bounds.max);
      total.fill(0);
      if (segment) {
        // Resolve the retained near-background component without moving it into the foreground.
        // Outside this same physical fine domain the Edenhofer map has native ~1pc sampling.
        const fine = interval(OBSERVER, direction, [-12, -12, -16], [12, 12, 12]);
        const cuts = [segment[0], segment[1], ...(fine ? fine.filter(t => t > segment[0] && t < segment[1]) : [])].sort((a, b) => a - b);
        for (let k = 1; k < cuts.length; k++) {
          const low = cuts[k - 1]!, high = cuts[k]!, middle = (low + high) / 2;
          const maxStep = fine && middle >= fine[0] && middle <= fine[1] ? NEAR_STEP_PC : MAX_STEP_PC;
          const steps = Math.ceil((high - low) / maxStep), ds = (high - low) / steps;
          for (let j = 0; j < steps; j++) {
            const distance = low + (j + .5) * ds, at: Vec = [OBSERVER[0] + direction[0] * distance, OBSERVER[1] + direction[1] * distance, OBSERVER[2] + direction[2] * distance];
            const rho = selection.remaining(...at);
            if (!(rho >= 0 && Number.isFinite(rho))) throw new Error('Nonphysical remaining dust density');
            integrationSamples++;
            if (rho === 0) continue;
            galactic.at(...at, source);
            for (let c = 0; c < 3; c++) total[c]! += rho * source[c]! * ds;
          }
        }
      }
      const pixel = y * TEXELS + x, offset = pixel * 4;
      if (total.some(value => !(value >= 0 && Number.isFinite(value)))) throw new Error('Nonphysical Galactic radiance');
      radiance.set(total, pixel * 3); maximumRadiance = Math.max(maximumRadiance, ...total);
      const peak = Math.max(...total.map((value, c) => value * gains[c]!)), alpha = -Math.expm1(-exposure * peak);
      rgba[offset + 3] = Math.round(255 * alpha); peakAlpha = Math.max(peakAlpha, rgba[offset + 3]!);
      if (rgba[offset + 3]) { nonzero++; for (let c = 0; c < 3; c++) rgba[offset + c] = Math.round(255 * srgb(peak ? Math.min(1, total[c]! * gains[c]! / peak) : 0)); }
    }
    const path = `cirrus-native/${basis.id}.webp`, png = `cirrus-native/${basis.id}.png`, buffer = await sharp(rgba, { raw: { width: TEXELS, height: TEXELS, channels: 4 } }).webp({ lossless: true }).toBuffer();
    await writeFile(join(destination, path), buffer);
    await sharp(rgba, { raw: { width: TEXELS, height: TEXELS, channels: 4 } }).png().toFile(join(destination, png));
    await writeFile(join(destination, `cirrus-native/${basis.id}.f32`), Buffer.from(radiance.buffer));
    rasters.push({ basis, path, bytes: buffer.length, nonzero, peakAlpha: peakAlpha / 255, maximumRadiance });
    faceRecords.push({ id: basis.id, path, bytes: buffer.length, nonzero, peakAlpha: peakAlpha / 255, maximumRadiance, integrationSamples,
      forwardLocal: basis.forwardIcrf, rightLocal: basis.rightIcrf, upLocal: basis.upIcrf });
    console.log('PLEIADES_FIXED_WIDE_FACE_COMPLETE', JSON.stringify({ id: basis.id, nonzero, bytes: buffer.length, integrationSamples, seconds: (Date.now() - started) / 1000 }));
    await new Promise<void>(done => setImmediate(done));
  }
  if (!rasters.some(face => face.nonzero)) throw new Error('No Galactic cirrus survived inherited display precision');
  // The existing sky compiler validates six face bases. The pilot reuses its real +z texture solely
  // while compiling the other five unused geometries, then emits only the actually integrated face.
  const first = rasters[0]!;
  const baked: BakedSky = { faces: SKY_BASES.map(basis => faceGeometry(basis, rasters.find(face => face.basis.id === basis.id) ?? first)),
    provenance: { generator: 'packages/bake/authoring/m45/dust/panorama/integrate.mts', localGeometry: true }, approximation: { displayRadiusPc: DISPLAY_RADIUS_PC } };
  const compiled = compileCssSky(baked, frame), actualIds = new Set(rasters.map(face => face.basis.id));
  const quads: PreparedVolumeLeaf[] = compiled.sky.faces.filter(face => actualIds.has(face.id)).map(face => ({
    id: `cirrus-native-${face.id}`, centerUnits: [OBSERVER[0] + DISPLAY_RADIUS_PC * face.forwardIcrf[0], OBSERVER[1] + DISPLAY_RADIUS_PC * face.forwardIcrf[1], OBSERVER[2] + DISPLAY_RADIUS_PC * face.forwardIcrf[2]],
    texturePath: face.texturePath, widthPx: face.widthPx, heightPx: face.heightPx,
    ...(face.boundsCssPixels ? { boundsCssPixels: face.boundsCssPixels } : {}), style: face.style,
  }));
  const resources: PreparedCssVolume['resources'] = rasters.map(face => ({ path: face.path, width: TEXELS, height: TEXELS, bytes: face.bytes }));
  const partPath = join(destination, 'wide-part.json'), recordPath = join(destination, 'wide-native-record.json');
  const metadata = { executionComplete: true, version: 'Pleiades-r2', mode: MODE, pilot, count: quads.length, texels: TEXELS,
    displayRadiusPc: DISPLAY_RADIUS_PC, panoramaObserverPc: OBSERVER, maximumStepPc: MAX_STEP_PC, nearStepPc: NEAR_STEP_PC,
    physicalIntegrationBoundsPc: field.bounds, earthIlluminationObserverPc: selection.earthEye, selection: selection.metadata,
    density: 'foregroundSelection.remaining; no moved material, renormalization, photo painting or density masks; full density remains in attenuation caches',
    illumination: 'Same fixed Earth Galactic-only incoming and outgoing attenuation source at every physical sample; no B-star illumination in the panorama',
    source: { field: field.metadata, transport: transport.metadata }, display: { exposure, gains, axisAlphaMultiplier: 1, fitted: false },
    binding: { type: 'six rigid transparent cube faces in existing volume fixedImages opt-in', stack: 'z only; x/y empty', fixedImages: true, residentStacks: true,
      unitScale: 50, intrinsicOpacity: 1, parentOpacityRequirement: 'Retain constant opacity through ancestors; no axis weighting, optical gains, distance fades or additional cirrus layers',
      coordinateFrame: 'LOCAL bank coordinates; the shared volume camera transports localToReferenceXyzw exactly once', geometryCompiler: 'Existing compileCssSky / compileVolumeLeaf, projective cube faces, no hand-authored runtime transforms' },
    nativePixels: rasters.length * TEXELS * TEXELS, faces: faceRecords, seconds: (Date.now() - started) / 1000,
    limitations: ['The finite100000pc cube is display geometry, not measured dust distance; all remaining ambient material, including near background, is approximated as far sky.',
      'The panorama is seen from one fixed cluster reference. Translation parallax over18pc is at most about0.0104degrees at a face center; the source geometry does not follow the camera.',
      'Reference Earth incoming/outgoing attenuation is intentionally frozen, including for rays opposite Earth; this is an fixed-reference fixed-light display, not angle-correct radiative transfer.',
      'The Edenhofer regional map is finite; rays stop at its actual box and do not invent dust beyond it.256px faces limit angular structure to roughly0.2–0.45degrees.',
      'Six-direction Galactic-field shielding and first-order scattering inherit the transport approximation.Optical images supply no geometry, radiance or spatial gain.',
      'Image radiance is encoded once with inherited Pleiades exposure/gains and normal source-over alpha; low signal below half an8bit alpha step is unrepresented.'] };
  await save(partPath, { quads, resources }); await save(recordPath, metadata);
  for (const path of [partPath, recordPath, ...rasters.map(face => join(destination, face.path))]) if (!(await readFile(path)).length) throw new Error('Missing fixed-panorama output');
  console.log('PLEIADES_FIXED_WIDE_COMPLETE', JSON.stringify({ mode: MODE, pilot, count: quads.length, texels: TEXELS, seconds: metadata.seconds }));
  return { count: quads.length, texels: TEXELS, metadata, partPath, recordPath, quads, resources };
}
