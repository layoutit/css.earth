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
/** Every overlay bank mounted, in order: its address, whether it was taken away, how many publications it was given and
 * the last one's opacity, whether it was told the camera coasts, where it was told its files are, and whether it was
 * retired. As the real owner (cloud-points.ts) does, one retired mid-coast is taken away when the coast ends. */
const overlays: { url: string; destroyed: boolean; published: number; opacity: number; coasting: boolean[]; retired: boolean; resolveResource(path: string): string }[] = [];
mock.module('./cloud-points.js', { namedExports: {
  mountCloudOverlay: ({ url, resolveResource }: { url: string; resolveResource(path: string): string }) => {
    const overlay = { url, destroyed: false, published: 0, opacity: NaN, coasting: [] as boolean[], retired: false, resolveResource };
    overlays.push(overlay);
    return { publish(_publication: unknown, opacity: number) { overlay.published++; overlay.opacity = opacity; },
      setCoasting(active: boolean) { overlay.coasting.push(active); if (!active && overlay.retired) overlay.destroyed = true; },
      retire() { overlay.retired = true; if (overlay.coasting.at(-1) !== true) overlay.destroyed = true; },
      destroy() { overlay.destroyed = true; } };
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

test('on a flight to a body inside it a galaxy gives way as it comes to fill the view, and a bank on walls stays', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime(), page = {};
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'galaxy', frame }, { id: 'walls', frame, surrounds: true, host: 'nebula' }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame } }) as never, billboards: { plan, imageUrl: id => `/billboards/${id}.webp` } });
  const billboard = root.querySelector<HTMLElement>('[data-dataset-billboard="galaxy"]')!;
  const look = (id: string) => { const node = root.querySelector<HTMLElement>(`[data-image-layer-object="${id}"]`)!; return node.style.display === 'none' ? 0 : Number(node.style.opacity); };
  // `flight`: a flight's destination is inside the detailed bank, whose dots then draw around it.
  const publish = (detailed: string, distance: number, flight = false) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } }, { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 },
  1, detailed, flight ? { objectId: detailed, opacity: 1 } : undefined, [], undefined, undefined, page);
  assert.deepEqual([banks.imageBankHolds('galaxy', [0, 1, 1]), banks.imageBankHolds('galaxy', [0, 0, 2])], [true, false], 'the framing sphere of these bounds has a radius of √3');
  publish('galaxy', 10);
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  publish('galaxy', 1);
  assert.equal(look('galaxy'), .999, 'on its own page the galaxy is drawn from inside too');
  publish('galaxy', 10, true);
  assert.equal(look('galaxy'), .999, 'the flight starts far out: nothing changes');
  publish('galaxy', 1.5 * Math.sqrt(3) * 1.25 ** .25, true);
  assert.ok(Math.abs(look('galaxy') - .25) < 1e-9, `a quarter of the way out of where it is gone it has a quarter of its strength, not ${look('galaxy')}`);
  assert.equal(billboard.style.display === 'none' || Number(billboard.style.opacity) === 0, true, 'and its billboard does not take its place');
  publish('galaxy', 1.5 * Math.sqrt(3), true);
  assert.equal(look('galaxy'), 0, 'it is gone at one and a half of its radius, before the camera is inside it');
  publish('walls', 10);
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '2'));
  publish('walls', 1, true);
  assert.equal(look('walls'), .999, 'walls stand around the body flown to');
  lifetime.destroy();
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

