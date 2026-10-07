import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { waitFor } from '@cssearth/objects/node/contract';

/** Whether each mounted bank's last drawing was around a body (the runtime's second argument). */
const drawnAround: boolean[] = [];
/** The banks whose images are still decoding, by id, and what each mounted bank was given to say that it draws. */
const decoding = new Set<string>(), drawn = new Map<string, () => void>();
/** The banks told that their root is shown again, in order. */
const resumed: string[] = [];
mock.module('../image-layers/prepared-image-layer-runtime.js', { namedExports: {
  mountPreparedCssImageLayers: ({ host, before, payload, onDrawn }: { host: HTMLElement; before: Element; payload: { id: string }; onDrawn?: () => void }) => {
    const root = host.ownerDocument.createElement('div');
    root.dataset.imageLayerObject = payload.id;
    host.insertBefore(root, before);
    drawn.set(payload.id, () => { decoding.delete(payload.id); onDrawn?.(); });
    return { root, drawing: () => !decoding.has(payload.id), publish(_publication: unknown, around: readonly number[] | false = false) { drawnAround.push(around !== false); }, resume() { resumed.push(payload.id); }, destroy() { root.remove(); } };
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

test("a host's other bank gives its billboard way to the bank selected for that host, and another host's billboard stays", async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime(), billboard = { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, 1, 0] };
  const both = parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@2', imagePx: 256, banks: ['picture', 'gas', 'elsewhere'].map(id => ({ id, contextVisibility: 'galactic', attached: false, billboard })) });
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'picture', frame, host: 'cluster' }, { id: 'gas', frame, surrounds: true, host: 'cluster' }, { id: 'elsewhere', frame, host: 'other-cluster' }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame } }) as never, billboards: { plan: both, imageUrl: id => `/billboards/${id}.webp` } });
  const shown = (id: string) => { const node = root.querySelector<HTMLElement>(`[data-dataset-billboard="${id}"]`)!; return node.style.display === 'block' && Number(node.style.opacity) > 0; };
  const publish = (detailed?: string) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, detailed);
  publish();
  assert.deepEqual([shown('picture'), shown('gas'), shown('elsewhere')], [true, true, true], 'with no bank selected every billboard shows');
  publish('gas');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  publish('gas');
  assert.deepEqual([shown('picture'), shown('gas'), shown('elsewhere')], [false, false, true], "the selected bank's slices stand for the cluster: neither of its billboards shows");
});

test("a bank's billboard stays until the bank draws, and a bank that stands in is drawn as the detailed one is", async t => {
  decoding.add('picture').add('gas'); t.after(() => { decoding.clear(); });
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime(), billboard = { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, 1, 0] };
  const plan = parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@2', imagePx: 256, banks: ['picture', 'gas'].map(id => ({ id, contextVisibility: 'galactic', attached: false, billboard })) });
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'picture', frame, host: 'cluster' }, { id: 'gas', frame, host: 'cluster' }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame } }) as never, billboards: { plan, imageUrl: id => `/billboards/${id}.webp` } });
  const billboardShown = (id: string) => { const node = root.querySelector<HTMLElement>(`[data-dataset-billboard="${id}"]`)!; return node.style.display === 'block' && Number(node.style.opacity) > 0; };
  const bankShown = (id: string) => { const node = root.querySelector<HTMLElement>(`[data-image-layer-object="${id}"]`); return node !== null && node.style.display !== 'none'; };
  const publish = (detailed: string, standIn?: string) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, detailed, undefined, [], undefined, standIn);
  publish('picture');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  publish('picture');
  assert.deepEqual([bankShown('picture'), billboardShown('picture'), banks.drawing('picture')], [true, true, false], 'mounted, its images still decoding: the billboard is all there is to see');
  drawn.get('picture')!(); publish('picture');
  assert.deepEqual([bankShown('picture'), billboardShown('picture'), banks.drawing('picture')], [true, false, true], 'it draws: the billboard gives way');
  // Another dataset of the same host is picked: its bank mounts and decodes while the one drawn before stands in.
  publish('gas', 'picture');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '2'));
  publish('gas', 'picture');
  assert.deepEqual([bankShown('picture'), bankShown('gas'), billboardShown('picture'), billboardShown('gas'), banks.drawing('gas')], [true, true, false, false, false], 'no billboard shows over the stand-in');
  drawn.get('gas')!(); publish('gas');
  assert.deepEqual([bankShown('picture'), bankShown('gas'), billboardShown('gas'), banks.drawing('gas')], [false, true, false, true], 'the picked bank draws: the stand-in is no longer asked for');
  lifetime.destroy();
});

