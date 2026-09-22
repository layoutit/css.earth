import { afterEach, expect, test, vi } from 'vitest';
import { createPreparedProjectiveTextureLeaf } from './prepared-projective-texture-leaf.js';
import { composePreparedProjectiveTransform } from '../prepared-data/projective-layout.js';

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const frame = Object.freeze([3, -1, .2, 0, 2, 4, -.1, 0, 0, 0, 1, 0, 20, 10, -100, 1]);
const texture = Object.freeze([1, 0, 0, .002, 0, 1, 0, -.003, 0, 0, 1, 0, 0, 0, 0, 1]);
const transform = (matrix: readonly number[], point: readonly number[]) => Array.from({ length: 4 }, (_, row) =>
  point.reduce((sum, value, column) => sum + value * matrix[column * 4 + row], 0));
const matrixOf = (css: string) => css.slice(9, -1).split(',').map(Number);
const normalize = (point: readonly number[]) => point.slice(0, 3).map(value => value / point[3]);
function element() {
  const properties: Record<string, string> = {};
  const style: Record<string, any> = { getPropertyValue: (name: string) => properties[name] ?? '',
    setProperty: (name: string, value: string) => { properties[name] = value; } };
  Object.defineProperty(style, 'cssText', { set(value: string) {
    for (const declaration of value.split(';')) {
      const colon = declaration.indexOf(':'); if (colon < 0) continue;
      const key = declaration.slice(0, colon).trim(), val = declaration.slice(colon + 1).trim();
      if (key.startsWith('--')) properties[key] = val;
      else style[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = val;
    }
  } });
  return { style, className: '', children: [] as unknown[] };
}
afterEach(() => vi.unstubAllGlobals());

test('active renderer paints one retained leaf with the exact immutable prepared homography', () => {
  const created: ReturnType<typeof element>[] = [];
  vi.stubGlobal('document', { createElement() { const node = element(); created.push(node); return node; } });
  const source = Object.freeze({ style: 'width:32px;height:20px;background-size:1024px 512px;background-position:-8px -4px;background-image:url("/prepared.webp")',
    projectiveTextureLayer: Object.freeze({ schema: 'polycss-prepared-projective-texture-layer@1', rasterScale: 4, frameMatrix: frame, textureMatrix: texture }) });
  const leaf = createPreparedProjectiveTextureLeaf(source);
  expect(created).toHaveLength(1); expect(created[0].children).toHaveLength(0);
  expect(leaf.style.width).toBe('128px'); expect(leaf.style.height).toBe('80px');
  expect(leaf.style.backgroundSize).toBe('4096px 2048px');
  expect(leaf.style.backgroundPosition).toBe('-32px -16px');
  expect(leaf.style.backgroundImage).toBe('url("/prepared.webp")');
  const actual = matrixOf(leaf.style.transform);
  for (let x = 0; x <= 128; x += 16) for (let y = 0; y <= 80; y += 10) {
    const point = [x, y, 0, 1], expected = normalize(transform(frame, transform(texture, point)));
    normalize(transform(actual, point)).forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 10));
  }
  expect(normalize(transform(frame, [128, 80, 0, 1])), 'removing the prepared projective factor must break the transport guarantee').not.toEqual(normalize(transform(actual, [128, 80, 0, 1])));
  expect(source.style).toContain('width:32px'); expect(source.projectiveTextureLayer.textureMatrix).toBe(texture);
});

test('prepared matrix transport rejects malformed or overflowing factors', () => {
  expect(() => composePreparedProjectiveTransform('1,2', identity)).toThrow();
  expect(() => composePreparedProjectiveTransform([...identity.slice(0, 15), Infinity], identity)).toThrow();
  expect(() => composePreparedProjectiveTransform(identity.map(() => 1e308), identity.map(() => 1e308))).toThrow();
});
