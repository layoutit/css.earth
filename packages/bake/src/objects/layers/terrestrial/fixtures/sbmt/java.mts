/** Narrow, runtime-checked JNI boundary. All numerical work stays in upstream
 * SBMT/VTK; no Java implementation is generated or patched by this harness. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

export function nativeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const length = Reflect.get(value, 'length');
    if (typeof length === 'number' && Number.isSafeInteger(length) && length >= 0)
      return Array.from({ length }, (_, i) => Reflect.get(value, String(i)));
  }
  throw new Error('Native result is not a numeric array');
}

export function member(target: unknown, name: string): unknown {
  if ((typeof target !== 'object' || target === null) && typeof target !== 'function')
    throw new TypeError(`Java receiver is missing for ${name}`);
  return Reflect.get(target, name);
}
export function call(target: unknown, name: string, ...args: unknown[]): unknown {
  const method = member(target, name);
  if (typeof method !== 'function') throw new TypeError(`Native method unavailable: ${name}`);
  return Reflect.apply(method, target, args);
}
export function construct(target: unknown, ...args: unknown[]): unknown {
  if (typeof target !== 'function') throw new TypeError('Native constructor unavailable');
  return Reflect.construct(target, args);
}
export function javaBridge(root: string) {
  const require = createRequire(resolve(root, '.local/oracles/sbmt/bridge/package.json'));
  const bridge: unknown = require('java-bridge');
  return {
    start(libPath: string, classpath: string[], options: string[]) {
      call(bridge, 'ensureJvm', { libPath, classpath, opts: options });
    },
    type(name: string): unknown { return call(bridge, 'importClass', name); },
  };
}
