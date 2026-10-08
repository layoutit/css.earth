import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import type { PreparedVolumeDatasets } from '@cssearth/objects';

const decode = { ready: true, pending: new Set<string>(), undrawn: 0 };
mock.module('../volume/volume-texture-readiness.js', { namedExports: {
  createVolumeTextureReadiness: () => ({ ready: (urls: readonly string[]) => decode.ready && urls.every(url => !decode.pending.has(url)),
    decoded: (url: string) => decode.ready && !decode.pending.has(url), undrawn() { decode.undrawn++; }, destroy() {} }),
} });
mock.module('../volume/prepared-volume-datasets.js', { namedExports: {
  createPreparedVolumeDatasets: ({ payload }: { payload: PreparedVolumeDatasets }) => ({ payload,
    mount: ({ host, before, frontHost, frontBefore }: { host: HTMLElement; before: Element; frontHost: HTMLElement; frontBefore: Element }) => {
      const root = host.ownerDocument.createElement('div'), frontRoot = host.ownerDocument.createElement('div');
      host.insertBefore(root, before); frontHost.insertBefore(frontRoot, frontBefore);
      let selectedDataset = payload.defaultDataset, staged: string | null = null;
      return { root, frontRoot, textureUrls: (_publication: unknown, _approaching?: boolean, id = selectedDataset) => [`/${id}.webp`],
        publish() {}, setStarsVisible() {}, destroy() { root.remove(); frontRoot.remove(); }, read: async () => {}, stagedDataset: () => staged,
        selectDataset(id: string, stage = false) { staged = stage && id !== selectedDataset ? id : null; if (!staged) selectedDataset = id; },
        state: () => ({ selectedDataset }) };
    },
  }),
} });
// The modules under test import the mocked ones, so they load after the mocks.
const { createUniverseDatasetBanks } = await import('./universe-dataset-banks.js');
afterEach(() => { decode.ready = true; decode.pending.clear(); decode.undrawn = 0; });
const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const,
  localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const visibility = { hiddenBelowRadiusPixels: 1, fullAboveRadiusPixels: 2 };
const payload: PreparedVolumeDatasets = { schema: 'cssearth-volume-datasets@1', id: 'fixture', defaultDataset: 'optical',
  framingRadiusUnits: 1, pointVisibility: visibility, datasets: [{ id: 'optical', label: 'Optical', title: 'Optical',
    stars: { frame, points: [] }, description: 'Fixture', sourceUrl: 'https://example.org', brightness: { overall: 1, x: 1, y: 1, z: 1 },
    volume: { schema: 'cssearth-css-volume@1', id: 'fixture', frame, stacks: [], resources: [], provenance: {}, approximation: {} } }] };
async function fixture(attached = false) {
  const { document } = parseHTML('<div id="back"><span></span></div><div id="front"><span></span></div>');
  const root = document.getElementById('back')!, frontRoot = document.getElementById('front')!;
  const lifetime = createSceneLifetime();
  const banks = createUniverseDatasetBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, frontRoot, frontEnd: frontRoot.firstElementChild!,
    lifetime, declarations: [{ id: 'fixture', frame }], facts: [{ id: 'fixture', contextVisibility: 'independent', attached }],
    frame, visibility, warmDomNodeBudget: 10000, load: async () => ({ payload, resolveResource: path => path }) });
  await banks.focusBank('fixture')!.load();
  const targets = [root.firstElementChild!, frontRoot.firstElementChild!] as HTMLElement[];
  if (attached) banks.setEnabled('fixture', true);
  const publish = (bodyContextOpacity = 1, detailedObjectId?: string, flight?: { toM: readonly number[]; closeUp: number }, distance = 10) => banks.publish({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 1, detailedObjectId, bodyContextOpacity, undefined, flight);
  return { banks, targets, publish, lifetime };
}

for (const stillCoasting of [true, false]) test(`a resident bank recovers after a decode gap; still coasting=${stillCoasting}`, async () => {
  const f = await fixture();
  f.publish();
  for (const root of f.targets) assert.equal(root.style.opacity, '0.999', 'in full view a bank stays just under opaque: its root never crosses opacity 1');
  f.banks.setCoasting(true); decode.ready = false; f.publish();
  for (const root of f.targets) { assert.equal(root.style.opacity, '0'); assert.equal(root.style.display, 'block'); }
  f.banks.setCoasting(stillCoasting); decode.ready = true; f.publish();
  for (const root of f.targets) { assert.equal(root.style.opacity, '0.999'); assert.equal(root.style.display, 'block'); }
  f.lifetime.destroy();
});

