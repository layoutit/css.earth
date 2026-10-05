import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { suppressMinorMoonOrbitPaint } from './moon-orbit-policy.mts';
test('orbit suppression owns a removable style, including an empty policy', () => {
  const { document } = parseHTML('<div></div>'); const host = document.querySelector<HTMLElement>('div')!;
  const dispose = suppressMinorMoonOrbitPaint(host, ['moon-a', 'moon-b']);
  assert.equal(host.firstElementChild?.textContent, '.prepared-world-context [data-context-orbit="moon-a"],.prepared-world-context [data-context-orbit="moon-b"]{display:none!important}');
  assert.ok(host.querySelector('[data-moon-orbit-policy]')); dispose();
  assert.equal(host.children.length, 0);
  const empty = suppressMinorMoonOrbitPaint(host, []);
  assert.equal(host.firstElementChild?.textContent, ''); empty();
  assert.equal(host.children.length, 0);
  assert.throws(() => suppressMinorMoonOrbitPaint(host, ['invalid"id']), TypeError);
  assert.equal(host.children.length, 0);
});
