/** Isolation subprocess guard: historical lab paths are data, never live filesystem dependencies. */
import fs from 'node:fs';
import promises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
for (const owner of [fs, promises]) for (const method of ['readFile', 'readFileSync', 'open', 'openSync', 'readdir', 'readdirSync', 'stat', 'statSync', 'access', 'accessSync', 'realpath', 'realpathSync']) {
  const original: unknown = Reflect.get(owner, method);
  if (typeof original !== 'function') continue;
  Reflect.set(owner, method, new Proxy(original, { apply(target, self, args: unknown[]) {
    const input = args[0], path = input instanceof URL ? fileURLToPath(input) : typeof input === 'string' ? input : undefined;
    if (path && resolve(path).replaceAll('\\', '/').includes('/labs/nebula/'))
      throw new Error(`ISOLATION_FORBIDDEN_LAB_ACCESS ${path}`);
    return Reflect.apply(target, self, args);
  } }));
}
syncBuiltinESMExports();
globalThis.fetch = async () => { throw new Error('ISOLATION_NETWORK_FORBIDDEN'); };
console.log('APPLICATION_ISOLATION_GUARD_ACTIVE');
