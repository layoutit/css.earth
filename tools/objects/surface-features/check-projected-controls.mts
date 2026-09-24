/** Preparation-only inspection of published planetocentric controls in native
 * image pixels. This measures discrepancies; it never fits or qualifies a camera. */
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '@cssearth/core';
import { readFitsPrimary } from '@cssearth/fits';
import { loadObjShape } from '../terrestrial-layers/obj-shape.mts';
import { matrixCamera } from '../surface-observations/cameras.mts';

type Pixel = readonly [number, number];
interface Control { id: string; longitudeDegrees: number; latitudeDegrees: number; observedPixel: Pixel; regionPixels: readonly [number, number, number, number]; identification: string; }
interface Camera { positionMeters: readonly number[]; ray(x: number, y: number): readonly number[]; project(point: number[]): readonly number[] | null; }
interface Shape { intersect(origin: readonly number[], ray: readonly number[]): { radius: number; faceId: number } | null; }
const number = requireFiniteNumber, record = requireRecord;
const text = (v: unknown, at: string) => { const s = requireString(v, at); if (!s.trim()) throw new Error(`${at} must not be empty.`); return s; };
const tuple = (v: unknown, n: number, at: string) => { const a = requireArray(v, at); if (a.length !== n) throw new Error(`${at} needs ${n} values.`); return a.map(x => number(x, at)); };

const xml = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

export function parseProjectedControls(value: unknown, width: number, height: number): Control[] {
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 1)) throw new Error('Invalid native image dimensions.');
  const ids = new Set<string>();
  const controls = requireArray(value, 'controls').map((v): Control => {
    const c = record(v, 'control'), id = text(c.id, 'control id');
    if (ids.has(id)) throw new Error('Duplicate control id.'); ids.add(id);
    const longitudeDegrees = number(c.longitudeDegrees, 'longitude'), latitudeDegrees = number(c.latitudeDegrees, 'latitude');
    if (longitudeDegrees < 0 || longitudeDegrees >= 360 || Math.abs(latitudeDegrees) > 90) throw new Error('Invalid planetocentric coordinates.');
    const [x, y] = tuple(c.observedPixel, 2, 'observed pixel'), [left, top, right, bottom] = tuple(c.regionPixels, 4, 'identification region');
    if (!(left >= 0 && top >= 0 && right < width && bottom < height && left < right && top < bottom && x >= left && x <= right && y >= top && y <= bottom)) throw new Error('Control must lie inside its native identification region.');
    return { id, longitudeDegrees, latitudeDegrees, observedPixel: [x, y], regionPixels: [left, top, right, bottom], identification: text(c.identification, 'identification limitation') };
  });
  if (!controls.length) throw new Error('No projected controls.');
  return controls;
}

/** Coordinates are east-positive, planetocentric, with +Z north and origin [0,0,0].
 * Radial intersection supplies the source surface, not an ellipsoid approximation. */
export function inspectProjectedControls(controls: readonly Control[], shape: Shape, camera: Camera, width: number, height: number) {
  return controls.map(control => {
    const rad = Math.PI / 180, lat = control.latitudeDegrees * rad, lon = control.longitudeDegrees * rad;
    const direction = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    const surface = shape.intersect([0, 0, 0], direction);
    if (!surface) throw new Error(`No source surface for ${control.id}.`);
    const pointMeters = direction.map(n => n * surface.radius), p = camera.project(pointMeters);
    if (!p || p.length < 2 || !p.slice(0, 2).every(Number.isFinite) || (p.length > 2 && p[2] <= 0)) throw new Error(`Invalid projection for ${control.id}.`);
    const [x, y] = p, ray = camera.ray(x, y), hit = shape.intersect(camera.positionMeters, ray);
    const distance = Math.hypot(...pointMeters.map((n, i) => n - camera.positionMeters[i]));
    // Numerical surface visibility tolerance, unrelated to a registration budget.
    const visible = Boolean(hit && Math.abs(hit.radius - distance) <= Math.max(.001, surface.radius * 1e-6));
    const insideImage = x >= 0 && x < width && y >= 0 && y < height;
    const [left, top, right, bottom] = control.regionPixels;
    return { ...control, sourcePointMeters: pointMeters, sourceFace: surface.faceId, projectedPixel: [x, y], visible, insideImage,
      residualPixels: Math.hypot(x - control.observedPixel[0], y - control.observedPixel[1]),
      distanceFromIdentificationRegionPixels: Math.hypot(Math.max(left - x, 0, x - right), Math.max(top - y, 0, y - bottom)) };
  });
}

