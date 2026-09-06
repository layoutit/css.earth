import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { createNavigableObjectMount } from './navigable-object-mount.js';

test('preflight and native mount share one authenticated definition and transfer its resource ownership once', async () => {
  const descriptor = JSON.parse(await readFile(new URL('../../../planets/venus/object.json', import.meta.url), 'utf8'));
  const payload = JSON.parse(await readFile(new URL('../../../../src/planets/venus/prepared/object.json', import.meta.url), 'utf8'));
  // This test exercises transport/ownership; native image decoding has its own real-browser gate.
  payload.data.assets.startup = [];
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).buffer;
  descriptor.prepared.sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  const read = vi.fn(async () => bytes), destroyed = vi.fn();
  const bind = vi.fn(definition => (_stage, options) => {
    const resources = options.preparedResources.claim(definition.assets, {});
    expect(options.worldFrame.referenceFrame).toBe('sun-icrf');
    return { ready: Promise.resolve(), pause() {}, resume() {}, destroy() { resources.destroy(); destroyed(); },
      sharedView: { capture: () => null, restore: async () => false, subscribe: () => () => {} } };
  });
  const factory = createNavigableObjectMount(descriptor, { read }, bind);
  expect(read).not.toHaveBeenCalled();
  const signal = new AbortController();
  const prepared = await factory.navigation!.prepare({ signal: signal.signal });
  expect(bind).not.toHaveBeenCalled();
  const mount = factory({} as HTMLElement, { preparedResources: prepared.resources, onError() {},
    inputSurface: {} as HTMLElement, runtimePolicy: {} as never });
  await mount.ready;
  expect(read).toHaveBeenCalledOnce();
  expect(bind.mock.calls[0][0]).toBe(prepared.definition);
  signal.abort(); prepared.resources.destroy();
  expect(destroyed).not.toHaveBeenCalled();
  mount.destroy(); mount.destroy();
  expect(destroyed).toHaveBeenCalledOnce();
});
