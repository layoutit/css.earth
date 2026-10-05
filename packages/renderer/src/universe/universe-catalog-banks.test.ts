import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { waitFor } from '@cssearth/objects/node/contract';

/** Whether each mounted bank's last drawing was around a body (the runtime's second argument). */
const drawnAround: boolean[] = [];
mock.module('../image-layers/prepared-image-layer-runtime.js', { namedExports: {
  mountPreparedCssImageLayers: ({ host, before }: { host: HTMLElement; before: Element }) => {
    const root = host.ownerDocument.createElement('div');
    host.insertBefore(root, before);
    return { root, ceiling: 0.999, publish(_publication: unknown, around: readonly number[] | false = false) { drawnAround.push(around !== false); }, resume() {}, destroy() { root.remove(); } };
  },
} });
// The modules under test import the mocked ones, so they load after the mocks.
const { createUniverseCatalogBanks } = await import('./universe-catalog-banks.js');
const { parseDatasetBillboards } = await import('@cssearth/objects');

const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const plan = parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@2', imagePx: 256,
  banks: [{ id: 'galaxy', contextVisibility: 'galactic', attached: false,
    billboard: { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, 1, 0] } }] });

test('a galaxy drawn from image layers shows its billboard from afar and hands it to its slices once they load', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [{ id: 'galaxy', frame }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async () => ({ payload: { id: 'galaxy', frame } }) as never, billboards: { plan, imageUrl: id => `/billboards/${id}.webp` } });
  const billboard = root.querySelector<HTMLElement>('[data-dataset-billboard="galaxy"]')!;
  const publish = (volumeOpacity: number, detailed?: string) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, volumeOpacity, detailed);
  publish(0);
  assert.notEqual(billboard.style.display, 'block', 'inside the Milky Way the sky shows it, as a galactic dataset billboard');
  publish(1);
  assert.deepEqual(([billboard.style.display, Number(billboard.style.opacity)]), ['block', 1], 'from outside the Milky Way the galaxy shows');
  publish(1, 'galaxy');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  publish(1, 'galaxy');
  assert.equal((billboard.style.display === 'none' || Number(billboard.style.opacity) === 0), true, 'its loaded slices replace the billboard');
});

test('a bank whose light lies on walls draws around a body inside its host, the first declared for that host; a photograph never does', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'photograph', frame, host: 'galaxy' }, { id: 'walls', frame, surrounds: true, host: 'nebula' }, { id: 'walls-infrared', frame, surrounds: true, host: 'nebula' }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame } }) as never });
  // The camera stands inside every bank's framing sphere; `within` is what the selected body is inside, by the object tree.
  const publish = (within: readonly string[]) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, .5], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, undefined, undefined, within, [0, 0, 0]);
  const layers = () => [...root.children].filter(node => node.tagName === 'DIV') as HTMLElement[];
  publish(['galaxy', 'local-group']);
  assert.deepEqual([layers().length, root.dataset.imageLayerResidentBankCount ?? '0'], [0, '0'], 'a photograph seen from outside is not drawn around a star inside its galaxy');
  publish(['nebula', 'milky-way']);
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  publish(['nebula', 'milky-way']);
  assert.deepEqual([layers().length, layers()[0]!.style.display, Number(layers()[0]!.style.opacity)], [1, '', 0.999],
    'the first wall bank declared for the host draws whole around the body inside it');
  assert.equal(drawnAround.at(-1), true, 'and is told where the body it is drawn around stands, so the sheets through it and under the camera are left out');
  publish([]);
  assert.equal(layers()[0]!.style.display, 'none', 'around a body inside no such host nothing draws');
});

test('a package of catalogue dots mounts them when its row is selected, and hides them when another is', () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined, loadImageLayer: undefined,
    pointBanks: [{ id: 'cluster', url: '/cluster/dots.bin' }] });
  const publish = (selected?: string) => banks.publishPoints({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, selected);
  const layer = () => root.querySelector<HTMLElement>('[data-catalogue-points]');
  publish();
  assert.equal(layer(), null, 'nothing is mounted or fetched before its row is selected');
  publish('cluster');
  assert.equal(layer()?.style.display, '', 'selected, its dots draw');
  publish('another');
  assert.equal(layer()?.style.display, 'none', 'another selection hides them and keeps them mounted');
  lifetime.destroy();
  assert.equal(layer(), null, 'the scene takes them with it');
});

test('a bank that belongs to a body draws while that body or one of its system is selected', () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined, loadImageLayer: undefined,
    pointBanks: [{ id: 'minor-moons', url: '/minor-moons/dots.bin', host: 'planet' }] });
  const publish = (...system: string[]) => banks.publishPoints({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, undefined, system);
  const layer = () => root.querySelector<HTMLElement>('[data-catalogue-points]');
  publish('elsewhere');
  assert.equal(layer(), null, 'nothing is mounted or fetched while another system is selected');
  publish('planet');
  assert.equal(layer()?.style.display, '', 'its host selected, the dots draw');
  publish('moon', 'planet');
  assert.equal(layer()?.style.display, '', 'a body that orbits the host selected, they stay');
  publish('elsewhere', 'star');
  assert.equal(layer()?.style.display, 'none', 'another system hides them');
  lifetime.destroy();
});

test('a bank of plain-dot stars draws while the selected body is inside its host, dimmed as the other stars are', () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined, loadImageLayer: undefined,
    pointBanks: [{ id: 'cloud/plain-stars', url: '/world/dots/cloud.bin', host: 'cloud', stars: true }, { id: 'group-members', url: '/group/dots.bin', host: 'group' }] });
  let asked = 0;
  // The selected body, then the objects it is inside as the host read them from the object tree.
  const publish = (selected: string, ...inside: string[]) => banks.publishPoints({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, undefined, [selected], { inside, look: () => { asked++; return { opacity: .5, hiddenAtM: [] }; } });
  const layer = () => root.querySelector<HTMLElement>('[data-catalogue-points]');
  publish('sun');
  assert.equal(layer(), null, 'a page outside the object never asks for its dots');
  assert.equal(asked, 0);
  publish('cepheid', 'cepheid-system', 'cloud', 'group');
  assert.equal(layer()?.style.display, '', 'a star inside it selected, the dots draw');
  assert.equal(asked, 1, 'and take the look every star dot has');
  assert.equal(root.querySelectorAll('[data-catalogue-points]').length, 1, 'a bank of members draws for its host and its system only, not for what is inside it');
  publish('cloud', 'group');
  assert.equal(layer()?.style.display, '', 'the object itself selected, they stay');
  publish('sun');
  assert.equal(layer()?.style.display, 'none', 'outside it they hide');
  assert.equal(asked, 2);
  lifetime.destroy();
});

test('a package of catalogue dots declared after mount draws while its host is selected, mounted once', () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined, loadImageLayer: undefined });
  const publish = (...system: string[]) => banks.publishPoints({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
  { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, undefined, system);
  assert.equal(banks.focusBank('minor-moons'), null, 'unknown before its host brings it');
  banks.addPointBanks([{ id: 'minor-moons', url: '/minor-moons/dots.bin', host: 'planet' }]);
  banks.addPointBanks([{ id: 'minor-moons', url: '/minor-moons/dots.bin', host: 'planet' }]);
  assert.notEqual(banks.focusBank('minor-moons'), null);
  publish('moon', 'planet');
  assert.equal(root.querySelectorAll('[data-catalogue-points]').length, 1, 'mounted once, drawn for a body of its host');
  lifetime.destroy();
  assert.equal(root.querySelector('[data-catalogue-points]'), null);
});