export async function checkProjectedControlRecipe(recipePath: string, inputDirectory: string, outputDirectory: string) {
  const recipeBytes = await readFile(recipePath), recipe = record(JSON.parse(recipeBytes.toString()), 'projected control recipe');
  if (recipe.schema !== 'cssearth-projected-controls@1' || recipe.coordinateConvention !== 'planetocentric-east-positive-z-north' || recipe.purpose !== 'diagnostic-only') throw new Error('Unsupported projected control recipe.');
  const source = text(recipe.source, 'published coordinate source'), limitations = text(recipe.limitations, 'limitations');
  const image = record(recipe.image, 'image'), width = number(image.width, 'width'), height = number(image.height, 'height');
  const controls = parseProjectedControls(recipe.controls, width, height);
  const input = async (v: unknown) => {
    const p = record(v, 'pinned input'), file = text(p.file, 'input filename');
    if (basename(file) !== file || file === '.' || file === '..' || file.includes('\\')) throw new Error('Input must be a filename in the input directory.');
    const bytes = await readFile(resolve(inputDirectory, file));
    return { file, bytes, sha256: sha256(bytes), path: resolve(inputDirectory, file) };
  };
  if (image.format !== 'fits-primary' || image.pixelConvention !== 'zero-based-x-right-y-down-reversed-fits-rows') throw new Error('Unsupported native image convention.');
  const native = await input(image), fits = readFitsPrimary(native.bytes);
  if (fits.width !== width || fits.height !== height || fits.values.length !== width * height || Number(fits.header.BITPIX) !== number(image.bitpix, 'BITPIX') || !fits.values.every(Number.isFinite)) throw new Error('Native FITS pixels do not match the recipe.');
  const crop = tuple(image.crop, 4, 'display crop'), [left, top, cropWidth, cropHeight] = crop;
  if (!crop.every(Number.isSafeInteger) || left < 0 || top < 0 || cropWidth <= 0 || cropHeight <= 0 || left + cropWidth > width || top + cropHeight > height) throw new Error('Invalid display crop.');
  const maximum = fits.values.reduce((a, b) => Math.max(a, b), -Infinity);
  if (!(maximum > 0)) throw new Error('No positive display range.');
  const pixels = Buffer.from(Array.from(fits.values, (_, i) => Math.round(255 * Math.max(0, Math.min(1, fits.values[(height - 1 - Math.floor(i / width)) * width + i % width] / maximum)))));
  const scale = 4, panelWidth = cropWidth * scale, panelHeight = cropHeight * scale;
  const nativePng = await sharp(pixels, { raw: { width, height, channels: 1 } }).extract({ left, top, width: cropWidth, height: cropHeight }).resize(panelWidth, panelHeight, { kernel: 'nearest' }).png().toBuffer();
  const results = [], panels: Buffer[] = [], modelIds = new Set<string>();
  for (const v of requireArray(recipe.models, 'models')) {
    const model = record(v, 'model'), id = text(model.id, 'model id');
    if (modelIds.has(id)) throw new Error('Duplicate model id.'); modelIds.add(id);
    const pinned = await input(model.input), cameraSource = text(model.cameraSource, 'camera source'), cameraValue = record(model.camera, 'camera');
    const shape = await loadObjShape(pinned.path, model.profile), camera = matrixCamera('archived-closure', cameraValue);
    const residuals = inspectProjectedControls(controls, shape, camera, width, height);
    results.push({ id, shape: { file: pinned.file, bytes: pinned.bytes.length, sha256: pinned.sha256 }, cameraSource, camera: cameraValue, controls: residuals });
    const overlay = residuals.map(c => {
      const ox = (c.observedPixel[0] - left + .5) * scale, oy = (c.observedPixel[1] - top + .5) * scale;
      const px = (c.projectedPixel[0] - left + .5) * scale, py = (c.projectedPixel[1] - top + .5) * scale;
      const [l, t, r, b] = c.regionPixels;
      return `<rect x="${(l - left) * scale}" y="${(t - top) * scale}" width="${(r - l) * scale}" height="${(b - t) * scale}" fill="none" stroke="#ffd56b"/><path d="M${ox} ${oy}L${px} ${py}" stroke="#ffd56b"/><circle cx="${ox}" cy="${oy}" r="4" fill="#ffd56b"/><path d="M${px-6} ${py}h12M${px} ${py-6}v12" stroke="#55e5ff" stroke-width="2"/><text x="${ox + 7}" y="${oy - 9}" fill="#ffd56b" stroke="#141a20" stroke-width="3" paint-order="stroke" font-size="18">${xml(c.id)}</text>`;
    }).join('');
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="${panelHeight}"><g font-family="monospace">${overlay}</g></svg>`);
    panels.push(await sharp(nativePng).composite([{ input: svg }]).png().toBuffer());
  }
  if (!results.length || results.length > 4) throw new Error('Need one to four source models.');
  const report = { status: 'diagnostic-unqualified', recipeSha256: sha256(recipeBytes), source, limitations,
    image: { file: native.file, bytes: native.bytes.length, sha256: native.sha256, width, height, pixelConvention: image.pixelConvention },
    method: 'Project published coordinates without fitting. Residuals are against tentative native-image identifications; regions are not confidence intervals or acceptance limits. No aggregate camera-accuracy claim.',
    display: 'Linear zero-to-maximum stretch; nearest-neighbour enlargement. Yellow regions and dots are tentative native picks. Cyan crosses are projected catalogue positions.', models: results };
  const fullWidth = (panelWidth + 24) * panels.length + 24, fullHeight = panelHeight + 156;
  const title = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fullWidth}" height="${fullHeight}"><g fill="white" font-family="sans-serif"><text x="24" y="28" font-size="20">Native image controls — unqualified diagnostic</text>${results.map((r, i) => `<text x="${24 + i * (panelWidth + 24)}" y="60" font-size="16">${xml(r.id)}</text>`).join('')}<text x="24" y="${fullHeight - 47}" font-size="15" fill="#ffd56b">Yellow: tentative native centre / identification region</text><text x="24" y="${fullHeight - 23}" font-size="15" fill="#55e5ff">Cyan: published coordinate projected through the existing camera. No camera fit.</text></g></svg>`);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(resolve(outputDirectory, 'projected-controls.json'), JSON.stringify(report, null, 2) + '\n');
  await sharp({ create: { width: fullWidth, height: fullHeight, channels: 3, background: '#141a20' } }).composite([...panels.map((p, i) => ({ input: p, left: 24 + i * (panelWidth + 24), top: 76 })), { input: title }]).png().toFile(resolve(outputDirectory, 'projected-controls.png'));
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipe, inputs, output, ...extra] = process.argv.slice(2);
  if (!recipe || !inputs || !output || extra.length) throw new Error('Usage: node tools/objects/surface-features/check-projected-controls.mts RECIPE INPUT_DIRECTORY OUTPUT_DIRECTORY');
  if (resolve(output) === dirname(resolve(recipe))) throw new Error('Write diagnostics to an output directory, then inspect them before promotion.');
  const report = await checkProjectedControlRecipe(resolve(recipe), resolve(inputs), resolve(output));
  console.log(JSON.stringify(report.models.map(m => ({ model: m.id, controls: m.controls.map(c => ({ id: c.id, visible: c.visible, residualPixels: c.residualPixels, distanceFromRegionPixels: c.distanceFromIdentificationRegionPixels })) })), null, 2));
}
