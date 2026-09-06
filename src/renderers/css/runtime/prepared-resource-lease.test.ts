import { expect, test, vi } from 'vitest';
import { prepareObjectResources } from './prepared-resource-lease.js';
import { createPreparedResidency, type PreparedAssets } from '../rendering/prepared-residency.js';

const assets: PreparedAssets = { entries: [], pools: [], startup: [] };
test('preflight owns a bank until exactly one matching scene claims it', async () => {
  const controller = new AbortController();
  const native = createPreparedResidency({ assets });
  const destroy = vi.fn(() => native.destroy());
  const residency = { ...native, destroy };
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await lease.ready;
  expect(() => lease.claim({ ...assets }, {})).toThrow('another definition');
  expect(lease.claim(assets, {})).toBe(residency);
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
  controller.abort(); lease.destroy();
  expect(destroy).not.toHaveBeenCalled();
  residency.destroy();
  expect(destroy).toHaveBeenCalledOnce();
});
test('cancelled preflight releases an unclaimed bank and cannot reach a scene', async () => {
  const controller = new AbortController(); controller.abort();
  const residency = createPreparedResidency({ assets });
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await expect(lease.ready).rejects.toThrow('cancelled');
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
  lease.destroy();
  expect(await residency.prepareStartup()).toBeNull();
});
test('ready unclaimed resources are cancelled promptly without double destruction', async () => {
  const controller = new AbortController();
  const residency = createPreparedResidency({ assets });
  const lease = prepareObjectResources(assets, { signal: controller.signal, createResources: () => residency });
  await lease.ready; controller.abort(); lease.destroy();
  expect(() => lease.claim(assets, {})).toThrow('unavailable');
  expect(await residency.prepareStartup()).toBeNull();
});
