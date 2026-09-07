import { expect, test, vi } from 'vitest';
import { preparePresentationTree } from './prepared-tree.js';
import type { PreparedTree } from './prepared-presentation.js';

function fixture() {
  const made: any[] = [];
  const document = { createElement(tag: string) {
    const node = { tag, parentNode: null as any, children: [] as any[], style: { setProperty: vi.fn() }, setAttribute: vi.fn(),
      remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; },
      appendChild(child: any) { child.remove(); child.parentNode = this; this.children.push(child); } };
    made.push(node); return node;
  } } as unknown as Document;
  const tree: PreparedTree = { nodes: Array.from({ length: 20 }, (_, i) => ({ tag: 'div', parent: i === 0 ? -1 : 0,
    className: `node-${i}`, style: '', properties: [], attributes: {} })), properties: [], camera: 0, scene: 1, stageClasses: [] };
  return { made, document, tree };
}

test('preflight yields while building detached nodes, then transfers the exact tree once', async () => {
  const f = fixture(), abort = new AbortController();
  let clock = 0;
  const time = vi.spyOn(performance, 'now').mockImplementation(() => ++clock);
  const yieldTask = vi.fn(async () => { expect(f.made[0].parentNode).toBeNull(); });
  try {
    const lease = await preparePresentationTree(f.tree, f.document, abort.signal, yieldTask);
    expect(yieldTask).toHaveBeenCalled();
    expect(f.made).toHaveLength(20);
    const cleanups: (() => void)[] = [];
    const built = lease.claim(f.tree, f.document, cleanup => cleanups.push(cleanup));
    expect(built.nodes).toEqual(f.made);
    expect(() => lease.claim(f.tree, f.document, () => {})).toThrow('another mount');
    abort.abort(); lease.destroy();
    expect(built.nodes).toHaveLength(20);
    expect(cleanups).toHaveLength(1);
  } finally { time.mockRestore(); }
});

test('cancellation retires partial construction without publishing roots or continuing work', async () => {
  const f = fixture(), abort = new AbortController();
  let clock = 0;
  const time = vi.spyOn(performance, 'now').mockImplementation(() => ++clock);
  try {
    await expect(preparePresentationTree(f.tree, f.document, abort.signal, async () => { abort.abort(); })).rejects.toThrow('cancelled');
    expect(f.made.length).toBeLessThan(20);
    expect(f.made[0].parentNode).toBeNull();
  } finally { time.mockRestore(); }
});

test('a detached lease rejects mismatched plans/documents and pre-claim disposal', async () => {
  const f = fixture();
  const lease = await preparePresentationTree(f.tree, f.document, new AbortController().signal);
  expect(() => lease.claim({ ...f.tree }, f.document, () => {})).toThrow('another mount');
  expect(() => lease.claim(f.tree, {} as Document, () => {})).toThrow('another mount');
  lease.destroy();
  expect(() => lease.claim(f.tree, f.document, () => {})).toThrow('cancelled');
});
