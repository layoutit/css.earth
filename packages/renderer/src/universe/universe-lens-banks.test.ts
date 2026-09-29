import { afterEach, expect, test, vi } from 'vitest';
import { parseHTML } from 'linkedom';
import { createSceneLifetime } from '@cssearth/engine';
import { createUniverseLensBanks } from './universe-lens-banks.js';
import type { PreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';

const decode = vi.hoisted(() => ({ ready: true }));
vi.mock('../volume/volume-texture-readiness.js', () => ({
  createVolumeTextureReadiness: () => ({ ready: () => decode.ready, destroy() {} }),
}));
vi.mock('../volume/prepared-volume-lenses.js', () => ({
  createPreparedVolumeLenses: ({ payload }: { payload: PreparedVolumeLenses }) => ({ payload,
    mount: ({ host, before, frontHost, frontBefore }: { host: HTMLElement; before: Element; frontHost: HTMLElement; frontBefore: Element }) => {
      const root = host.ownerDocument.createElement('div'), frontRoot = host.ownerDocument.createElement('div');
      host.insertBefore(root, before); frontHost.insertBefore(frontRoot, frontBefore);
      return { root, frontRoot, textureUrls: () => ['/slice.webp'], publish() {}, destroy() { root.remove(); frontRoot.remove(); } };
    },
  }),
}));
afterEach(() => { decode.ready = true; });
const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const,
  localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const visibility = { hiddenBelowRadiusPixels: 1, fullAboveRadiusPixels: 2 };
const payload: PreparedVolumeLenses = { schema: 'cssearth-volume-lenses@1', id: 'fixture', defaultLens: 'optical',
  framingRadiusUnits: 1, pointVisibility: visibility, lenses: [{ id: 'optical', label: 'Optical', title: 'Optical',
    stars: { frame, points: [] }, description: 'Fixture', sourceUrl: 'https://example.org', brightness: { overall: 1, x: 1, y: 1, z: 1 },
    volume: { schema: 'cssearth-css-volume@1', id: 'fixture', frame, stacks: [], resources: [], provenance: {}, approximation: {} } }] };
async function fixture(attached = false) {
  const { document } = parseHTML('<div id="back"><span></span></div><div id="front"><span></span></div>');
  const root = document.getElementById('back')!, frontRoot = document.getElementById('front')!;
  const lifetime = createSceneLifetime();
  const banks = createUniverseLensBanks({ prepareBillboardAtlas: () => true, root, end: root.firstElementChild!, frontRoot, frontEnd: frontRoot.firstElementChild!,
    lifetime, declarations: [{ id: 'fixture', frame }], facts: [{ id: 'fixture', payloadSha256: 'a'.repeat(64), contextVisibility: 'independent', attached }],
    frame, visibility, warmDomNodeBudget: 10000, load: async () => ({ payload, resolveResource: path => path }) });
  await banks.focusBank('fixture')!.load();
  const targets = [root.firstElementChild!, frontRoot.firstElementChild!] as HTMLElement[];
  if (attached) banks.setEnabled('fixture', true);
  const publish = (bodyContextOpacity = 1, detailedObjectId?: string) => banks.publish({ referenceFrame: 'fixture', epochJdTt: 1,
    pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    { focalPixels: 100, principalOffsetPixels: [0, 0], widthPixels: 400, heightPixels: 300 }, 1, 1, detailedObjectId, bodyContextOpacity);
  return { banks, targets, publish, lifetime };
}

test.each([true, false])('a resident bank recovers after a decode gap; still coasting=%s', async stillCoasting => {
  const f = await fixture();
  f.publish();
  for (const root of f.targets) expect(root.style.opacity).toBe('1');
  f.banks.setCoasting(true); decode.ready = false; f.publish();
  for (const root of f.targets) { expect(root.style.opacity).toBe('0'); expect(root.style.display).toBe('block'); }
  f.banks.setCoasting(stillCoasting); decode.ready = true; f.publish();
  for (const root of f.targets) { expect(root.style.opacity).toBe('1'); expect(root.style.display).toBe('block'); }
  f.lifetime.destroy();
});

test('hidden banks wait for coast to stop; steady publication writes no styles', async () => {
  const f = await fixture();
  decode.ready = false; f.publish();
  f.banks.setCoasting(true); decode.ready = true; f.publish();
  for (const root of f.targets) expect(root.style.display).toBe('none');
  f.banks.setCoasting(false); f.publish();
  for (const root of f.targets) { expect(root.style.opacity).toBe('1'); expect(root.style.display).toBe('block'); }
  const writes = f.targets.map(root => {
    const opacity = vi.fn(), display = vi.fn();
    Object.defineProperty(root.style, 'opacity', { get: () => '1', set: opacity });
    Object.defineProperty(root.style, 'display', { get: () => 'block', set: display });
    return { opacity, display };
  });
  f.publish();
  for (const write of writes) { expect(write.opacity).not.toHaveBeenCalled(); expect(write.display).not.toHaveBeenCalled(); }
  f.lifetime.destroy();
});

test('close-ups suppress distant banks while attached shells and the selected nebula remain visible', async () => {
  const distant = await fixture();
  distant.publish(0);
  for (const node of distant.targets) expect(node.style.display).toBe('none');
  distant.publish(.5);
  for (const node of distant.targets) expect(node.style.opacity).toBe('0.5');
  distant.publish(0, 'fixture');
  for (const node of distant.targets) expect(node.style.opacity).toBe('1');
  distant.lifetime.destroy();
  const attached = await fixture(true);
  attached.publish(0);
  for (const node of attached.targets) expect(node.style.opacity).toBe('1');
  attached.lifetime.destroy();
});
