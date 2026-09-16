import { sha256 } from '../../../src/platform/sha256.mts';
import {transform} from 'esbuild';
import {shape,text,number} from '../terrestrial-layers/source-records.mts';
import {requireRecord} from '../../source-values.mts';
import {parseRadialLoaderConfig} from '../terrestrial-layers/radial-source.mts';
import {createSourceManifest} from '../../../src/platform/source-manifest.mts';
import {parsePinnedIntakeFile} from '../comet-1p/inspect-giotto.mts';
const parseTrial=shape({limitations:(value:unknown)=>value,frame:(value:unknown)=>Object.assign({},parsePinnedIntakeFile(value),shape({startTime:text,filter:text,credit:text,licenseSource:text})(value)),
  shape:shape({path:text,sha256:text}),transfer:shape({maximumSourceDistanceMeters:number,maximumSeparationMeters:number,maximumEmissionDegrees:number,visibilityToleranceMeters:number})});
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { BASE_TILE } from '@layoutit/polycss';
import { decodeOsirisGeo, fitCamera, project } from '../terrestrial-layers/osiris-geo.mts';
import { sampleFootprint } from '../surface-observations/footprint.mts';
import { archiveBackplanes } from '../surface-observations/geometry.mts';
import type { FootprintSample } from '../surface-observations/contract.mts';
import { loadPinned } from '../comet-1p/inspect-giotto.mts';
import { loadRadialTerrain, requireTerrainMesh } from '../terrestrial-layers/radial-terrain.mts';
import { closestTrianglePoint } from '../terrestrial-layers/obj-shape.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';

const root = resolve(import.meta.dirname, '../../..');

