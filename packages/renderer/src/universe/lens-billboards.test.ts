import { expect, test } from 'vitest';
import { mountLensBillboards, parseLensBillboards } from './lens-billboards.js';

const sha = 'a'.repeat(64);
const input = {
  schema: 'cssearth-lens-billboards@1', atlas: { columns: 2, rows: 2, cellPx: 256, sha256: sha },
  banks: [
    { id: 'nebula', payloadSha256: sha, contextVisibility: 'independent', attached: false,
      billboard: { cell: 3, radiusUnits: 1, back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0] } },
    { id: 'galaxy', payloadSha256: sha, contextVisibility: 'galactic', attached: false },
  ],
};
const frame = { referenceFrame: 'fixture', epochJdTt: 1, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
  metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };

test('prepared billboards carry every bank, pinned, with an in-atlas cell', () => {
  const parsed = parseLensBillboards(input);
  expect(parsed.banks.get('galaxy')).toEqual({ id: 'galaxy', payloadSha256: sha, contextVisibility: 'galactic', attached: false });
  expect(parsed.banks.get('nebula')?.billboard?.cell).toBe(3);
  expect(() => parseLensBillboards({ ...input, banks: [...input.banks, input.banks[1]] })).toThrow(/unique/);
  expect(() => parseLensBillboards({ ...input, banks: [{ ...input.banks[0], billboard: { ...input.banks[0]!.billboard, cell: 4 } }] })).toThrow(/outside its atlas/);
  expect(() => parseLensBillboards({ ...input, banks: [{ ...input.banks[1], attached: undefined }] })).toThrow(/attached/);
});

test('a billboard samples its atlas cell only once shown, and hides behind the camera or at zero opacity', () => {
  const nodes: { tag: string; style: Record<string, string> & { cssText?: string }; dataset: Record<string, string>; append(node: unknown): void }[] = [];
  const create = (tag: string) => {
    const node = { tag, style: {} as Record<string, string>, dataset: {} as Record<string, string>, children: [] as unknown[],
      append(child: unknown) { this.children.push(child); } };
    nodes.push(node); return node;
  };
  const host = { ownerDocument: { createElement: create }, insertBefore() {} } as unknown as HTMLElement;
  const { atlas, banks } = parseLensBillboards(input);
  const layer = mountLensBillboards({ host, before: null, atlasUrl: '/atlas.webp', atlas,
    entries: [{ id: 'nebula', frame, billboard: banks.get('nebula')!.billboard! }] });
  const leaf = nodes.find(node => node.dataset.lensBillboard === 'nebula')!;
  expect(leaf.style.cssText).toContain('background-size:200% 200%;background-position:100% 100%');
  expect(leaf.style.backgroundImage).toBeUndefined();
  const viewport = { focalPixels: 100, principalOffsetPixels: [0, 0] as const, widthPixels: 400, heightPixels: 300 };
  const world = (orientationXyzw: readonly [number, number, number, number]) =>
    ({ referenceFrame: 'fixture', epochJdTt: 1, pose: { positionM: [0, 0, 10] as const, orientationXyzw } });
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  // A fixed 128 px box (two texels per CSS pixel of a 256 px cell) scaled to the 20 px it projects to: the camera
  // changes only its transform (motion-freezes-membership.md).
  expect(leaf.style).toMatchObject({ display: 'block', opacity: '0.5', backgroundImage: 'url("/atlas.webp")' });
  expect(leaf.style.cssText).toContain('width:128px;height:128px');
  expect(leaf.style.transform).toContain(`scale(${20 / 128})`);
  // Seen off its prepared axis the one view still draws, turned toward the camera.
  layer.publish(0, 0.5, { ...world([0, 0, 0, 1]), pose: { positionM: [3, 0, 10] as const, orientationXyzw: [0, 0, 0, 1] as const } }, viewport);
  expect(leaf.style.display).toBe('block');
  layer.publish(0, 0.5, world([0, 1, 0, 0]), viewport);
  expect(leaf.style.display).toBe('none');
  layer.publish(0, 0.5, world([0, 0, 0, 1]), viewport);
  layer.publish(0, 0, world([0, 0, 0, 1]), viewport);
  expect(leaf.style.display).toBe('none');
});