test('a dataset picked on a bank on screen replaces the one shown once its images are decoded and the coast has stopped', async () => {
  const f = await fixture(), shown = () => f.banks.focusBank('fixture')!.state()!.selectedDataset;
  f.publish();
  decode.pending.add('/dust.webp');
  f.banks.select('fixture', 'dust'); f.publish();
  assert.equal(shown(), 'optical', 'the bank keeps its dataset while the next one decodes');
  for (const root of f.targets) { assert.equal(root.style.opacity, '0.999'); assert.equal(root.style.display, 'block'); }
  decode.pending.clear(); f.banks.setCoasting(true); f.publish();
  assert.equal(shown(), 'optical', 'a change of images waits for the coast to stop');
  f.banks.setCoasting(false); f.publish();
  assert.equal(shown(), 'dust');
  for (const root of f.targets) { assert.equal(root.style.opacity, '0.999'); assert.equal(root.style.display, 'block'); }
  // With nothing of the shown dataset on screen there is nothing to keep.
  decode.ready = false; f.publish();
  f.banks.select('fixture', 'optical'); f.publish();
  assert.equal(shown(), 'optical');
  f.lifetime.destroy();
});

test('a bank that leaves layout says its images are no longer drawn, so that they are decoded again before it shows', async () => {
  const f = await fixture();
  f.publish();
  assert.equal(decode.undrawn, 0);
  f.banks.setCoasting(true); f.publish(0);
  for (const root of f.targets) assert.equal(root.style.display, 'block', 'a coast keeps it in layout, at opacity 0');
  assert.equal(decode.undrawn, 0);
  f.banks.setCoasting(false); f.publish(0);
  for (const root of f.targets) assert.equal(root.style.display, 'none');
  assert.ok(decode.undrawn > 0);
  f.lifetime.destroy();
});

test('hidden banks wait for coast to stop; steady publication writes no styles', async () => {
  const f = await fixture();
  decode.ready = false; f.publish();
  f.banks.setCoasting(true); decode.ready = true; f.publish();
  for (const root of f.targets) assert.equal(root.style.display, 'none');
  f.banks.setCoasting(false); f.publish();
  for (const root of f.targets) { assert.equal(root.style.opacity, '0.999'); assert.equal(root.style.display, 'block'); }
  const writes = f.targets.map(root => {
    const opacity = mock.fn(() => {}), display = mock.fn(() => {});
    Object.defineProperty(root.style, 'opacity', { get: () => '1', set: opacity });
    Object.defineProperty(root.style, 'display', { get: () => 'block', set: display });
    return { opacity, display };
  });
  f.publish();
  for (const write of writes) { assert.equal(write.opacity.mock.callCount(), 0); assert.equal(write.display.mock.callCount(), 0); }
  f.lifetime.destroy();
});

test('close-ups suppress distant banks while attached shells and the selected nebula remain visible', async () => {
  const distant = await fixture();
  distant.publish(0);
  for (const node of distant.targets) assert.equal(node.style.display, 'none');
  distant.publish(.5);
  for (const node of distant.targets) assert.equal(node.style.opacity, '0.5');
  distant.publish(0, 'fixture');
  for (const node of distant.targets) assert.equal(node.style.opacity, '0.999');
  // On a flight to a body inside the selected bank, the bank gives way as it comes to fill the view. A flight to a body
  // outside it leaves it whole until that body's close-up, where its page draws no distant cloud.
  distant.publish(0, 'fixture', { toM: [0, 0, 0], closeUp: 1 });
  for (const node of distant.targets) assert.equal(node.style.opacity, '0.999');
  distant.publish(0, 'fixture', { toM: [0, 0, 0], closeUp: 1 }, 1.2);
  for (const node of distant.targets) assert.equal(node.style.display === 'none' || node.style.opacity === '0', true);
  distant.publish(0, 'fixture', { toM: [0, 0, 50], closeUp: 1 }, 1.2);
  for (const node of distant.targets) assert.equal(node.style.opacity, '0.999');
  distant.publish(0, 'fixture', { toM: [0, 0, 50], closeUp: .5 }, 1.2);
  for (const node of distant.targets) assert.equal(node.style.opacity, '0.5');
  distant.lifetime.destroy();
  const attached = await fixture(true);
  attached.publish(0);
  for (const node of attached.targets) assert.equal(node.style.opacity, '0.999');
  attached.lifetime.destroy();
});

