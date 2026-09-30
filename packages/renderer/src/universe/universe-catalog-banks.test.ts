import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { waitFor } from '@cssearth/objects/node/contract';

mock.module('../image-layers/prepared-image-layer-runtime.js', { namedExports: {
  mountPreparedCssImageLayers: ({ host, before }: { host: HTMLElement; before: Element }) => {
    const root = host.ownerDocument.createElement('div');
    host.insertBefore(root, before);
    return { root, publish() {}, revealLarge() {}, destroy() { root.remove(); } };
  },
} });
// The modules under test import the mocked ones, so they load after the mocks.
const { createUniverseCatalogBanks } = await import('./universe-catalog-banks.js');
const { parseDatasetBillboards } = await import('./dataset-billboards.js');

const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const plan = parseDatasetBillboards({ schema: 'cssearth-dataset-billboards@1', atlas: { columns: 1, rows: 1, cellPx: 256 },
  banks: [{ id: 'galaxy', contextVisibility: 'galactic', attached: false,
    billboard: { cell: 0, radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, 1, 0] } }] });

test('a galaxy drawn from image layers shows its billboard from afar and hands it to its slices once they load', async () => {
  const { document } = parseHTML('<div id="root"><span></span></div>');
  const root = document.getElementById('root')!, lifetime = createSceneLifetime();
  const banks = createUniverseCatalogBanks({ prepareBillboardAtlas: () => true, root, end: root.firstElementChild!, stage: root, lifetime, declarations: [{ id: 'galaxy', frame }],
    initialImages: new Map(), volumeDeclarations: [], catalogBank: undefined, loadCatalog: undefined,
    loadImageLayer: async () => ({ payload: { id: 'galaxy', frame } }) as never, billboards: { plan, atlasUrl: '/atlas.webp' } });
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