test('the bank last drawn for the selected body stays in layout at opacity 0, and leaves it when the body changes', async t => {
  t.after(() => { resumed.length = 0; });
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime(), asked = mock.fn(() => true);
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, requestPublication: asked,
    declarations: ['first', 'second', 'third'].map(id => ({ id, frame, host: 'nebula' })), initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame } }) as never });
  const nebula = {}, elsewhere = {};
  const look = (id: string) => { const node = root.querySelector<HTMLElement>(`[data-image-layer-object="${id}"]`); return node ? `${node.style.display || 'in'}/${node.style.opacity}` : 'unmounted'; };
  const publish = (detailed: string | undefined, subject: unknown) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, detailed, undefined, [], undefined, undefined, subject);
  const visit = async (id: string, mounted: number) => { publish(id, nebula); await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, String(mounted))); publish(id, nebula); };
  await visit('first', 1);
  await visit('second', 2);
  assert.deepEqual([look('first'), look('second')], ['in/0', 'in/0.999'], 'the dataset shown before stays in layout, unseen');
  const requests = asked.mock.callCount();
  resumed.length = 0;
  publish('first', nebula);
  assert.deepEqual([look('first'), look('second'), resumed], ['in/0.999', 'in/0', []], 'gone back to, it is shown as it was: no layer is made again and no decode waited for');
  assert.equal(asked.mock.callCount(), requests + 1, 'and who waits for it to draw is told');
  await visit('third', 3);
  assert.deepEqual([look('first'), look('second'), look('third')], ['in/0', 'none/0', 'in/0.999'], 'one bank is kept: the one before it leaves layout');
  publish(undefined, elsewhere);
  assert.deepEqual([look('first'), look('third')], ['none/0', 'none/0'], 'another body selected: nothing of this one stays in layout');
  resumed.length = 0;
  publish('first', nebula);
  assert.deepEqual([look('first'), resumed], ['in/0.999', ['first']], 'out of layout, it is shown again as a bank first shown is');
  lifetime.destroy();
});

test('a picture with dots of its own mounts under the dot layer, one with none just over it', async () => {
  const { document } = parseHTML('<div id="root"><span id="under"></span><b id="dots"></b><span id="over"></span><span id="end"></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: document.getElementById('end')!, stage: root, lifetime,
    imagesBefore: document.getElementById('under')!, picturesBefore: document.getElementById('over')!,
    declarations: [{ id: 'photograph', frame, host: 'galaxy' }, { id: 'walls', frame, host: 'nebula' }],
    pointBanks: [{ id: 'galaxy/plain-stars', url: '/dots.bin', host: 'galaxy', stars: true }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame } }) as never });
  const publish = (detailed: string) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 3], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, detailed);
  publish('photograph'); publish('walls');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '2'));
  assert.deepEqual([...root.children].map(node => (node as HTMLElement).dataset.imageLayerObject ?? node.id), ['photograph', 'under', 'dots', 'walls', 'over', 'end'],
    'the galaxy with stars of its own lies under the dots, the nebula over them');
  lifetime.destroy();
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

test('a nebula with a backing is drawn from afar on that one fixed plane, never on a billboard, and hands it to its slices', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const style = { width: '256px', height: '256px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-128,-128,0,1)', backgroundSize: '256px 256px', backgroundPosition: '0px 0px' };
  const backed = parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@2', imagePx: 256, banks: [{ id: 'nebula', contextVisibility: 'galactic', attached: false, backing: true }] });
  const loads: string[] = [];
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [{ id: 'nebula', frame }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async () => ({ payload: { id: 'nebula', frame } }) as never, billboards: { plan: backed, imageUrl: id => `/billboards/${id}.webp` },
    loadBacking: async id => { loads.push(id); return { payload: { id: 'backing', frame, leaf: { texturePath: 'backing/backing.webp', style } }, resolveResource: path => `/${path}` }; } });
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as [number, number], widthPixels: 400, heightPixels: 300 };
  const publish = (positionM: [number, number, number], orientationXyzw: [number, number, number, number], detailed?: string) =>
    banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM, orientationXyzw } }, viewport, 1, detailed);
  const front = (detailed?: string) => publish([0, 0, 10], [0, 0, 0, 1], detailed), side = () => publish([10, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  front();
  await waitFor(() => assert.deepEqual(loads, ['nebula'], 'read the first time it shows from afar'));
  front();
  assert.equal(root.querySelector('[data-dataset-billboard]'), null, 'no camera-facing billboard');
  const plane = root.querySelector<HTMLElement>('.prepared-galaxy-backing > [data-galaxy-backing="nebula"]')!;
  const image = plane.querySelector('img')!, scene = plane.querySelector<HTMLElement>('.css-volume-scene')!;
  assert.equal(plane.querySelectorAll('*').length + 1, 5, 'projection, camera, scene, mesh and one image');
  const shown = () => plane.style.display !== 'none' && Number(plane.style.opacity) > 0;
  assert.equal(shown(), true);
  assert.equal(image.getAttribute('src'), '/backing/backing.webp');
  // Orbiting turns the scene, the plane's one transform for the camera; the image stays where the bake laid it.
  const facing = scene.style.transform;
  side();
  assert.equal(image.style.transform, style.transform, 'the plane is fixed in the bank\'s frame');
  assert.notEqual(scene.style.transform, facing, 'the camera moved around it');
  // Selected and loaded, its slices replace the plane.
  front('nebula');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  front('nebula');
  assert.equal(shown(), false, 'its loaded slices replace the plane');
  lifetime.destroy();
  assert.equal(root.querySelector('.prepared-galaxy-backing'), null, 'the scene takes its plane with it');
});
