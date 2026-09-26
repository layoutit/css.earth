/** Compile the application-only preparation closure, then execute it without the lab CLI. */
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { bundleRendererPackage } from '../cli/bundle-renderer.mts';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'packages/engine/package.json'));
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const output = resolve(root, '.local/nebula-bake/prepare.mjs');
await mkdir(dirname(output), {recursive:true});
await build({ entryPoints:[resolve(root,'tools/nebula/application/prepare.ts')],outfile:output,
  bundle:true,platform:'node',format:'esm',target:'node22',packages:'external',plugins:[bundleRendererPackage] });
const child = spawn(process.execPath,[output,...process.argv.slice(2)],{cwd:root,stdio:'inherit'});
const stop = () => child.kill('SIGTERM');
process.once('SIGINT',stop); process.once('SIGTERM',stop);
await new Promise<void>((accept,reject)=>{
  child.once('error',reject);
  child.once('close',code=>{ process.exitCode=code??1; accept(); });
}).finally(()=>{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);});