test('a bank declared after mount is drawn and loaded as one declared with it, its billboard in the same layer', async () => {
  const { document } = parseHTML('<div id="back"><span></span></div><div id="front"><span></span></div>');
  const root = document.getElementById('back')!, frontRoot = document.getElementById('front')!, lifetime = createSceneLifetime();
  const billboard = { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, 1, 0] } as const;
  const plan = { imagePx: 256, banks: new Map() };
  const loads: string[] = [];
  const banks = createUniverseDatasetBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, frontRoot, frontEnd: frontRoot.firstElementChild!,
    lifetime, declarations: [{ id: 'early', frame }], facts: [{ id: 'early', contextVisibility: 'independent', attached: false, billboard }],
    frame, visibility, warmDomNodeBudget: 10000, billboards: { plan, imageUrl: (id: string) => `/billboards/${id}.webp` },
    load: async id => { loads.push(id); return { payload: { ...payload, id }, resolveResource: path => path }; } });
  assert.equal(banks.focusBank('late'), null, 'unknown before its host brings it');
  banks.declare({ id: 'late', frame }, { id: 'late', contextVisibility: 'independent', attached: true, billboard });
  banks.declare({ id: 'late', frame }, { id: 'late', contextVisibility: 'independent', attached: true });
  assert.equal(root.dataset.volumeDatasetDeclaredBankCount, '2', 'declared once');
  const layers = root.querySelectorAll('.prepared-dataset-billboards');
  assert.equal(layers.length, 1, 'its billboard joins the layer the mount made');
  assert.deepEqual([...layers[0]!.children].map(node => (node as HTMLElement).dataset.datasetBillboard), ['early', 'late']);
  await banks.focusBank('late')!.load();
  assert.deepEqual(loads, ['late'], 'loaded through the same loader, on demand');
  assert.equal(root.dataset.volumeDatasetResidentBankCount, '1');
  lifetime.destroy();
  assert.equal(root.querySelectorAll('.prepared-dataset-billboards').length, 0, 'the scene takes its billboard with it');
});

test("a bank's billboard pictures the dataset its host selected, not the bank's default", async () => {
  const { document } = parseHTML('<div id="back"><span></span></div><div id="front"><span></span></div>');
  const root = document.getElementById('back')!, frontRoot = document.getElementById('front')!, lifetime = createSceneLifetime();
  const billboard = { radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, 1, 0] } as const;
  const dust = { ...payload.datasets[0]!, id: 'dust' };
  const banks = createUniverseDatasetBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, frontRoot, frontEnd: frontRoot.firstElementChild!,
    lifetime, declarations: [{ id: 'shell', frame }], frame, visibility: { hiddenBelowRadiusPixels: 30, fullAboveRadiusPixels: 60 }, warmDomNodeBudget: 10000,
    facts: [{ id: 'shell', contextVisibility: 'independent', attached: true, billboard, defaultDataset: 'optical', datasets: new Map([['dust', billboard]]) }],
    billboards: { plan: { imagePx: 256, banks: new Map() }, imageUrl: (id, dataset) => `/billboards/${dataset === undefined ? id : `${id}.${dataset}`}.webp` },
    load: async () => ({ payload: { ...payload, id: 'shell', attachedTo: 'host', datasets: [...payload.datasets, dust] }, resolveResource: path => path }) });
  const leaf = root.querySelector<HTMLElement>('[data-dataset-billboard="shell"]')!;
  // The framing sphere projects to 10 px: under the bank's own threshold, so its billboard stands for it.
  const publish = () => banks.publish({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 1);
  banks.setEnabled('shell', true);
  banks.select('shell', 'dust');
  publish();
  assert.equal(leaf.style.backgroundImage, 'url("/billboards/shell.dust.webp")', 'before the bank has loaded');
  await banks.focusBank('shell')!.load();
  publish();
  assert.equal(leaf.style.backgroundImage, 'url("/billboards/shell.dust.webp")');
  banks.select('shell', 'optical');
  publish();
  assert.equal(leaf.style.backgroundImage, 'url("/billboards/shell.webp")');
  lifetime.destroy();
});