test('a plane a dataset shows draws on its prepared picture, and gives way as the camera closes on its centre', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const style = { width: '256px', height: '256px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-128,-128,0,1)', backgroundSize: '256px 256px', backgroundPosition: '0px 0px' };
  const loads: string[] = [];
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined, loadImageLayer: undefined,
    planeBanks: [{ id: 'zone', frame }],
    loadBacking: async id => { loads.push(id); return { payload: { id, frame, leaf: { texturePath: 'zone/zone.webp', style }, centreFadeM: [4, 2] as const }, resolveResource: path => `/${path}` }; } });
  const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as [number, number], widthPixels: 400, heightPixels: 300 };
  const publish = (distanceM: number, shown?: string) =>
    banks.publishPlanes({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, distanceM], orientationXyzw: [0, 0, 0, 1] } }, viewport, shown);
  assert.deepEqual(banks.focusBank('zone')?.state()?.datasets.map(dataset => dataset.id), ['plane'], 'a dataset names it as a bank of one dataset');
  publish(10);
  publish(10, 'another-bank');
  assert.deepEqual(loads, [], 'a plane no dataset shows is not read');
  publish(10, 'zone');
  await waitFor(() => assert.deepEqual(loads, ['zone'], 'read the first time a dataset shows it'));
  publish(10, 'zone');
  const plane = root.querySelector<HTMLElement>('.prepared-galaxy-backing > [data-galaxy-backing="zone"]')!;
  const opacity = () => plane.style.display === 'none' ? 0 : Number(plane.style.opacity);
  assert.equal(opacity(), 1, 'whole from beyond the far distance of its fade');
  assert.equal(plane.querySelector('img')!.getAttribute('src'), '/zone/zone.webp');
  publish(3, 'zone');
  assert.ok(opacity() > 0 && opacity() < 1, `fading between its two distances, got ${opacity()}`);
  publish(1.5, 'zone');
  assert.equal(opacity(), 0, 'gone within the near distance');
  publish(10, 'zone');
  assert.equal(opacity(), 1);
  publish(10);
  assert.equal(opacity(), 0, 'hidden once the dataset no longer shows it');
  banks.addPlaneBanks([{ id: 'zone', frame }]);
  assert.deepEqual(publish(10, 'zone'), { opacity: 1, colors: null }, 'a plane that states no orbit opacity or colors leaves the orbit lines theirs');
  assert.equal(root.querySelectorAll('[data-galaxy-backing="zone"]').length, 1, 'a known plane is not declared twice');
  // A plane that states one dims the orbit lines as far as its own picture shows, once that picture is read.
  banks.addPlaneBanks([{ id: 'wind', frame, orbitOpacity: .4 }]);
  assert.equal(publish(10, 'wind').opacity, 1, 'not before its picture is read');
  await waitFor(() => assert.deepEqual(loads, ['zone', 'wind']));
  assert.ok(Math.abs(publish(10, 'wind').opacity - .4) < 1e-12, 'whole, the orbit lines take its opacity');
  const fading = publish(3, 'wind').opacity;
  assert.ok(fading > .4 && fading < 1, `between while the picture fades, got ${fading}`);
  assert.equal(publish(1.5, 'wind').opacity, 1, 'theirs again once the picture is gone');
  assert.equal(publish(10, 'zone').opacity, 1, 'and while another plane shows');
  // A plane that states colors gives them to the orbit lines for as long as its dataset is the one shown, near or far.
  const heat = { 'planet-b': '#f0f921', 'planet-c': '#ca4579' };
  banks.addPlaneBanks([{ id: 'heat', frame, bodyColors: heat }]);
  assert.equal(publish(10, 'heat').colors, heat); assert.equal(publish(1.5, 'heat').colors, heat, 'the colors are the dataset\'s, not the picture\'s');
  assert.equal(publish(10, 'wind').colors, null); assert.equal(publish(10).colors, null);
  lifetime.destroy();
});

test("only the selected dataset's overlay banks are mounted: a pick takes the last one's away and mounts its own", async t => {
  t.after(() => { overlays.length = 0; });
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'nebula', frame, datasets: ['optical', 'outer-ejecta', 'model'] }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame }, overlayUrls: { optical: [], 'outer-ejecta': ['/ejecta.bin', '/motions.bin'], model: ['/model.bin'] } }) as never });
  const publish = () => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 'nebula');
  const live = () => overlays.filter(overlay => !overlay.destroyed).map(overlay => overlay.url);
  const focus = banks.focusBank('nebula')!;
  assert.deepEqual(focus.state()!.datasets.map(dataset => dataset.id), ['optical', 'outer-ejecta', 'model']);
  publish();
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  assert.equal(overlays.length, 0, 'the default dataset draws nothing over its layers: nothing is mounted');
  focus.selectDataset('outer-ejecta');
  assert.deepEqual(live(), ['/ejecta.bin', '/motions.bin'], "the picked dataset's banks are mounted");
  publish();
  assert.deepEqual(overlays.map(overlay => overlay.published), [1, 1], 'and drawn with the layers');
  focus.selectDataset('model');
  assert.deepEqual([live(), overlays.filter(overlay => overlay.destroyed).map(overlay => overlay.url)], [['/model.bin'], ['/ejecta.bin', '/motions.bin']],
    "another pick takes the last dataset's banks away and mounts its own");
  assert.equal(banks.focusBank('nebula')!.state()!.selectedDataset, 'model', 'a focus bank asked for again shows the dataset the bank shows');
  focus.selectDataset('optical');
  assert.deepEqual(live(), [], 'back on a dataset with none, nothing is drawn over the layers');
  lifetime.destroy();
});

