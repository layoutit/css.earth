import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
const sha = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
const results = ['earth', 'tree', 'search', 'closed', 'cleared', 'planets', 'empty', 'native-search', 'native-empty', 'city'].map(view => {
  const beforeBytes = fs.readFileSync(`../../output/playwright/search-presentation/before-${view}.png`);
  const afterBytes = fs.readFileSync(`../../output/playwright/search-presentation/after-${view}.png`);
  const before = PNG.sync.read(beforeBytes), after = PNG.sync.read(afterBytes);
  if (before.width !== after.width || before.height !== after.height) throw Error('Capture dimensions differ.');
  const diff = new PNG({ width: before.width, height: before.height });
  const mismatches = pixelmatch(before.data, after.data, diff.data, before.width, before.height, { threshold: 0.1, includeAA: true });
  fs.writeFileSync(`../../output/playwright/search-presentation/diff-${view}.png`, PNG.sync.write(diff));
  const exactDiff = new PNG({ width: before.width, height: before.height });
  const exactMismatches = pixelmatch(before.data, after.data, exactDiff.data, before.width, before.height, { threshold: 0, includeAA: true });
  fs.writeFileSync(`../../output/playwright/search-presentation/diff-${view}-exact.png`, PNG.sync.write(exactDiff));
  return { view, pixels: before.width * before.height, mismatches, exactMismatches, identicalBytes: beforeBytes.equals(afterBytes), beforeSha256: sha(beforeBytes), afterSha256: sha(afterBytes) };
});
const sourceFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n');
const report = { baseline: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidate: Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(file))])),
  browser: 'Chrome 153.0.8010.53', viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, pixelmatch: '7.2.0', threshold: 0.1, includeAA: true,
  assetOrigin: 'https://earth-assets.lowpoly.cc', inputs: 'Same prepared inputs and inventory-addressed published textures; default surface labels off, motion off. No assets regenerated between captures.', results };
fs.writeFileSync('output/search-presentation/pixelmatch.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some(result => result.mismatches)) process.exitCode = 1;
