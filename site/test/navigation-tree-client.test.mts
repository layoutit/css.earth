import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseHTML } from 'linkedom';
import { createNavigationTreeController } from '../navigation/navigation-tree-client.mts';
import { NAVIGATION_TREE_SCHEMA, type NavigationTreePayload } from '../../src/navigation/navigation-tree-schema.mts';
import type { BrowserWindow } from '../browser-types.mts';

test('deferred navigation materializes only the selected path from its verified payload', async () => {
  const payload: NavigationTreePayload = {
    schema: NAVIGATION_TREE_SCHEMA,
    roots: ['root'],
    nodes: {
      root: { label: 'Root', objectId: null, place: true, count: 2, marker: null, children: ['branch'], href: null, focusId: null },
      branch: { label: 'Branch', objectId: 'branch', place: false, count: 2,
        marker: { className: 'atlas-marker atlas-marker-sprite', style: '--atlas-marker-size:8px' }, children: ['leaf'], href: '/branch/', focusId: null },
      leaf: { label: 'Leaf', objectId: 'leaf', place: false, count: 1,
        marker: { className: 'atlas-marker atlas-marker-catalog', style: '' }, children: [], href: '/leaf/', focusId: null },
    },
  };
  const text = JSON.stringify(payload);
  const { document, window } = parseHTML(`<div data-object-navigation-tree data-atlas-current="old"
    data-atlas-tree-src="/navigation-tree.json">
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

test('deferred rows open the destination the payload names, and a row with none is a label', async () => {
  const payload: NavigationTreePayload = {
    schema: NAVIGATION_TREE_SCHEMA,
    roots: ['root'],
    nodes: {
      root: { label: 'Milky Way', objectId: null, place: true, count: 3, marker: null, children: ['orion', 'clusters', 'saturn'], href: null, focusId: null },
      orion: { label: 'Orion Nebula (M42)', objectId: 'm42', place: false, count: 1, marker: null, children: [], href: '/sun/?focus=m42', focusId: 'm42' },
      clusters: { label: 'Galaxy clusters', objectId: 'galaxy-clusters', place: true, count: 1, marker: null, children: [], href: null, focusId: null },
      saturn: { label: 'Saturn', objectId: 'saturn', place: false, count: 1, marker: null, children: [], href: '/saturn/', focusId: null },
    },
  };
  const text = JSON.stringify(payload);
  const { document, window } = parseHTML(`<div data-object-navigation-tree data-atlas-current="saturn"
    data-atlas-tree-src="/navigation-tree.json">
    <ul class="atlas-tree"><li><details data-atlas-depth="0" data-atlas-key="root" data-atlas-lazy><summary><span>Milky Way (3)</span></summary></details></li></ul>
  </div>`);
  window.fetch = async () => new Response(text);
  const root = document.querySelector<HTMLElement>('[data-object-navigation-tree]')!;
  const controller = createNavigationTreeController(root, window as unknown as BrowserWindow);

  await controller.select('saturn');

  const orion = root.querySelector<HTMLAnchorElement>('a[data-atlas-object="m42"]');
  assert.equal(orion?.getAttribute('href'), '/sun/?focus=m42', 'a catalogue subject opens on its host scene');
  assert.equal(orion?.dataset.preparedFocusId, 'm42', 'and is selected in place instead of navigating');
  assert.equal(root.querySelector<HTMLAnchorElement>('a[data-atlas-object="saturn"]')?.getAttribute('href'), '/saturn/');
  assert.equal(root.querySelector('a[data-atlas-object="galaxy-clusters"]'), null,
    'nothing clickable for a package the application cannot open');
  assert.equal(root.querySelector<HTMLElement>('[data-atlas-place="galaxy-clusters"]')?.textContent, 'Galaxy clusters');
  assert.equal(root.querySelectorAll('a[href]').length, 2, 'every rendered link has a destination');
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
      root: { label: 'Root', objectId: null, place: true, count: 3, marker: null, children: ['planets', 'stars'], href: null, focusId: null },
      planets: { label: 'Planets', objectId: null, place: true, count: 1, marker: null, children: ['earth'], href: null, focusId: null },
      earth: { label: 'Earth', objectId: 'earth', place: false, count: 1, marker: null, children: [], href: '/earth/', focusId: null },
      stars: { label: 'Stars', objectId: null, place: true, count: 1, marker: null, children: ['sirius'], href: null, focusId: null },
      sirius: { label: 'Sirius', objectId: 'sirius', place: false, count: 1, marker: null, children: [], href: '/sirius/', focusId: null },
    },
  };
  const text = JSON.stringify(payload);
  const { document, window } = parseHTML(`<div data-object-navigation-tree data-atlas-current="earth"
    data-atlas-tree-src="/navigation-tree.json">
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

test('a deferred selection that finishes after a newer one leaves the newer entry current', async () => {
  const payload: NavigationTreePayload = {
    schema: NAVIGATION_TREE_SCHEMA,
    roots: ['root'],
    nodes: {
      root: { label: 'Root', objectId: null, place: true, count: 1, marker: null, children: ['leaf'], href: null, focusId: null },
      leaf: { label: 'Leaf', objectId: 'leaf', place: false, count: 1, marker: null, children: [], href: '/leaf/', focusId: null },
    },
  };
  const text = JSON.stringify(payload);
  const { document, window } = parseHTML(`<div data-object-navigation-tree
    data-atlas-tree-src="/navigation-tree.json">
    <ul class="atlas-tree">
      <li><details data-atlas-depth="0" data-atlas-key="root" data-atlas-lazy><summary><span>Root (1)</span></summary></details></li>
      <li><details open data-atlas-depth="0" data-atlas-key="other-root"><summary>Other</summary><ul><li><a data-atlas-object="other">Other</a></li></ul></details></li>
    </ul>
  </div>`);
  let respond!: (response: Response) => void;
  window.fetch = () => new Promise<Response>(resolve => { respond = resolve; });
  const root = document.querySelector<HTMLElement>('[data-object-navigation-tree]')!;
  const controller = createNavigationTreeController(root, window as unknown as BrowserWindow);

  const older = controller.select('leaf');
  await controller.select('other');
  respond(new Response(text));
  await older;

  assert.equal(root.querySelector('a[data-atlas-object="other"]')?.getAttribute('aria-current'), 'page');
  assert.equal(root.querySelector('a[aria-current]:not([data-atlas-object="other"])'), null);
  controller.destroy();
});
