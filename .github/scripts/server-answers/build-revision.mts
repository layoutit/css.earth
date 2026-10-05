/** Rebuild a restored revision's complete offline deploy outputs with no shared scene copy. */
import { spawn } from 'node:child_process';
import { lstat, rename, stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { terminate } from './clone-restore.mts';
import { readDeploymentConfig } from './deployment-config.mts';
import { scriptsAt, expandScript, offlineDeploySteps } from './revision-entries.mts';

export async function buildRevision(root: string, run: (step: string, index: number, env: NodeJS.ProcessEnv) => Promise<void>): Promise<void> {
  const scripts = await scriptsAt(root);
  const env = { ...process.env, CSSEARTH_SKIP_DECLARATIONS: '1', ASSET_ORIGIN: 'https://assets.invalid', NODE_OPTIONS: `--max-old-space-size=6144 --import=${resolve(import.meta.dirname, 'offline.mts')}` };
  const steps = ['pnpm build:packages', 'pnpm prepare:shell', ...offlineDeploySteps(scripts)];
  const workerBuild = expandScript(scripts, 'deploy:cloudflare-preview').find(step => step.startsWith('node '));
  if (!workerBuild) throw new Error('Missing Cloudflare bundler');
  steps.push(workerBuild.replace(/\s+--noindex\b/u, ''));
  const scenes = resolve(root, 'public/scenes'), held = resolve(root, '.server-answers-scenes');
  if (!(await lstat(scenes)).isSymbolicLink()) throw new Error('Offline build requires a restored clone with shared scenes symlink');
  for (const [index, step] of steps.entries()) {
    const astro = /^(?:pnpm exec )?astro build$/u.test(step);
    if (astro) await rename(scenes, held);
    try { await run(step, index, env); }
    finally { if (astro) await rename(held, scenes); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.argv[2] ?? process.cwd());
  await buildRevision(root, async (step, _index, env) => {
    console.log(`Building ${step}`);
    await new Promise<void>((accept, reject) => {
      const child = spawn(process.env.SHELL ?? '/bin/sh', ['-c', step], { cwd: root, env, detached: process.platform !== 'win32', stdio: 'inherit' });
      const stop = () => terminate(child);
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
      const watch = setInterval(() => console.log(`Building ${step}: running`), 30_000);
      const deadline = setTimeout(() => { terminate(child); setTimeout(() => terminate(child, 'SIGKILL'), 5000).unref(); }, 15 * 60_000);
      const cleanup = () => { clearInterval(watch); clearTimeout(deadline); process.off('SIGINT', stop); process.off('SIGTERM', stop); };
      child.once('error', error => { cleanup(); reject(error); });
      child.once('exit', code => { cleanup(); if (code === 0) accept(); else reject(new Error(`${step}: exit ${code}`)); });
    });
  });
  const config = await readDeploymentConfig(root);
  for (const file of ['dist/earth/index.html', `${config.functionsDirectory}/search.mjs`, config.workerMain]) {
    if ((await stat(resolve(root, file))).size === 0) throw new Error(`Empty build artifact ${file}`);
  }
  if (!(await readFile(resolve(root, 'dist/earth/index.html'), 'utf8')).includes('https://assets.invalid')) throw new Error('Build omitted production asset origin');
  console.log('Offline revision build complete: page and both bundles verified');
}