test('a dataset picked before its bank loads mounts its overlays when the bank does, and the scene takes them away', async t => {
  t.after(() => { overlays.length = 0; });
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'nebula', frame, datasets: ['optical', 'outer-ejecta'] }, { id: 'plain', frame }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame }, ...(id === 'nebula' ? { overlayUrls: { optical: [], 'outer-ejecta': ['/ejecta.bin'] } } : {}) }) as never });
  const publish = (detailed: string) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, detailed);
  banks.focusBank('nebula')!.selectDataset('outer-ejecta');
  assert.equal(overlays.length, 0, 'nothing mounts before the bank does');
  publish('nebula');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '1'));
  assert.deepEqual(overlays.map(overlay => [overlay.url, overlay.destroyed]), [['/ejecta.bin', false]]);
  assert.deepEqual(banks.focusBank('plain')!.state()!.datasets.map(dataset => dataset.id), ['optical'], 'a bank without overlays has its one dataset');
  publish('plain');
  await waitFor(() => assert.equal(root.dataset.imageLayerResidentBankCount, '2'));
  assert.equal(overlays.length, 1, 'and mounts nothing over its layers');
  lifetime.destroy();
  assert.deepEqual(overlays.map(overlay => overlay.destroyed), [true], 'the scene takes the overlays with it');
});

test("an overlay finds its files where its bank's are, is told when the camera coasts, and is told to hide when its bank stops showing", async t => {
  t.after(() => { overlays.length = 0; });
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'nebula', frame, datasets: ['outer-ejecta'] }, { id: 'other', frame }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame }, resolveResource: (path: string) => `https://assets.example/${id}-files/${path}`,
      overlayUrls: { 'outer-ejecta': ['/ejecta.bin'] } }) as never });
  const publish = (detailed: string) => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, detailed);
  banks.setCoasting(true);
  publish('nebula');
  await waitFor(() => assert.equal(overlays.length, 1));
  const [overlay] = overlays;
  assert.equal(overlay!.resolveResource('ejecta-atlas.webp'), 'https://assets.example/nebula-files/ejecta-atlas.webp', "its atlas is found through its bank's resolver");
  assert.deepEqual(overlay!.coasting, [true], 'mounted mid-coast, it knows the camera coasts');
  banks.setCoasting(false);
  assert.deepEqual(overlay!.coasting, [true, false], 'and is told when the coast ends');
  publish('nebula');
  assert.ok(overlay!.opacity > 0, 'shown with its bank');
  publish('other');
  assert.equal(overlay!.opacity, 0, 'another object selected, it is told to hide (its owner then takes it off the page)');
  lifetime.destroy();
});

test("a dataset left mid-coast keeps its overlays until the coast ends, then they are taken away; the scene takes any still waiting", async t => {
  t.after(() => { overlays.length = 0; });
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    declarations: [{ id: 'nebula', frame, datasets: ['outer-ejecta', 'model', 'optical'] }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async id => ({ payload: { id, frame }, resolveResource: (path: string) => path, overlayUrls: { 'outer-ejecta': ['/ejecta.bin'], model: ['/model.bin'], optical: [] } }) as never });
  banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 'nebula');
  await waitFor(() => assert.equal(overlays.length, 1));
  const focus = banks.focusBank('nebula')!, [ejecta] = overlays;
  banks.setCoasting(true);
  focus.selectDataset('model');
  assert.deepEqual([ejecta!.retired, ejecta!.destroyed], [true, false], 'picked away mid-coast, it is retired and stays until the coast ends');
  banks.setCoasting(false);
  assert.equal(ejecta!.destroyed, true, 'the coast ends: it is taken away');
  const model = overlays[1]!;
  focus.selectDataset('optical');
  assert.deepEqual([model.retired, model.destroyed], [true, true], 'picked away with the camera still: taken away at once');
  focus.selectDataset('model');
  const again = overlays[2]!;
  banks.setCoasting(true);
  focus.selectDataset('optical');
  assert.equal(again.destroyed, false);
  lifetime.destroy();
  assert.equal(again.destroyed, true, 'the scene takes an overlay still waiting for the coast to end');
});

test('a host can hide a selected image bank and restore its retained slices', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  let hidden = false;
  const banks = createUniverseCatalogBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, stage: root, lifetime,
    catalogBank: undefined, loadCatalog: undefined,
    hidden: id => hidden && id === 'galaxy', declarations: [{ id: 'galaxy', frame }], initialImages: new Map(), volumeDeclarations: [],
    loadImageLayer: async () => ({ payload: { id: 'galaxy', frame } }) as never });
  await banks.focusBank('galaxy')!.load();
  const publish = () => banks.publishImages({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 'galaxy');
  const node = root.querySelector<HTMLElement>('[data-image-layer-object="galaxy"]')!;
  publish(); assert.equal(node.style.opacity, '0.999');
  hidden = true; publish(); assert.equal(node.style.opacity, '0');
  hidden = false; publish(); assert.equal(node.style.opacity, '0.999');
  lifetime.destroy();
});