const sub = (a:readonly number[], b:readonly number[]) => a.map((n, i) => n - b[i]);
const dot = (a:readonly number[], b:readonly number[]) => a.reduce((s, n, i) => s + n * b[i], 0);
const escape = (value:unknown) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const percentiles = (values:number[]) => {
  values.sort((a, b) => a - b);
  return Object.fromEntries([50, 95, 99, 100].map(p => [p, values[Math.min(values.length - 1, Math.floor(values.length * p / 100))] ?? null] as const));
};

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--download' && !a.startsWith('--output=') && !a.startsWith('--tile-size='))) {
    throw new Error('Usage: node tools/objects/comet-67p/inspect-osiris-geo.mts [--download] [--output=directory] [--tile-size=32|64]');
  }
  const output = resolve(args.find(a => a.startsWith('--output='))?.slice(9) ?? resolve(root, 'output/comet-intake/67p-rosetta'));
  const tileSize = Number(args.find(a => a.startsWith('--tile-size='))?.slice(12) ?? 64);
  if (![32, 64].includes(tileSize)) throw new Error('Bounded trial requires 32 or 64 pixel tiles.');
  const sourceDirectory = resolve(root, 'src/objects/comet-67p/source');
  const manifestBytes = await readFile(resolve(sourceDirectory, 'reference/osiris-trial.json'));
  const manifest = parseTrial(JSON.parse(manifestBytes.toString('utf8'))), policy = manifest.transfer;
  const sourceBytes = await readFile(resolve(sourceDirectory, manifest.shape.path));
  if (sha256(sourceBytes) !== manifest.shape.sha256) throw new Error('RMOC source pin mismatch.');
  await mkdir(output, { recursive: true });
  const bytes = await loadPinned(resolve(output, 'source'), manifest.frame, args.includes('--download'));
  const frame = decodeOsirisGeo(bytes);
  if (frame.startTime !== manifest.frame.startTime || frame.filter !== manifest.frame.filter) throw new Error('Frame identity changed.');
  const points:number[][] = [], pixels:number[][] = [], radiances:number[] = [];
  let validPixels = 0;
  for (let i = 0; i < frame.width * frame.height; i++) if (frame.valid(i)) {
    validPixels++; radiances.push(frame.planes.IMAGE[i]);
    if (i % 179 === 0) { points.push(frame.xyz(i)); pixels.push([i % frame.width, Math.floor(i / frame.width)]); }
  }
  const camera = fitCamera(points, pixels, frame.width, frame.height), residuals = [];
  for (let i = 0; i < frame.width * frame.height; i++) if (i % 179 !== 0 && frame.valid(i)) {
    const p = project(camera.matrix, frame.xyz(i));
    residuals.push(Math.hypot(p[0] - i % frame.width, p[1] - Math.floor(i / frame.width)));
  }
  const holdoutResidualPixels = percentiles(residuals);
  if (holdoutResidualPixels[100] === null || holdoutResidualPixels[100] > .01) throw new Error('Recovered camera does not explain held-out geometry pixels.');
  radiances.sort((a, b) => a - b);
  const low = radiances[Math.floor(radiances.length * .01)], high = radiances[Math.floor(radiances.length * .99)];
  const level = (value:number) => Math.round(Math.max(0, Math.min(1, (value - low) / (high - low))) * 255);
  const sourceRGB = Buffer.alloc(frame.width * frame.height * 3);
  for (let i = 0; i < frame.width * frame.height; i++) {
    const dest = ((frame.height - 1 - Math.floor(i / frame.width)) * frame.width + i % frame.width) * 3;
    sourceRGB.fill(level(frame.planes.IMAGE[i]), dest, dest + 3);
  }
  const sourceImage = await sharp(sourceRGB, { raw: { width: frame.width, height: frame.height, channels: 3 } }).png().toBuffer();
  await writeFile(resolve(output, 'observation.png'), sourceImage);
  const config = parseRadialLoaderConfig(JSON.parse(await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'), 'utf8')));
  requireRecord(config.geometry.radialTerrain).tileSize = tileSize;
  const source = await createSourceManifest({planetId:config.namespace,planetName:config.displayName??config.namespace,sourceRoot:sourceDirectory});
  if (requireRecord(config.geometry.radialTerrain).path !== manifest.shape.path) throw new Error('Unexpected source path.');
  const radial = await loadRadialTerrain({ config, sourceDirectory, source });
  if (!radial) throw new TypeError('OSIRIS trial requires its retained radial terrain.');
  const grid = requireTerrainMesh(radial.grid);
  if (radial.faces.length !== 1000) throw new Error('67P must retain exactly 1000 native u leaves.');
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const eye = camera.positionKm.map(n => n * 1000);
  const footprint = { image: { width: frame.width, height: frame.height, values: frame.planes.IMAGE, reject: () => null, startTime: frame.startTime, filter: frame.filter, report: {} },
    camera: { project: (point: readonly number[]) => project(camera.matrix, point.map(n => n / 1000)) }, geometry: archiveBackplanes(frame, { positionMeters: eye }), photometry: { gain: () => 1, retainsIllumination: true } };
  const rgb = Buffer.alloc(radial.width * radial.height * 3), coverage = Buffer.alloc(rgb.length);
  const counts:Record<string,number> = {}, distances:number[] = [], separations:number[] = [];
  let interiorTexels = 0;
  for (let faceIndex = 0; faceIndex < radial.plans.length; faceIndex++) {
    const { face, rect, matrix: m } = radial.plans[faceIndex];
    const [a, b, c] = face.vertices, ab = sub(b, a), ac = sub(c, a);
    const aa = dot(ab, ab), bb = dot(ac, ac), abac = dot(ab, ac), denominator = aa * bb - abac * abac;
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
      const px = x + .5, py = y + .5;
      const css = [m[0] * px + m[4] * py + m[12], m[1] * px + m[5] * py + m[13], m[2] * px + m[6] * py + m[14]];
      const raw = [css[1] / BASE_TILE, css[0] / BASE_TILE, css[2] / BASE_TILE];
      const ap = sub(raw, a), u = (dot(ap, ab) * bb - dot(ap, ac) * abac) / denominator;
      const v = (dot(ap, ac) * aa - dot(ap, ab) * abac) / denominator, interior = u >= 0 && v >= 0 && u + v <= 1;
      const point = closestTrianglePoint(raw, a, ab, ac).point.map(n => n * metersPerUnit);
      let sampled: FootprintSample = sampleFootprint(footprint, point,
        { ...policy, maximumSeparationMeters: policy.maximumSourceDistanceMeters + policy.maximumSeparationMeters });
      let hit:ReturnType<typeof grid.closestPoint> = null;
      if (!sampled.reason) {
        hit = grid.closestPoint(point, policy.maximumSourceDistanceMeters);
        sampled = hit ? sampleFootprint(footprint, hit.point, policy) : { reason: 'source-distance' };
        if (!sampled.reason && hit) {
          const direction = sub(hit.point, eye), distance = Math.hypot(...direction);
          const ray = grid.intersect(eye, direction.map(n => n / distance), distance + policy.visibilityToleranceMeters);
          if (!ray || Math.abs(ray.radius - distance) > policy.visibilityToleranceMeters) sampled = { reason: 'occluded' };
        }
      }
      const accepted = sampled.reason === undefined;
      if (interior) {
        interiorTexels++;
        counts[sampled.reason ?? 'accepted'] = (counts[sampled.reason ?? 'accepted'] ?? 0) + 1;
        if (sampled.reason === undefined && hit) { distances.push(hit.distanceMeters); separations.push(sampled.separationMeters); }
      }
      const longitude = Math.atan2(point[1], point[0]) * 180 / Math.PI;
      const latitude = Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI;
      const normal = face.vertexNormals[0].map((n, i) => n * (1 - u - v) + face.vertexNormals[1][i] * u + face.vertexNormals[2][i] * v);
      const light = .35 + .65 * Math.abs(dot(normal, sub(eye, point)) / Math.hypot(...normal) / Math.hypot(...sub(eye, point)));
      const color = sampled.reason === undefined ? Array<number>(3).fill(level(sampled.radiance)) : missingCoverageColor(longitude, latitude, .35).map(n => Math.round(n * light));
      const offset = ((rect.y + y) * radial.width + rect.x + x) * 3;
      for (let channel = 0; channel < 3; channel++) {
        rgb[offset + channel] = color[channel];
        coverage[offset + channel] = accepted ? 255 : 0;
      }
    }
    if (faceIndex % 100 === 99) console.log(`Prepared ${faceIndex + 1}/1000 faces`);
  }
  const atlas = await sharp(rgb, { raw: { width: radial.width, height: radial.height, channels: 3 } }).png().toBuffer();
  const coverageAtlas = await sharp(coverage, { raw: { width: radial.width, height: radial.height, channels: 3 } }).png().toBuffer();
  await writeFile(resolve(output, 'atlas.png'), atlas);
  await writeFile(resolve(output, 'coverage-atlas.png'), coverageAtlas);
  // Express the recovered camera as one prepared CSS matrix. Native triangle
  // transforms use [model Y, model X, model Z] * BASE_TILE. Flip the stored
  // image rows into the documented standard NAC display orientation.
  const size = 640, ratio = size / frame.width, center = (frame.width - 1) / 2;
  const unitsPerKm = BASE_TILE * 1000 / metersPerUnit, P = camera.matrix;
  const rows = [P[0].map((n, i) => ratio * (n - center * P[2][i]) / P[2][3]),
    P[1].map((n, i) => -ratio * (n - center * P[2][i]) / P[2][3]),
    [...P[2].slice(0, 3).map(n => -160 * n), 0], P[2].map(n => n / P[2][3])];
  const matrix = [1, 0, 2, 3].flatMap(column => rows.map(row => row[column] / (column === 3 ? 1 : unitsPerKm)));
  const leaves = radial.leaves.map(leaf => `<u style="${escape(leaf.style)}"></u>`).join('');
  const clientBytes = await readFile(resolve(import.meta.dirname, 'osiris-trial-client.mts'));
  const {code:clientCode} = await transform(clientBytes.toString('utf8'), {loader:'ts',format:'iife',target:'es2022'});
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>67P · OSIRIS photographic trial</title><link rel="icon" href="data:,">
<style>*{box-sizing:border-box}body{margin:0;background:#101314;color:#e8eae6;font:15px/1.5 system-ui}main{max-width:1360px;margin:0 auto;padding:32px}h1{font-size:30px;font-weight:500;margin:4px 0}p{max-width:960px;color:#b6bfba}.kicker{color:#acbaa5;font-size:12px;letter-spacing:.16em}section{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0;min-width:0}@media(max-width:750px){section{grid-template-columns:1fr}main{padding:18px}}figcaption{padding:12px 0;color:#b6bfba}.stage{width:100%;aspect-ratio:1;background:#000;position:relative;overflow:hidden;touch-action:none;cursor:grab}img{display:block;width:100%;height:auto}.camera{position:absolute;left:50%;top:50%;transform-style:preserve-3d;transform:scale(var(--fit,1)) matrix3d(${matrix.join(',')})}.mesh{transform-style:preserve-3d;transform-origin:0 0}.mesh u{display:block;position:absolute;left:0;top:0;width:${tileSize}px;height:${tileSize}px;transform-origin:0 0;transform-style:preserve-3d;border:0;border-top-left-radius:50% 100%;border-top-right-radius:50% 100%;corner-top-left-shape:bevel;corner-top-right-shape:bevel;background-image:url(atlas.png);background-repeat:no-repeat;backface-visibility:visible;text-decoration:none;pointer-events:none}.coverage .mesh u{background-image:url(coverage-atlas.png)}button{color:#dbe5d6;background:#252d28;border:1px solid #56614f;border-radius:5px;padding:8px 14px;margin-right:8px;cursor:pointer}a{color:#bccfb1}footer{font-size:12px;color:#929c93;margin-top:28px}</style>
<main><div class="kicker">CSS EARTH / SOURCE EXPERIMENT</div><h1>67P, through Rosetta’s camera</h1><p>One OSIRIS observation, transferred onto the existing 1,000 CSS triangles. Drag the right-hand comet to turn it. Gray grid means no accepted photograph sample. This trial retains the photographed illumination; it is not a global albedo map.</p>
<section><figure><img id="source" src="observation.png" alt="Original calibrated OSIRIS grayscale observation"><figcaption>OSIRIS NAC · 5 August 2014, 19:44:22.918 UTC · orange filter</figcaption></figure><figure><div class="stage" id="stage" aria-label="Drag to rotate the CSS comet"><div class="camera"><div class="mesh">${leaves}</div></div></div><figcaption>Retained CSS · 1,000 native u leaves · original RMOC geometry</figcaption></figure></section>
<button id="reset">Observation view</button><button id="turn">Turn 180°</button><button id="coverage">Show accepted coverage</button><p id="state" aria-live="polite">Observation camera · experimental transfer</p><p>Acceptance: closest original mesh point within 50 m; all four source pixels within 20 m of that point; emission ≤80°; full-mesh visibility check. These are trial cutoffs, not accuracy claims. Detector-quality flags and product lighting behavior remain unqualified.</p>
<footer>${escape(manifest.frame.credit)} · <a href="${manifest.frame.licenseSource}">OSIRIS image and image derivatives: CC BY-SA 4.0</a>. RMOC shape: CC BY-SA 3.0 IGO, see source NOTICE.<br><a href="report.json">Source pins, transfer counts and camera report</a></footer></main>
<script>${clientCode}</script></html>`;
  await writeFile(resolve(output, 'index.html'), html);
  const terrainBytes = Buffer.from(JSON.stringify(radial.faces));
  const report = { schema: 'cssearth-osiris-geo-trial-report@1', status: 'experimental; not a production object qualification',
    inputs: { manifestSha256: sha256(manifestBytes), frame: manifest.frame, shape: manifest.shape,
      decoderSha256: sha256(await readFile(resolve(import.meta.dirname, '../terrestrial-layers/osiris-geo.mts'))),
      preparerSha256: sha256(await readFile(import.meta.filename)), clientSha256:sha256(clientBytes) },
    camera: { ...camera, fitPixels: points.length, holdoutPixels: residuals.length, holdoutResidualPixels,
      method: 'Normalized linear projective fit using every 179th geometry-backed pixel; all other geometry-backed pixels held out.' },
    display: { low, high, method: 'Linear 1–99% geometry-backed radiance; grayscale, stored rows flipped vertically; no photometric correction.' },
    transfer: { ...policy, interiorTexels, counts, sourceDistanceMeters: percentiles(distances), separationMeters: percentiles(separations),
      meaning: 'Atlas triangle-interior sample counts, not surface-area coverage. Atlas bleed is clamped to its own retained triangle and excluded from counts.' },
    outputs: { faces: radial.faces.length, tileSize, atlasDimensions: [radial.width, radial.height],
      atlasSha256: sha256(atlas), coverageAtlasSha256: sha256(coverageAtlas), observationSha256: sha256(sourceImage),
      htmlSha256: sha256(html), terrainFacesSha256: sha256(terrainBytes), nativeLeafStylesSha256: sha256(JSON.stringify(radial.leaves)) },
    limitations: manifest.limitations };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, camera: report.camera, transfer: report.transfer, outputs: report.outputs }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
