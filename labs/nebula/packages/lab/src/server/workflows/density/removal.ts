import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BakeRecipe } from './config.ts';
import type { ProcessingEnvironmentRecipe } from './processing-environment.ts';
import { acquire, json, pinned, run } from './io.ts';

export async function prepareEnvironment(root: string, recipe: ProcessingEnvironmentRecipe, suppliedPython?: string) {
  const python = suppliedPython ? resolve(suppliedPython) : resolve(root, '.local/open-star-removal/venv/bin/python');
  const environment = recipe.environment;
  const probe = `import sys,importlib.metadata as m; assert '.'.join(map(str,sys.version_info[:2])) in ${JSON.stringify(environment.pythonVersions)}; ` +
    environment.packages.map(spec => { const [name, version] = spec.split('=='); return `assert m.version(${JSON.stringify(name)}) == ${JSON.stringify(version)}`; }).join('; ') + '; print("ENVIRONMENT_READY")';
  if (!suppliedPython) {
    if (!await stat(python).catch(() => null)) await run('python3', ['-m', 'venv', resolve(root, '.local/open-star-removal/venv')], root);
    let ready = false;
    try { await run(python, ['-c', probe], root, line => { ready ||= line === 'ENVIRONMENT_READY'; }); } catch { /* Install the recipe's pinned local environment below. */ }
    if (!ready) await run(python, ['-m', 'pip', 'install', ...environment.packages], root);
  }
  let verified = false;
  await run(python, ['-c', probe], root, line => { verified ||= line === 'ENVIRONMENT_READY'; });
  assert.ok(verified, 'The Python environment did not pass its version checks.');
  await acquire(root, recipe.removal.model);
  console.log('ENVIRONMENT_READY pinned Python packages and NOX model');
  return python;
}

/** Accepted NOX pixels include this baseline. Its absence must never silently change the result. */
export async function prepareBaseline(root: string, recipe: BakeRecipe, image: BakeRecipe['images'][number], python: string) {
  const plan = JSON.parse((await pinned(root, recipe.separationPlan)).toString());
  const selection = plan.selections.find((entry: any) => entry.id === image.imageId);
  assert.ok(selection, `Missing saved baseline recipe: ${image.imageId}`);
  const input = JSON.parse((await pinned(root, { path: selection.recipe, sha256: selection.recipeSha256 })).toString());
  await pinned(root, input.source);
  const receiptPath = resolve(root, input.outputDirectory, 'receipt.json');
  async function verify() {
    const receipt = await json(receiptPath);
    assert.equal(receipt.sourceSha256, input.source.sha256);
    assert.equal(receipt.recipeSha256, selection.recipeSha256);
    assert.equal(receipt.scriptSha256, recipe.removal.baselineScript.sha256);
    assert.equal(receipt.verification.maximumReconstructionErrorCodeValues, 0);
    assert.equal(receipt.verification.changedPixelsOutsideMask, 0);
    assert.equal(receipt.verification.encodedRoundTripExact, true);
    for (const [name, output] of Object.entries(receipt.outputs) as [string, {sha256: string}][]) {
      await pinned(root, { path: `${input.outputDirectory}/${name}`, sha256: output.sha256 });
    }
  }
  if (await stat(receiptPath).catch(() => null)) {
    await verify(); console.log(`BASELINE_CACHED ${image.imageId}`); return;
  }
  let complete = false, last = 0;
  await run(python, [resolve(root, recipe.removal.baselineScript.path), resolve(root, selection.recipe)], root, line => {
    try {
      const event = JSON.parse(line); complete ||= event.stage === 'complete';
      if (Date.now() - last > 5000 || event.stage === 'complete') { console.log(`BASELINE ${image.imageId}: ${line}`); last = Date.now(); }
    } catch { console.log(line); }
  });
  assert.ok(complete, 'Baseline worker did not report completion.');
  await verify(); console.log(`BASELINE_READY ${image.imageId}`);
}
