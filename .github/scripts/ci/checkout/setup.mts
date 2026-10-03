/** Bootstrap a clean checkout without interactive install prompts; repeat runs reuse restored inputs.
 * This builds workspace packages and generated compiler inputs, never a production site. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../../..');
const steps = [
  ['pnpm', ['install', '--frozen-lockfile']],
  ['pnpm', ['setup:prepared']],
  [process.execPath, ['.github/scripts/ci/build-ci.mts', 'full']],
  ['pnpm', ['prepare:typecheck']],
] as const;
for (const [command, args] of steps) {
  const result = spawnSync(command, [...args], { cwd: root, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Checkout setup failed: ${command} ${args.join(' ')} (${result.signal ?? result.status}).`);
}
console.log('Checkout setup complete: targeted tests and typecheck inputs are ready.');
