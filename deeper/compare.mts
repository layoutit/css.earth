import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
const sha = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
const results = ['earth', 'tree', 'search'].map(view => {
  const beforeBytes = fs.readFileSync(`output/router-deep/before-${view}.png`);
  const afterBytes = fs.readFileSync(`output/router-deep/after-${view}.png`);
  const before = PNG.sync.read(beforeBytes), after = PNG.sync.read(afterBytes);
  if (before.width !== after.width || before.height !== after.height) throw Error('Capture dimensions differ.');
  const diff = new PNG({ width: before.width, height: before.height });
  const mismatches = pixelmatch(before.data, after.data, diff.data, before.width, before.height, { threshold: 0.1, includeAA: true });
  fs.writeFileSync(`output/router-deep/diff-${view}.png`, PNG.sync.write(diff));
  const exact = new PNG({ width: before.width, height: before.height });
  const exactMismatches = pixelmatch(before.data, after.data, exact.data, before.width, before.height, { threshold: 0, includeAA: true });
  fs.writeFileSync(`output/router-deep/diff-${view}-exact.png`, PNG.sync.write(exact));
  return {view,pixels:before.width*before.height,mismatches,exactMismatches,identicalBytes:beforeBytes.equals(afterBytes),beforeSha256:sha(beforeBytes),afterSha256:sha(afterBytes)};
});
const git = (...args: string[]) => execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceFiles = git('diff','--name-only','--diff-filter=ACMRT','c3f222a','HEAD').split('\n').filter(Boolean);
const report = {
  baseline: 'c3f222a5a61d5a7b288e0bbc6a2631b827a6b353', candidate: git('rev-parse','HEAD'), candidateTree:git('rev-parse','HEAD^{tree}'),
  capturedBeforeCommit: true, versionStamp: '0.3153', sourceFiles:Object.fromEntries(sourceFiles.map(file=>[file,sha(fs.readFileSync(file))])),
  browser:'Chrome 153.0.8010.53',viewport:{width:1440,height:900,deviceScaleFactor:1},pixelmatch:'7.2.0',threshold:0.1,includeAA:true,
  assetOrigin:'https://earth-assets.lowpoly.cc',inputs:'Same prepared inputs, inventory-addressed textures and restored Earth atmosphere/shadowless textures. Default labels and motion off. Both captures wait for scene readiness, network idle and the feature-search response. Baseline uses pinned site/ and atlas/ sources with shared unchanged prepared inputs; only dev-server filesystem permissions/cache isolation differ.',
  initialPath:'/earth/?v=UMJA3puvFbeOAUFCxzNAAAAAv9XjqHSKGu0AAAAAAAAAAAAAAAAAAAAAAAIAAAAAAAAAAAAAAAAAAAAA',
  navigationPayload:{identical:fs.readFileSync('output/router-deep/before-navigation-tree.json').equals(fs.readFileSync('output/router-deep/after-navigation-tree.json')),sha256:sha(fs.readFileSync('output/router-deep/after-navigation-tree.json'))},results,
};
fs.writeFileSync('output/router-deep/pixelmatch.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({candidate:report.candidate,navigationPayload:report.navigationPayload,results},null,2));
if(results.some(result=>result.mismatches))process.exitCode=1;
