import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { parsePreparedWorldContextSummary, type PreparedCssVolume, type PreparedPointAppearance } from '@cssearth/objects';
import type { WorldContextFrame } from './world-context/world-context-frame.js';
import { worldLayerVisibility } from './world-layers.js';

// Keep the universe's actual layer/subject decision. The drawing owners below observe that decision at their boundary.
let datasetHidden!: (id: string) => boolean, imageHidden!: (id: string) => boolean;
const meshOpacity = new Map<string, number>();
const no = () => {};
mock.module('./universe-dataset-banks.js', { namedExports: {
  createUniverseDatasetBanks: (options: { hidden: typeof datasetHidden }) => {
    datasetHidden = options.hidden;
    return { focusBank: () => null, publishResidency: no, publish: no, drawing: () => false, setEnabled: no };
  },
} });
mock.module('./universe-catalog-banks.js', { namedExports: {
  createUniverseCatalogBanks: (options: { hidden: typeof imageHidden }) => {
    imageHidden = options.hidden;
    return { focusBank: () => null, loadInitialImages: no, mountInitialCatalog: no, publishResidency: no,
      publishImages: no, publishPoints: no, publishPlanes: () => ({ opacity: 1, colors: {} }), imageBankContaining: () => undefined,
      drawing: () => false };
  },
} });
mock.module('./universe-background.js', { namedExports: {
  createUniverseBackground: () => ({ mount: no, prefetch: no, publish: () => 1 }),
} });
mock.module('./points/background-points.js', { namedExports: { mountBackgroundPoints: () => ({ publish: no, destroy: no }) } });
mock.module('./image-mesh.js', { namedExports: {
  mountImageMesh: ({ url }: { url: string }) => ({ setCutaway: no, setHidden: no, destroy: no,
    publish: (_view: unknown, opacity: number) => { meshOpacity.set(url, opacity); return 0; } }),
} });
mock.module('./prepared-world-context.js', { namedExports: {
  mountPreparedWorldContext: ({ host }: { host: HTMLElement }) => ({ root: host, destroy: no, selectObject: no, setBodyVisibility: no,
    setOutsideGalaxy: no, loneStarSelected: () => false, setSelectionReach: no, plainStarPlaces: () => [], setOrbitsOpacity: no,
    setBodyColors: no, publish: no, backgroundExclusionRects: () => [], bodyLabelRects: () => [] }),
} });
mock.module('./selected-body-label.js', { namedExports: {
  mountSelectedBodyLabel: () => ({ prepare: no, publish: () => null, destroy: no }),
} });
mock.module('./world-context/world-context-point-source.js', { namedExports: { mountWorldContextPointSource: () => null } });
mock.module('./environment-labels.js', { namedExports: { mountEnvironmentLabels: () => ({ publish: () => [], destroy: no }) } });
mock.module('../volume/volume-texture-readiness.js', { namedExports: {
  createVolumeTextureReadiness: () => ({ ready: () => true, decoded: () => true, destroy: no }),
} });
const { createPreparedUniverse } = await import('./prepared-universe-runtime.js');
const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../../src/objects/observable-universe/prepared/world.json', import.meta.url), 'utf8')));
const frame = { referenceFrame: summary.frame.referenceFrame, epochJdTt: summary.frame.epochJdTt,
  originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const volume: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: summary.volume.objectId, frame, anchors: [],
  stacks: (['x', 'y', 'z'] as const).map(axis => ({ axis, leaves: [] })),
  resources: [], provenance: {}, approximation: {} };

const points: PreparedPointAppearance = { id: summary.stars.objectId, frame, resources: [],
  atlas: { path: 'points.png', columns: 1, tileSize: 1, haloRadii: 1, colors: [[1, 1, 1]] },
  photometry: { minimumMagnitude: 0, maximumMagnitude: 10, step: 1, floor: 0, limitingMagnitude: 10,
    hintsLimitMagnitude: 10, minimumRadiusPx: 1, samples: [{ radiusPx: 1, luminance: 1 }] } };

function fixture() {
  const { document } = parseHTML('<html><body><div></div></body></html>');
  const bodies = ['nebula', 'galaxy', 'other'].map(id => ({ id, name: id, color: '#ffffff', positionM: [0, 0, 0], radiusM: 1 }));
  const universe = createPreparedUniverse({ context: { ...summary, bodies }, volume, pointAppearance: points,
    sprites: {}, resolveResource: path => path, resolvePointResource: path => path,
    contextBanks: ['nebula-volume', 'galaxy-image', 'cmb'],
    imageMeshes: [{ id: 'cmb', url: '/cmb', resolveResource: path => path }, { id: 'other-mesh', url: '/other-mesh', resolveResource: path => path }] });
  const mounted = universe.mount(document.querySelector<HTMLElement>('div')!);
  const select = (id: string) => mounted.selectObject(id, { ...summary.frame, originM: [0, 0, 0], bodyRadiusM: 1 });
  return { mounted, select };
}

test('the real universe rule keeps its expected and enabled nebula bank when Nebulae is off', () => {
  const { mounted, select } = fixture();
  select('nebula'); mounted.setLayerVisibility(worldLayerVisibility(['nebulae']), () => 'nebulae');
  assert.equal(datasetHidden('nebula-volume'), true, 'context nebulae are hidden');
  mounted.expectVolumeDataset('nebula-volume');
  assert.equal(datasetHidden('nebula-volume'), false, 'the arriving subject is exempt');
  assert.equal(datasetHidden('other-volume'), true);
  mounted.setVolumeDatasetEnabled('nebula-volume', true);
  assert.equal(datasetHidden('nebula-volume'), false, 'the committed subject is exempt');
  mounted.setLayerVisibility(worldLayerVisibility(['subject']), () => 'nebulae');
  assert.equal(datasetHidden('nebula-volume'), true, 'Subject off hides the subject itself');
  mounted.destroy();
});

test('galaxy image banks follow the same subject rule as nebula volumes', () => {
  const { mounted, select } = fixture();
  select('galaxy'); mounted.expectVolumeDataset('galaxy-image');
  mounted.setLayerVisibility(worldLayerVisibility(['galaxies']), () => 'galaxies');
  assert.equal(imageHidden('galaxy'), false, 'the selected object is a subject even without a separate bank');
  assert.equal(imageHidden('galaxy-image'), false);
  assert.equal(imageHidden('other-image'), true);
  mounted.setLayerVisibility(worldLayerVisibility(['subject']), () => 'galaxies');
  assert.equal(imageHidden('galaxy-image'), true);
  mounted.destroy();
});

test('Sky off preserves the page CMB mesh, but hides it on another page; Subject off hides the CMB', () => {
  const { mounted } = fixture();
  const publish = () => mounted.publish({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    pose: { positionM: [0, 0, 1e28], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 800, heightPixels: 600 }, { otherSystems: 1 } as WorldContextFrame);
  mounted.expectVolumeDataset('cmb');
  mounted.setLayerVisibility(worldLayerVisibility(['sky']), () => null); publish();
  assert.equal(meshOpacity.get('/cmb'), 1); assert.equal(meshOpacity.get('/other-mesh'), 0);
  mounted.expectVolumeDataset(null); publish();
  assert.equal(meshOpacity.get('/cmb'), 0);
  mounted.expectVolumeDataset('cmb');
  mounted.setLayerVisibility(worldLayerVisibility(['subject']), () => null); publish();
  assert.equal(meshOpacity.get('/cmb'), 0); assert.equal(meshOpacity.get('/other-mesh'), 1);
  mounted.destroy();
});
