import assert from 'node:assert/strict';
import test from 'node:test';
import { PINNED, registryDisagreements } from './registry-check.mts';

test('a pinned address or table the registry does not give is named; a trailing slash is not a difference', () => {
  const registered = [...PINNED].map(([ivoid, url]) => ({ ivoid, access_url: url.endsWith('/') ? url.slice(0, -1) : `${url}/` }));
  assert.deepEqual(registryDisagreements(PINNED, registered, ['koa_hires'], [{ table_name: 'koa_hires' }]), []);
  const [moved, ...rest] = registered;
  assert.deepEqual(registryDisagreements(PINNED, [{ ...moved!, access_url: 'https://example.org/tap' }, ...rest.slice(1)], ['koa_hires', 'koa_new'], [{ table_name: 'koa_hires' }]), [
    `${moved!.ivoid} is pinned at ${PINNED.get(moved!.ivoid)}; the registry gives https://example.org/tap.`,
    `${rest[0]!.ivoid} is pinned at ${PINNED.get(rest[0]!.ivoid)}; the registry gives no TAP address.`,
    'The pinned table koa_new is not among the tables the registry\'s crawl lists.']);
});
