/** Compare retained, equally framed captures without resizing, alignment or masks.
 * node tools/investigations/compare-visual-evidence.mts reference.png result.png diff.png report.json
 * The report measures visible change, not image quality or scientific accuracy. */
import { sha256 } from '@cssearth/core/node';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';

const [reference, result, diff, reportPath, ...extra] = process.argv.slice(2);
if (!reference || !result || !diff || !reportPath || extra.length) {
  throw new TypeError('Usage: compare-visual-evidence reference.png result.png diff.png report.json');
}
if (new Set([reference, result, diff, reportPath].map(path => resolve(path))).size !== 4) {
  throw new TypeError('Inputs and outputs must be four different paths.');
}
sharp.cache(false);
sharp.concurrency(1);

const pin = (path: string, bytes: Uint8Array) => ({
  path: relative(dirname(resolve(reportPath)), resolve(path)), bytes: bytes.length, sha256: sha256(bytes),
});
const decode = async (path: string) => {
  const bytes = await readFile(path);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new TypeError('Comparison requires RGBA pixels.');
  return { data, info, pin: pin(path, bytes) };
};
const before = await decode(reference);
const after = await decode(result);
const { width, height } = before.info;
if (width !== after.info.width || height !== after.info.height) {
  throw new TypeError('Capture dimensions differ; this tool never resizes or aligns evidence.');
}
// Matched visual evidence uses the project contract threshold of 0.1.
const settings = { threshold: 0.1, includeAA: true, alpha: 0.2, diffColor: [255, 0, 0] as [number, number, number] };
const pixels = Buffer.alloc(width * height * 4);
const mismatchedPixels = pixelmatch(before.data, after.data, pixels, width, height, settings);
const output = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
await writeFile(diff, output);
const packagePath = resolve(dirname(createRequire(import.meta.url).resolve('pixelmatch')), 'package.json');
const pkg: unknown = JSON.parse(await readFile(packagePath, 'utf8'));
if (typeof pkg !== 'object' || pkg === null || !('version' in pkg) || typeof pkg.version !== 'string') {
  throw new TypeError('Pixelmatch package version is unavailable.');
}
const report = {
  tool: 'pixelmatch', version: pkg.version, settings,
  reference: before.pin, result: after.pin, diff: pin(diff, output),
  width, height, comparedPixels: width * height, mismatchedPixels,
  mismatchPercent: mismatchedPixels / (width * height) * 100,
  exclusions: 'None; every supplied pixel is compared, including anti-aliasing.',
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ mismatchedPixels, comparedPixels: width * height, reportPath }));
