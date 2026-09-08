import assert from 'node:assert/strict';
import test from 'node:test';
import { createToneResourceController } from './tone-runtime.js';

test('tone bank swaps only after every prepared image decodes, without replacing leaves', async () => {
  const originalImage = globalThis.Image;
  const pending = new Map<string, () => void>();
  globalThis.Image = class {
    src = ''; naturalWidth = 10; naturalHeight = 10;
    decode() { return new Promise<void>(resolve => pending.set(this.src, resolve)); }
  } as unknown as typeof Image;
  try {
    const controller = createToneResourceController();
    const a = { style: { backgroundImage: 'original-a' } } as HTMLElement;
    const b = { style: { backgroundImage: 'original-b' } } as HTMLElement;
    controller.bind('a', 10, 10, [a]); controller.bind('b', 10, 10, [b]);
    const resources = ['a', 'b'].map(sourcePath => ({ sourcePath, url: `/@fs/${sourcePath}`, width: 10, height: 10 }));
    const work = controller.apply(resources, ['a', 'b'], () => true);
    pending.get('/@fs/a')!(); await Promise.resolve(); await Promise.resolve();
    assert.equal(a.style.backgroundImage, 'original-a', 'partially decoded bank must not publish');
    pending.get('/@fs/b')!(); await work;
    assert.equal(a.style.backgroundImage, 'url("/@fs/a")');
    assert.equal(b.style.backgroundImage, 'url("/@fs/b")');
    await assert.rejects(controller.apply(resources.slice(0, 1), ['a', 'b'], () => true), /do not match/);
  } finally { globalThis.Image = originalImage; }
});

test('stale tone decode cannot overwrite a newer selection or a new mount', async () => {
  const originalImage = globalThis.Image; let release!: () => void;
  globalThis.Image = class {
    src = ''; naturalWidth = 10; naturalHeight = 10;
    decode() { return new Promise<void>(resolve => { release = resolve; }); }
  } as unknown as typeof Image;
  try {
    for (const invalidateMount of [false, true]) {
      const controller = createToneResourceController(), node = { style: { backgroundImage: 'original' } } as HTMLElement;
      controller.bind('a', 10, 10, [node]); let current = true;
      const work = controller.apply([{ sourcePath: 'a', url: '/@fs/toned', width: 10, height: 10 }], ['a'], () => current);
      if (invalidateMount) controller.clear(); else current = false;
      release(); await work; assert.equal(node.style.backgroundImage, 'original');
    }
  } finally { globalThis.Image = originalImage; }
});

test('prepared tone selected before an overlay mounts reaches its later retained nodes', async () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class { src = ''; naturalWidth = 10; naturalHeight = 10; async decode() {} } as unknown as typeof Image;
  try {
    const controller = createToneResourceController(); controller.bind('a', 10, 10);
    await controller.apply([{ sourcePath: 'a', url: '/@fs/toned', width: 10, height: 10 }], ['a'], () => true);
    const node = { style: { backgroundImage: 'original' } } as HTMLElement;
    controller.bind('a', 10, 10, [node]); assert.equal(node.style.backgroundImage, 'url("/@fs/toned")');
  } finally { globalThis.Image = originalImage; }
});
