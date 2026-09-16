import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Research-only CLI; the restricted third-party software must be obtained separately by its user. */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { digest } from '@cssearth/nebula-reconstruction/methods/getsf/benchmark-products';
import { prepareGetSfBenchmark, type GetSfInput } from '../../server/workflows/density/getsf.ts';
import { collectGetSfBenchmark } from '../../server/workflows/density/getsf-collect.ts';

const [recipePath, executablePath, workPath, negativePolicy = 'reject'] = process.argv.slice(2);
if (!recipePath || !executablePath || !workPath || !['reject', 'positive-parts-with-signed-residual'].includes(negativePolicy))
  throw new Error('Usage: getsf-run <benchmark-recipe.json> <installed-getsf> <work-directory> [reject|positive-parts-with-signed-residual]');
const recipe = parseLabModelJson(await readFile(resolve(recipePath), 'utf8'));
if (!recipe.getsf) throw new Error('The benchmark recipe must declare getsf morphology parameters and image WCS.');
const binary = resolve(executablePath), bin = dirname(binary), installationRoot = dirname(bin);
const installationReceiptPath = resolve(installationRoot, 'install-receipt.json');
const installation = parseLabModelJson(await readFile(installationReceiptPath, 'utf8'));
if (digest(await readFile(binary)) !== installation.binaries.getsf)
  throw new Error('getsf executable differs from its pinned installation receipt.');
const input: GetSfInput = {
  ...recipe.getsf, imagePath: resolve(recipe.input.path), imageSha256: recipe.input.sha256,
  width: recipe.input.width, height: recipe.input.height, workDirectory: resolve(workPath),
};
await prepareGetSfBenchmark(input);
const logPath = resolve(workPath, 'execution.log');
const log = createWriteStream(logPath);
const started = Date.now();
await new Promise<void>((done, reject) => {
  const child = spawn(binary, [], { cwd: resolve(workPath, 'runs'), detached: true,
    env: { ...process.env, GETSF_HOME: resolve(installationRoot, 'source'), GETSF_BIN: bin,
      PATH: `${bin}:${process.env.PATH ?? ''}` }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  let failure: string | undefined, lastSize = -1, lastProgress = Date.now(), cleanup: Promise<void> | undefined;
  function stop(reason: string) {
    if (failure) return;
    failure = reason;
    if (!child.pid) return;
    const group = -child.pid;
    try { process.kill(group, 'SIGTERM'); } catch { /* Already stopped. */ }
    // Do not cancel this on leader exit: its Fortran descendants may still be alive.
    cleanup = new Promise<void>(finish => setTimeout(() => {
      try { process.kill(group, 'SIGKILL'); } catch { /* Whole group stopped. */ }
      finish();
    }, 5_000));
  }
  const timeout = setTimeout(() => stop('exceeded30min'), 30 * 60_000);
  const watch = setInterval(async () => {
    try {
      const raw = await readFile(logPath, 'utf8');
      if (raw.length !== lastSize) { lastSize = raw.length; lastProgress = Date.now(); }
      else if (Date.now() - lastProgress > 5 * 60_000) stop('no log progress for5min');
      const lines = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split('\n').filter(line => line.trim());
      console.log(`getsf elapsed ${Math.round((Date.now() - started) / 1000)}s: ${lines.at(-1)?.slice(0, 180)}`);
    } catch (error) { stop(`progress log unreadable: ${String(error)}`); }
  }, 60_000);
  child.once('error', error => { clearTimeout(timeout); clearInterval(watch); log.end(); reject(error); });
  child.once('close', async code => {
    clearTimeout(timeout); clearInterval(watch);
    await cleanup; // Keep Node alive through the grace period even if the group leader exits first.
    log.end(() => code === 0 && !failure ? done() : reject(new Error(`getsf ${failure ?? `exited${code}`}; inspect ${logPath}`)));
  });
});
const manifest = await collectGetSfBenchmark({ workDirectory: resolve(workPath),
  outputDirectory: resolve(recipe.outputDirectory, 'getsf'), importPath: resolve(installationRoot, 'import.json'),
  installationReceiptPath, negativePolicy: negativePolicy as 'reject' | 'positive-parts-with-signed-residual' });
console.log(JSON.stringify({ status: 'GETSF_COMPLETE', elapsedSeconds: (Date.now() - started) / 1000,
  importPath: resolve(installationRoot, 'import.json'), manifest }, null, 2));
