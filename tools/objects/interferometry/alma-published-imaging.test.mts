import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { parseImagingRecipe, publishedImagingScript } from './alma-published-imaging.mts';
const test = sourceTest();

const root = fileURLToPath(new URL('../../../', import.meta.url));
const epsEridani = async () => JSON.parse(await readFile(resolve(root, 'src/objects/eps-eridani-disc/source/alma-imaging.json'), 'utf8')) as Record<string, unknown>;

test('the paper’s imaging is what reaches tclean: its weighting, its scales in pixels of the grid, its threshold and its masks', async () => {
  const recipe = parseImagingRecipe(await epsEridani());
  const script = publishedImagingScript(recipe, { scratch: '/fast', out: '/work/eps_eri.booth2023' });
  assert.ok(script.includes("weighting='natural'") && !script.includes('robust='), 'natural weighting has no robust value');
  // Booth et al.'s scales of 0, 1.4 and 7 arcsec on the 0.19 arcsec grid.
  assert.ok(script.includes("deconvolver='multiscale', scales=[0, 7, 37]"));
  assert.ok(script.includes("threshold='25uJy'") && script.includes("usemask='user'"));
  assert.ok(script.includes("ellipse [[03:32:54.521, -09.27.29.49], [28.1arcsec, 23.4arcsec], -1.1deg]"));
  // Every execution of the delivery, as alma-restore.mts --split-only named its split, and none imaged before it is finished.
  assert.equal(script.match(/'\/fast\/uid___A002_[^']+_target\.ms'/gu)?.length, 10, 'five splits, listed in the check and in tclean');
  assert.ok(script.indexOf("if missing: sys.exit(") < script.indexOf('tclean('));
  // The image as the paper shows it, uncorrected for the primary beam, and the corrected one beside it.
  for (const kind of ['image', 'image.pbcor', 'pb', 'mask']) assert.ok(script.includes(`fitsimage='/work/eps_eri.booth2023.${kind}.fits'`), kind);
  assert.ok(script.includes('"noiseMicroJyPerBeam": float(noise * 1e6)') && script.includes('measured["published"]'));
  const compiled = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], { input: script, encoding: 'utf8' });
  assert.equal(compiled.status, 0, compiled.stderr);
});

test('a recipe says what it chose where the paper is silent, and refuses what the script could not use', async () => {
  const recipe = parseImagingRecipe(await epsEridani());
  assert.ok(recipe.chosen.length > 0 && recipe.mask.source.includes('Table 3'));
  const input = await epsEridani();
  assert.throws(() => parseImagingRecipe({ ...input, schema: 'x' }), /cssearth-alma-imaging-recipe@1/u);
  assert.throws(() => parseImagingRecipe({ ...input, scalesArcsec: undefined }), /states its scales/u);
  assert.throws(() => parseImagingRecipe({ ...input, weighting: 'briggs' }), /robust/u);
  assert.throws(() => parseImagingRecipe({ ...input, imageSize: [378] }), /two whole pixel counts/u);
  assert.throws(() => parseImagingRecipe({ ...input, mask: { regions: [], source: 'x' } }), /non-empty list/u);
});
