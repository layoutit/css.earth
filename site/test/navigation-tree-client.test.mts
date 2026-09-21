import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { createNavigationTreeController } from '../navigation-tree-client.mts';
import { NAVIGATION_TREE_SCHEMA, type NavigationTreePayload } from '../../src/navigation/navigation-tree-schema.mts';
import type { BrowserWindow } from '../browser-types.mts';

test('deferred navigation materializes only the selected path from its verified payload', async () => {
  const payload: NavigationTreePayload = {
    schema: NAVIGATION_TREE_SCHEMA,
    roots: ['root'],
    nodes: {
      root: { label: 'Root', objectId: null, place: true, count: 2, marker: null, children: ['branch'] },
      branch: { label: 'Branch', objectId: 'branch', place: false, count: 2,
        marker: { className: 'atlas-marker atlas-marker-sprite', style: '--atlas-marker-size:8px' }, children: ['leaf'] },
      leaf: { label: 'Leaf', objectId: 'leaf', place: false, count: 1,
        marker: { className: 'atlas-marker atlas-marker-catalog', style: '' }, children: [] },
    },
  };
  const text = JSON.stringify(payload);
  const sha256 = createHash('sha256').update(text).digest('hex');
  const { document, window } = parseHTML(`<div data-object-navigation-tree data-atlas-current="old"
    data-atlas-tree-src="/navigation-tree/${sha256}.json" data-atlas-tree-sha256="${sha256}" data-atlas-tree-bytes="${Buffer.byteLength(text)}">
    <ul class="atlas-tree"><li><details data-atlas-depth="0" data-atlas-key="root" data-atlas-lazy><summary><span>Root (2)</span></summary></details></li></ul>
  </div>`);
  let requests = 0;
  window.fetch = async () => { requests++; return new Response(text); };
  const root = document.querySelector<HTMLElement>('[data-object-navigation-tree]')!;
  const controller = createNavigationTreeController(root, window as unknown as BrowserWindow);
  assert.equal(root.querySelectorAll('a').length, 0, 'cold tree retains no deferred rows');

  await controller.select('leaf');

  assert.equal(requests, 1);
  assert.equal(root.querySelectorAll('a').length, 2, 'only the selected two-row path materializes');
  assert.equal(root.querySelector<HTMLAnchorElement>('a[data-atlas-object="branch"]')?.style.getPropertyValue('--atlas-marker-size'), '8px');
  assert.equal(root.querySelector<HTMLAnchorElement>('a[data-atlas-object="leaf"]')?.getAttribute('aria-current'), 'page');
  assert.equal(root.querySelector<HTMLDetailsElement>('details[data-atlas-key="root"]')?.open, true);
  assert.equal(root.querySelector<HTMLDetailsElement>('details[data-atlas-key="branch"]')?.open, true);
  controller.destroy();
});

test('selecting an object keeps only its top-level scale branch open', async () => {
  const { document, window } = parseHTML(`<div data-object-navigation-tree>
    <ul class="atlas-tree">
      <li><details open data-atlas-depth="0" data-atlas-key="solar-system"><summary>Solar System</summary><ul><li><a data-atlas-object="sun">Sun</a></li></ul></details></li>
      <li><details open data-atlas-depth="0" data-atlas-key="milky-way"><summary>Milky Way</summary><ul><li><a data-atlas-object="milky-way">Milky Way</a></li></ul></details></li>
    </ul>
  </div>`);
  const root = document.querySelector<HTMLElement>('[data-object-navigation-tree]')!;
  const controller = createNavigationTreeController(root, window as unknown as BrowserWindow);
  const solarSystem = root.querySelector<HTMLDetailsElement>('details[data-atlas-key="solar-system"]')!;
  const milkyWay = root.querySelector<HTMLDetailsElement>('details[data-atlas-key="milky-way"]')!;

  await controller.select('milky-way');
  assert.equal(solarSystem.open, false);
  assert.equal(milkyWay.open, true);

  await controller.select('sun');
  assert.equal(solarSystem.open, true);
  assert.equal(milkyWay.open, false);
  controller.destroy();
});

test('filtering retains matching objects inside their hierarchy and restores the selected path', async () => {
  const payload: NavigationTreePayload = {
    schema: NAVIGATION_TREE_SCHEMA,
    roots: ['root'],
    nodes: {
      root: { label: 'Root', objectId: null, place: true, count: 3, marker: null, children: ['planets', 'stars'] },
      planets: { label: 'Planets', objectId: null, place: true, count: 1, marker: null, children: ['earth'] },
      earth: { label: 'Earth', objectId: 'earth', place: false, count: 1, marker: null, children: [] },
      stars: { label: 'Stars', objectId: null, place: true, count: 1, marker: null, children: ['sirius'] },
      sirius: { label: 'Sirius', objectId: 'sirius', place: false, count: 1, marker: null, children: [] },
    },
  };
  const text = JSON.stringify(payload), sha256 = createHash('sha256').update(text).digest('hex');
  const { document, window } = parseHTML(`<div data-object-navigation-tree data-atlas-current="earth"
    data-atlas-tree-src="/navigation-tree/${sha256}.json" data-atlas-tree-sha256="${sha256}" data-atlas-tree-bytes="${Buffer.byteLength(text)}">
    <ul class="atlas-tree"><li data-atlas-item-key="root"><details data-atlas-depth="0" data-atlas-key="root" data-atlas-lazy><summary><span>Root (3)</span></summary></details></li></ul>
  </div>`);
  window.fetch = async () => new Response(text);
  const root = document.querySelector<HTMLElement>('[data-object-navigation-tree]')!;
  const controller = createNavigationTreeController(root, window as unknown as BrowserWindow);

  await controller.filter(['sirius']);
  assert.equal(root.querySelector<HTMLElement>('li[data-atlas-item-key="planets"]')?.hidden, true);
  assert.equal(root.querySelector<HTMLElement>('li[data-atlas-item-key="stars"]')?.hidden, false);
  assert.equal(root.querySelector<HTMLDetailsElement>('details[data-atlas-key="stars"]')?.open, true);

  await controller.filter(null);
  assert.equal(root.querySelector<HTMLElement>('li[data-atlas-item-key="planets"]')?.hidden, false);
  assert.equal(root.querySelector<HTMLElement>('li[data-atlas-item-key="stars"]')?.hidden, false);
  assert.equal(root.querySelector<HTMLAnchorElement>('a[data-atlas-object="earth"]')?.getAttribute('aria-current'), 'page');
  controller.destroy();
});
