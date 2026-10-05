/** Preload in build subprocesses: missing inputs fail; shared downloaded scenes remain read only. */
import fs from 'node:fs';
import promises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const scenes = resolve('public/scenes');
function guard(value: unknown): void {
  if (!(typeof value === 'string' || value instanceof URL || Buffer.isBuffer(value))) return;
  const path = resolve(value instanceof URL ? fileURLToPath(value) : String(value));
  if (path === scenes || path.startsWith(scenes + sep)) throw new Error('Shared scene inputs are read only');
}
for (const name of ['writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'unlink', 'unlinkSync', 'rm', 'rmSync', 'rename', 'renameSync', 'createWriteStream', 'truncate', 'truncateSync'] as const) {
  Reflect.set(fs, name, new Proxy(fs[name], { apply(fn, receiver, args) { guard(args[0]); if (name.startsWith('rename')) guard(args[1]); return Reflect.apply(fn, receiver, args); } }));
}
for (const name of ['writeFile', 'appendFile', 'unlink', 'rm', 'rename', 'truncate'] as const) {
  Reflect.set(promises, name, new Proxy(promises[name], { apply(fn, receiver, args) { guard(args[0]); if (name === 'rename') guard(args[1]); return Reflect.apply(fn, receiver, args); } }));
}
syncBuiltinESMExports();
globalThis.fetch = async () => { throw new Error('Network forbidden in restored revision build'); };
