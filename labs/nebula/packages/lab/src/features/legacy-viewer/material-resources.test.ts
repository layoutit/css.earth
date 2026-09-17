import test from 'node:test';
import assert from 'node:assert/strict';
import { createToneResourceController } from '@cssearth/volume-viewer/scene/tone-resources';
import { materialResources, sharesMaterialGeometry } from './material-resources.ts';
import type { PreparedCssVolume } from '../../adapters/viewer/prepared-loaders';

type Leaf = PreparedCssVolume['stacks'][number]['leaves'][number];
/** One prepared bank: identical leaves and frame, material differs only through its texture directory and names. */
function bank(texture: (index: number) => string, geometry: { centerZ?: number; id?: string } = {}): PreparedCssVolume {
  const leaves = [0, 1].map(index => ({ id: index === 1 && geometry.id ? geometry.id : `leaf-${index}`, texturePath: texture(index), widthPx: 4, heightPx: 2,
    centerUnits: [0, 0, index === 1 ? geometry.centerZ ?? 1 : 0], style: { transform: `translateZ(${index}px)` } })) as unknown as Leaf[];
  // Composite inspection banks duplicate a leaf with a second id on the same texture.
  const all = [...leaves, { ...leaves[0]!, id: `all-light::${leaves[0]!.id}` }];
  return { schema: 'cssearth-css-volume@1', id: 'bank', frame: { boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } } as unknown as PreparedCssVolume['frame'],
    stacks: [{ axis: 'z', leaves: all }] as unknown as PreparedCssVolume['stacks'],
    resources: [0, 1].map(index => ({ path: texture(index), sha256: String(index).repeat(64), bytes: 1, width: 4, height: 2 })),
    provenance: null, approximation: null };
}

test('choosing another lens repaints the retained leaves without changing geometry identities', async () => {
  const decoded: string[] = [];
  Reflect.set(globalThis, 'Image', class { src = ''; naturalWidth = 4; naturalHeight = 2; async decode() { decoded.push(this.src); } });
  try {
    const mounted = bank(index => `slices/z/${index}.webp`), mountDir = '.local/nebula-lab/reconstructions/vista';
    const nodes = [0, 1].map(() => ({ style: { backgroundImage: '' } }) as unknown as HTMLElement);
    const tone = createToneResourceController({ isAllowedUrl: url => url.startsWith('/@fs/') });
    const leafIds = mounted.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id));
    mounted.resources.forEach((resource, index) => tone.bind(`${mountDir}/prepared/${resource.path}`, 4, 2, [nodes[index]!]));
    const url = (path: string) => `/@fs/repo/${path}`;
    for (const [directory, replacement] of [['.local/nebula-lab/reconstructions/smash', bank(index => `slices/z/${index}.webp`)],
      ['.local/nebula-lab/reconstructions/dss2', bank(index => `neutral/slices/z/${index}.png`)]] as const) {
      const resources = materialResources(mounted, replacement, mountDir, directory, url);
      await tone.apply(resources, mounted.resources.map(item => `${mountDir}/prepared/${item.path}`), () => true);
      assert.deepEqual(nodes.map(node => node.style.backgroundImage), replacement.resources.map(item => `url("/@fs/repo/${directory}/prepared/${item.path}")`));
      assert.deepEqual(resources.map(item => item.replacementPath), replacement.resources.map(item => `${directory}/prepared/${item.path}`));
      assert.deepEqual(replacement.stacks.flatMap(stack => stack.leaves.map(leaf => leaf.id)), leafIds);
    }
    assert.equal(decoded.length, 4);
    // A superseded swap decodes nothing onto the retained leaves.
    const before = nodes.map(node => node.style.backgroundImage);
    await tone.apply(materialResources(mounted, bank(index => `slices/z/${index}.webp`), mountDir, 'stale', url), mounted.resources.map(item => `${mountDir}/prepared/${item.path}`), () => false);
    assert.deepEqual(nodes.map(node => node.style.backgroundImage), before);
    assert.throws(() => materialResources(mounted, bank(index => `slices/z/${index}.webp`, { centerZ: 2 }), mountDir, 'other', url), /retained cloud leaf/);
    assert.throws(() => materialResources(mounted, bank(index => `slices/z/${index}.webp`, { id: 'moved' }), mountDir, 'other', url), /retained cloud leaf/);
  } finally { Reflect.deleteProperty(globalThis, 'Image'); }
});

test('only saved results naming the same model geometry and star layer may swap in place', () => {
  const model = 'a'.repeat(64), group = 'smc-constrained-observation';
  assert.equal(sharesMaterialGeometry({ materialGeometry: model, comparisonGroup: group }, { materialGeometry: model, comparisonGroup: group }), true);
  assert.equal(sharesMaterialGeometry({ materialGeometry: model, comparisonGroup: group }, { materialGeometry: 'b'.repeat(64), comparisonGroup: group }), false);
  assert.equal(sharesMaterialGeometry({ comparisonGroup: group }, { comparisonGroup: group }), false);
  assert.equal(sharesMaterialGeometry({ materialGeometry: model, comparisonGroup: group }, { materialGeometry: model, comparisonGroup: 'other-frame' }), false);
  assert.equal(sharesMaterialGeometry({ materialGeometry: model, comparisonGroup: group }, { materialGeometry: model, comparisonGroup: group, stars: 'stars.json' }), false);
});
