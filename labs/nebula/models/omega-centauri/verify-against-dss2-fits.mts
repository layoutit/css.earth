/** Register each press image against a real-WCS DSS2 FITS cutout, with both sides detected at the
 * same ~1"/px working scale (the coarser survey's native sampling) so detectStars finds the same
 * population of stars on both sides. Reuses the shared algorithm only; no new matching logic. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { decodeFits } from '../../../../tools/nebula/application/fits.ts';
import { detectStars, matchStars, verifyRegistration, publisherTransform, type SkyRaster, type SkyFrame } from '../../packages/reconstruction/src/registration/stellar.ts';

const root = process.cwd();
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const load = async (p: string, expected: string) => { const b = await readFile(resolve(root, p)); if (sha256(b) !== expected) throw new Error(`Pin differs: ${p}`); return b; };

// DSS2 red-band FITS, exact-by-construction WCS: fov=0.91667deg=3300", width=3300 -> 1.0"/px.
const dss2Path = '.local/nebula-lab/source-originals/omega-centauri-dss2.fits';
const dss2Bytes = await readFile(resolve(root, dss2Path));
console.log('DSS2 sha256', sha256(dss2Bytes), 'bytes', dss2Bytes.length);
const fits = decodeFits(dss2Bytes);
console.log('DSS2 FITS', fits.width, fits.height);
let lo = Infinity, hi = -Infinity;
const sorted = Float32Array.from(fits.values).sort();
lo = sorted[Math.floor(sorted.length * 0.01)]!; hi = sorted[Math.floor(sorted.length * 0.999)]!;
const gray = Buffer.alloc(fits.width * fits.height);
for (let i = 0; i < fits.values.length; i++) gray[i] = Math.max(0, Math.min(255, Math.round((fits.values[i]! - lo) / (hi - lo) * 255)));
const dss2Png = await sharp(gray, { raw: { width: fits.width, height: fits.height, channels: 1 } }).png().toBuffer();
const dss2: SkyRaster = {
  width: fits.width, height: fits.height, fieldArcminutes: [fits.width / 60, fits.height / 60], centerIcrsDegrees: [201.696958, -47.479539], northRightDegrees: 0,
  wcs: { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [fits.width, fits.height], referencePixel: [fits.width / 2, fits.height / 2],
    referenceValueDeg: [201.696958, -47.479539], scaleDeg: [-1 / 3600, 1 / 3600], rotationDeg: 0 } as any,
};
console.log('Detecting DSS2 stars at 1.0"/px...');
const dss2Stars = await detectStars(dss2Png, [fits.width, fits.height], fits.width, 6000);
console.log('DSS2 stars', dss2Stars.length);

const candidates = [
  { id: 'eso1119b', path: '.local/nebula-lab/source-originals/eso1119b.tif', sha256: '8df2e2ad462b9dc5b7437320fb2c6fd247c11746b4b2ffd3da95846b9083cad6',
    width: 14540, height: 14540, fieldArcminutes: [50.88, 50.88] as [number, number], centerIcrsDegrees: [201.69695833333333, -47.47953888888889] as [number, number], northRightDegrees: 0.00051173061 },
  { id: 'eso0844a', path: '.local/nebula-lab/source-originals/eso0844a.tif', sha256: '384d1cfc31e6a2b78e5c7018f9eaecfe49a1014630bcb1bd8dceb563d69e6429',
    width: 8040, height: 7560, fieldArcminutes: [31.88, 29.99] as [number, number], centerIcrsDegrees: [201.69716666666667, -47.479683333333334] as [number, number], northRightDegrees: -0.00724264734 },
];

// Matching-frame resolution is swept independently of detection resolution (both press images and
// DSS2 are detected at the same ~1.0"/px scale above; only the discovery/verification tolerance,
// which is fixed in frame pixels, changes with frame width).
const FRAME_WIDTHS = [3600, 1800, 900, 450, 225];

const report: { schema: string; pass: boolean; sources: unknown[] } = { schema: 'cssearth-image-alignment-report@1', pass: true, sources: [] };
for (const c of candidates) {
  console.log(`--- ${c.id} downsampled to ~1"/px ---`);
  const bytes = await load(c.path, c.sha256);
  const targetScale = 1; // arcsec/px, matching DSS2 native
  const newWidth = Math.round(c.width * (c.fieldArcminutes[0] * 60 / c.width) / targetScale);
  const resized = await sharp(bytes).resize({ width: newWidth }).removeAlpha().toColourspace('srgb').png().toBuffer({ resolveWithObject: true });
  const { data: resizedInfo } = { data: resized.data };
  const actualW = resized.info.width, actualH = resized.info.height;
  const scaleXArcsec = c.fieldArcminutes[0] * 60 / actualW, scaleYArcsec = c.fieldArcminutes[1] * 60 / actualH;
  console.log(c.id, 'downsampled to', actualW, 'x', actualH, 'arcsec/px', scaleXArcsec, scaleYArcsec);
  const downsampled: SkyRaster = {
    width: actualW, height: actualH, fieldArcminutes: c.fieldArcminutes, centerIcrsDegrees: c.centerIcrsDegrees, northRightDegrees: c.northRightDegrees,
    wcs: { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [actualW, actualH], referencePixel: [actualW / 2, actualH / 2],
      referenceValueDeg: c.centerIcrsDegrees, scaleDeg: [-scaleXArcsec / 3600, scaleYArcsec / 3600], rotationDeg: c.northRightDegrees } as any,
  };
  const stars = await detectStars(resized.data, [actualW, actualH], actualW, 6000);
  console.log(c.id, 'stars', stars.length);
  let outcome: { pass: boolean; matrix: unknown; evidence: Record<string, unknown>; frameWidth: number } | undefined;
  for (const width of FRAME_WIDTHS) {
    const frame: SkyFrame = { width, height: width, fieldArcminutes: [60, 60], centerIcrsDegrees: [201.696958, -47.479539], northUp: true };
    const dss2Init = publisherTransform(dss2, frame), init = publisherTransform(downsampled, frame);
    const pairs = matchStars(stars, dss2Stars, init, dss2Init);
    console.log(c.id, 'frameWidth', width, 'arcsecPerPx', 3600 / width, 'pairs', pairs.length);
    if (pairs.length < 45) continue;
    const result = verifyRegistration(pairs, downsampled, frame, init, { width: dss2.width, height: dss2.height, imageToFrame: dss2Init });
    console.log(JSON.stringify({ id: c.id, frameWidth: width, pass: result.pass, rmsPixels: result.evidence.rmsPixels, maxResidualPixels: result.evidence.maxResidualPixels,
      residualArcseconds: result.evidence.residualArcseconds, matchedStars: result.evidence.matchedStars, trainingStars: result.evidence.trainingStars,
      heldOutStars: result.evidence.heldOutStars, coverageFraction: result.evidence.coverageFraction }, null, 2));
    outcome = { pass: result.pass, matrix: result.matrix, evidence: result.evidence, frameWidth: width };
    if (result.pass) break;
  }
  if (!outcome) { outcome = { pass: false, matrix: null, evidence: { status: 'publisher', interpretation: 'No frame width in the swept range reached 45 matched pairs.' }, frameWidth: -1 }; console.log(c.id, 'IMPASSE: never reached 45 matched pairs'); }
  if (!outcome.pass) report.pass = false;
  report.sources.push({ id: c.id, pass: outcome.pass, sourcePath: c.path, sourceSha256: c.sha256, downsampledTo: [actualW, actualH], frameWidth: outcome.frameWidth,
    geometry: { kind: 'matched-star-homography-vs-dss2-fits', matrix: outcome.matrix }, evidence: outcome.evidence });
}
await writeFile(resolve(root, 'labs/nebula/models/omega-centauri/dss2-fits-registration-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('OVERALL PASS', report.pass);