test('a bank that stands in for the detailed one is drawn as the detailed one is, and says whether it draws', async () => {
  const f = await fixture();
  const publish = (standIn?: string) => f.banks.publish({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 0, 'picked', 1, standIn);
  // Another bank of the body is detailed: inside its close-up this one is out of the picture.
  publish();
  for (const root of f.targets) assert.equal(root.style.display, 'none');
  assert.equal(f.banks.drawing('fixture'), false);
  publish('fixture');
  for (const root of f.targets) assert.deepEqual([root.style.display, root.style.opacity], ['block', '0.999']);
  assert.equal(f.banks.drawing('fixture'), true);
  decode.ready = false; publish('fixture');
  assert.equal(f.banks.drawing('fixture'), false, 'its own images gone, it draws nothing');
  f.lifetime.destroy();
});

test('a bank with a backing is drawn from afar on that one fixed plane, picturing the selected dataset, never on a billboard', async () => {
  const { document } = parseHTML('<div id="back"><span></span></div><div id="front"><span></span></div>');
  const root = document.getElementById('back')!, frontRoot = document.getElementById('front')!, lifetime = createSceneLifetime();
  const style = { width: '128px', height: '128px', transform: 'matrix3d(0,-1,0,0,-1,0,0,0,0,0,1,0,64,64,0,1)', backgroundSize: '128px 128px', backgroundPosition: '0px 0px' };
  const backing = { id: 'backing', frame, leaf: { texturePath: 'optical/impostors/view-00n.png', style },
    datasets: new Map([['optical', 'optical/impostors/view-00n.png'], ['dust', 'dust/impostors/view-00n.png']]) };
  const loads: string[] = [];
  const banks = createUniverseDatasetBanks({ prepareBillboardImage: () => true, root, end: root.firstElementChild!, frontRoot, frontEnd: frontRoot.firstElementChild!,
    lifetime, declarations: [{ id: 'cloud', frame }], frame, visibility: { hiddenBelowRadiusPixels: 30, fullAboveRadiusPixels: 60 }, warmDomNodeBudget: 10000,
    facts: [{ id: 'cloud', contextVisibility: 'independent', attached: false, backing: true }],
    billboards: { plan: { imagePx: 256, banks: new Map() }, imageUrl: id => `/billboards/${id}.webp` },
    load: async () => ({ payload: { ...payload, id: 'cloud', datasets: [...payload.datasets, { ...payload.datasets[0]!, id: 'dust' }] }, resolveResource: path => path }),
    loadBacking: async id => { loads.push(id); return { payload: backing, resolveResource: path => `/${path}` }; } });
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as [number, number], widthPixels: 400, heightPixels: 300 };
  // The bounding sphere projects to 17 px from 10 units: far under the volume's threshold, so the plane stands for it.
  const at = (positionM: [number, number, number], orientationXyzw: [number, number, number, number]) =>
    banks.publish({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM, orientationXyzw } }, viewport, 1, 1);
  const front = () => at([0, 0, 10], [0, 0, 0, 1]), side = () => at([10, 0, 0], [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  front();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(loads, ['cloud'], 'read the first time it shows from afar');
  front();
  assert.equal(root.querySelector('[data-dataset-billboard]'), null, 'no camera-facing billboard');
  const plane = root.querySelector<HTMLElement>('.prepared-galaxy-backing > [data-galaxy-backing="cloud"]')!;
  const image = plane.querySelector('img')!, scene = plane.querySelector<HTMLElement>('.css-volume-scene')!;
  assert.equal(plane.querySelectorAll('*').length + 1, 5, 'projection, camera, scene, mesh and one image');
  assert.equal(plane.style.display, '');
  assert.equal(image.getAttribute('src'), '/optical/impostors/view-00n.png');
  // Orbiting turns the scene, the plane's one transform for the camera; the image stays where the bake laid it.
  const facing = scene.style.transform;
  side();
  assert.equal(image.style.transform, style.transform, 'the plane is fixed in the bank\'s frame');
  assert.notEqual(scene.style.transform, facing, 'the camera moved around it');
  // Another dataset: the same plane takes its image at rest, never while the camera coasts.
  banks.select('cloud', 'dust');
  banks.setCoasting(true); front();
  assert.equal(image.getAttribute('src'), '/optical/impostors/view-00n.png');
  banks.setCoasting(false); front();
  assert.equal(image.getAttribute('src'), '/dust/impostors/view-00n.png');
  assert.equal(root.querySelectorAll('img').length, 1, 'one image, whichever dataset');
  // Close enough for the volume in full, the plane gives way.
  await banks.focusBank('cloud')!.load();
  banks.publish({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 1.2], orientationXyzw: [0, 0, 0, 1] } }, viewport, 1, 1);
  assert.equal(plane.style.display, 'none');
  lifetime.destroy();
  assert.equal(root.querySelector('.prepared-galaxy-backing'), null, 'the scene takes its plane with it');
});
