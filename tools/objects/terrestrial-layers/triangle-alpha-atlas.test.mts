import assert from 'node:assert/strict';
import test from 'node:test';
import { alphaAtlasName, triangleSlices } from './triangle-alpha-atlas.mts';

const face = (parent: number, className: string, x: number, size: string, display?: string) => ({ parent, tag: 'u', className,
  style: `transform:none;background-position:-${x}px -4px;background-size:${size};--polycss-atlas-width:10px;--polycss-atlas-height:8px${display ? `;display:var(${display})` : ''}` });

test('each texture resource masks only the faces that read it, at their own atlas size', () => {
  const definition = {
    tree: { nodes: [
      { parent: -1, tag: 'div', className: 'body', style: '' },
      face(0, 'rock-terrain-face', 1, '100px 90px', '--rock-shape-display,block'),
      face(0, 'rock-terrain-face rock-polar', 2, '100px 90px', '--rock-shape-display,block'),
      face(0, 'rock-terrain-face', 3, '120px 80px', '--rock-photo-display,none'),
    ] },
    variants: [
      { writes: [{ kind: 'texture', target: 0, name: '--rock-surface-image', resource: 'surface:shape' },
        { kind: 'texture', target: 0, name: '--rock-poles-image', resource: 'poles:shape' },
        { kind: 'style', target: 0, name: '--rock-photo-display', value: 'none' }] },
      { writes: [{ kind: 'texture', target: 0, name: '--rock-surface-image', resource: 'surface:photo' },
        { kind: 'style', target: 0, name: '--rock-shape-display', value: 'none' },
        { kind: 'style', target: 0, name: '--rock-photo-display', value: 'block' }] },
    ],
    assets: { entries: [] },
  };
  const slices = triangleSlices(definition, 'rock');
  assert.deepEqual([...slices.keys()].sort(), ['poles:shape', 'surface:photo', 'surface:shape']);
  assert.deepEqual(slices.get('surface:shape')!.map(slice => slice.x), [1]);
  assert.deepEqual(slices.get('poles:shape')!.map(slice => slice.x), [2]);
  assert.deepEqual(slices.get('surface:photo'), [{ x: 3, y: 4, width: 10, height: 8, atlasWidth: 120, atlasHeight: 80 }]);
});

test('a masked atlas keeps its density suffix', () => {
  assert.equal(alphaAtlasName('/scenes/rock/rock-shape-surface@2x.webp'), '/scenes/rock/rock-shape-surface-alpha@2x.webp');
  assert.throws(() => alphaAtlasName('/scenes/rock/rock.png'), /must be WebP/u);
});
