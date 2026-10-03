/** Hold the same checkout lock as check-ci while every compiler reads dist. */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { withCheckoutLock } from './lock.mts';
const root = resolve(import.meta.dirname, '../../../..');
await withCheckoutLock(root, () => new Promise<void>((accept, reject) => {
  const child = spawn('pnpm', ['typecheck:all'], { cwd: root, stdio: 'inherit', env: process.env });
  child.once('error', reject);
  child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`Typecheck failed (${signal ?? code}).`)));
}));
