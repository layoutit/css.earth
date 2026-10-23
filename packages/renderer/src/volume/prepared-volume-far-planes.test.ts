import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { validatePreparedCssVolume, type PreparedCssVolume, type PreparedVolumeLeaf } from '@cssearth/objects';
import { mountPreparedVolumeLod } from './prepared-volume-lod.js';
import { projectVolumeDiameter } from './volume-impostor-projection.js';
import { completedStackOpacities, preparedVolumeCameraTransform } from './prepared-volume-runtime.js';
import sharp from 'sharp';
import { decodeLightImage, integratedStackLight, projectLightImage, lightGrid, rasterStackLight } from './far-plane-light.test-support.js';
import type { VolumeCameraPublication } from './types.js';

// The top pair are images; each side slot shows one atlas view as its box's background.
const PICTURES = 'img, [data-volume-side-plane]';
const texture = (element: Element) => element.getAttribute('src') ?? (element as HTMLElement).style.backgroundImage;

function fixture(decode?: () => Promise<void>, frames?: (() => void)[], now?: { ms: number }) {
  const envelope: unknown = JSON.parse(readFileSync(new URL('../../../../src/objects/milky-way-volume/prepared/volume.json', import.meta.url), 'utf8'));
  assert.ok(envelope && typeof envelope === 'object' && 'data' in envelope);
  const payload = validatePreparedCssVolume(envelope.data);
  assert.ok(payload.farPlanes, 'run the opt-in far plane bake before this installed-data test');
  const { document } = parseHTML('<div id="host"><span></span></div>'), host = document.getElementById('host')!;
  // Each linkedom window has its own Image class, without a decode of its own.
  if (decode) (document.defaultView as unknown as { Image: { prototype: { decode: unknown } } }).Image.prototype.decode = decode;
  // Animation frames the test runs by hand, on a clock it sets.
  if (frames) Object.assign(document.defaultView!, { requestAnimationFrame: (run: () => void) => frames.push(run), cancelAnimationFrame: () => {},
    performance: { now: () => now!.ms } });
  let coast = false;
  const runtime = mountPreparedVolumeLod({ host, before: host.firstElementChild!, payload, resolveResource: path => `/prepared/${path}`, coasting: () => coast }, () => 1);
  const publication = (z: number, orientationXyzw: readonly [number, number, number, number] = [0, 0, 0, 1]): VolumeCameraPublication => ({
    world: { referenceFrame: payload.frame.referenceFrame, epochJdTt: payload.frame.epochJdTt,
      pose: cameraPoseToReferenceFrame({ positionM: [(8.277 + z * 2 * (orientationXyzw[0] * orientationXyzw[2] + orientationXyzw[1] * orientationXyzw[3])) * payload.frame.metersPerUnit,
        z * 2 * (orientationXyzw[1] * orientationXyzw[2] - orientationXyzw[0] * orientationXyzw[3]) * payload.frame.metersPerUnit,
        z * (1 - 2 * (orientationXyzw[0] ** 2 + orientationXyzw[1] ** 2)) * payload.frame.metersPerUnit], orientationXyzw }, payload.frame) },
    viewport: { widthPixels: 1440, heightPixels: 900, focalPixels: 900, principalOffsetPixels: [0, 0] },
  });
  return { host, runtime, payload, publication, coasting(value: boolean) { coast = value; } };
}

test('zoom path exchanges six retained image layers and the complete slab tree, retaining both off document', () => {
  const f = fixture();
  try {
    assert.equal(f.host.querySelectorAll(`s, ${PICTURES}`).length, 0);
    f.runtime.publish(f.publication(200));
    const pictures = [...f.host.querySelectorAll(PICTURES)];
    assert.equal(pictures.length, 6); assert.equal(f.host.querySelectorAll('s').length, 0);
    assert.ok([...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis]')].every(root => Number(root.style.opacity) <= .999 + 1e-12));
    f.runtime.publish(f.publication(35));
    assert.equal(f.host.querySelectorAll(PICTURES).length, 0);
    const slabs = [...f.host.querySelectorAll('s')];
    assert.equal(slabs.length, 33);
    f.runtime.publish(f.publication(200));
    assert.equal(f.host.querySelectorAll('s').length, 0); assert.deepEqual([...f.host.querySelectorAll(PICTURES)], pictures);
    f.runtime.publish(f.publication(35));
    assert.deepEqual([...f.host.querySelectorAll('s')], slabs);
  } finally { f.runtime.destroy(); }
  assert.equal(f.host.querySelectorAll(`s, ${PICTURES}`).length, 0);
});

test('numerical oracle projects and composites decoded-style premultiplied image samples over black', () => {
  const leaf: PreparedVolumeLeaf = { id: 'one', centerUnits: [0, 0, 0], widthPx: 1, heightPx: 1, texturePath: 'one.png',
    style: { width: '1px', height: '1px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } };
  const view = { rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translationCssPixels: [0, 0, 0] as const, focalPixels: 900 };
  const a = Uint8Array.from([200, 30, 80, 64]), b = Uint8Array.from([40, 180, 10, 128]), opacity = .333;
  const projected = [a, b].map(pixels => projectLightImage({ leaf, pixels }, view));
  const expected = 230 / 255 * (128 / 255 * opacity) + 310 / 255 * (64 / 255 * opacity) * (1 - 128 / 255 * opacity);
  assert.ok(Math.abs(integratedStackLight(projected, opacity, 900) - expected) < 1e-12);
});

test('decoded real Milky Way pictures match the runtime slab composite within 5% at 65 azimuth/elevation views', async () => {
  const f = fixture(), directory = new URL('../../../../src/objects/milky-way-volume/prepared/', import.meta.url);
  const bank = f.payload.farPlanes!, side = bank.side, axes = ['x', 'y', 'z'] as const;
  const top = await Promise.all(bank.stacks[0]!.leaves.map(leaf => decodeLightImage(leaf, directory)));
  const frames = await Promise.all([side.leaf.texturePath, side.highTexturePath].map(async path => {
    const result = [];
    for (let index = 0; index < 16; index++) {
      const pixels = await sharp(new URL(path, directory).pathname).extract({ left: side.leaf.widthPx * index, top: 0, width: side.leaf.widthPx, height: side.leaf.heightPx }).ensureAlpha().raw().toBuffer();
      result.push(pixels);
    }
    return result;
  }));
  const slabs = await Promise.all(axes.map(axis => Promise.all(f.payload.stacks.find(stack => stack.axis === axis)!.leaves.map(leaf => decodeLightImage(leaf, directory)))));
  const rows: { azimuth: number; elevation: number; slabs: number; pictures: number; errorPercent: number; pixelErrorPercent: number }[] = [];
  try {
    for (const azimuth of Array.from({ length: 13 }, (_, i) => i * 7.5)) for (const elevation of [0, 15, 30, 60, 85, ...(azimuth === 45 ? [5, 7.5, 10] : [])]) {
      const phi = azimuth * Math.PI / 180, theta = (90 - elevation) * Math.PI / 180;
      const orientation = [-Math.sin(phi) * Math.sin(theta / 2), Math.cos(phi) * Math.sin(theta / 2), 0, Math.cos(theta / 2)] as const;
      const publication = f.publication(200, orientation);
      f.runtime.publish(publication);
      const roots = [...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis]')];
      const farOpacities = roots.map(root => Number(root.style.opacity));
      const imageOpacities = roots.map(root => [...root.querySelectorAll<HTMLElement>(PICTURES)].map(image => Number(image.style.opacity)));
      const actualSide = roots.slice(0, 2).map(root => [...root.querySelectorAll<HTMLElement>('[data-volume-side-plane]')].map((plane, level) => {
        const index = Math.round(Number.parseFloat(plane.style.backgroundPosition) / 100 * (side.views - 1));
        assert.ok(index >= 0 && index < 16, 'runtime must select a real atlas column');
        return { leaf: { ...side.leaf, style: { ...side.leaf.style, transform: plane.style.transform } }, pixels: frames[level]![index]! };
      }));
      f.runtime.publish(f.publication(35, orientation));
      const slabRoots = [...f.host.querySelectorAll<HTMLElement>('.css-volume-projection')];
      const fullOpacities = slabRoots.map(root => Number(root.style.opacity));
      const slabOpacities = slabRoots.map(root => Number(root.querySelector<HTMLElement>('s')!.style.opacity));
      const view = preparedVolumeCameraTransform(publication, f.payload.frame);
      const projectedSlabs = slabs.map(stack => stack.map(image => projectLightImage(image, view)));
      const projectedPictures = [...actualSide, top].map(stack => stack.map(image => projectLightImage(image, view)));
      const grid = lightGrid([...projectedSlabs.flat(), ...projectedPictures.flat()]);
      const fullRaster = new Float64Array(grid.width * grid.height), farRaster = new Float64Array(grid.width * grid.height);
      for (let axis = 0; axis < 3; axis++) {
        const full = fullOpacities[axis]! > 0 ? rasterStackLight(projectedSlabs[axis]!, slabOpacities[axis]!, view.focalPixels, grid) : null;
        const far = farOpacities[axis]! > 0 ? rasterStackLight(projectedPictures[axis]!, imageOpacities[axis]!, view.focalPixels, grid) : null;
        for (let pixel = 0; pixel < fullRaster.length; pixel++) {
          fullRaster[pixel] = (full?.[pixel] ?? 0) * fullOpacities[axis]! + fullRaster[pixel]! * (1 - fullOpacities[axis]!);
          farRaster[pixel] = (far?.[pixel] ?? 0) * farOpacities[axis]! + farRaster[pixel]! * (1 - farOpacities[axis]!);
        }
      }
      let fullLight = 0, farLight = 0, pixelError = 0;
      for (let pixel = 0; pixel < fullRaster.length; pixel++) {
        fullLight += fullRaster[pixel]!; farLight += farRaster[pixel]!;
        pixelError += Math.abs(fullRaster[pixel]! - farRaster[pixel]!);
      }
      rows.push({ azimuth, elevation, slabs: fullLight / grid.scale ** 2, pictures: farLight / grid.scale ** 2,
        errorPercent: 100 * (farLight / fullLight - 1), pixelErrorPercent: 100 * pixelError / fullLight });
    }
    console.log('REAL MILKY WAY CYLINDRICAL LIGHT', JSON.stringify(rows));
    assert.equal(rows.length, 68);
    for (const row of rows) assert.ok(Number.isFinite(row.errorPercent) && Math.abs(row.errorPercent) <= 5, JSON.stringify(row));
  } finally { f.runtime.destroy(); }
});

test('at 45 degrees low elevation both atlas slots share ONE vertical plane facing camera azimuth', () => {
  const f = fixture();
  try {
    for (const azimuth of [45, 52.5, 135, 225, 315]) for (const elevation of [0, 15]) {
      const phi = azimuth * Math.PI / 180, theta = (90 - elevation) * Math.PI / 180;
      f.runtime.publish(f.publication(200, [-Math.sin(phi) * Math.sin(theta / 2), Math.cos(phi) * Math.sin(theta / 2), 0, Math.cos(theta / 2)]));
      const planes = [...f.host.querySelectorAll<HTMLElement>('[data-volume-side-plane]')];
      assert.equal(planes.length, 4);
      assert.equal(new Set(planes.map(plane => plane.style.transform)).size, 1, 'two crossed planes must fail');
      const m = planes[0]!.style.transform.slice(9, -1).split(',').map(Number);
      assert.ok(Math.abs(m[2]!) < 1e-12 && m[4] === 0 && m[5] === 0 && m[6] === -1, 'plane contains vertical Z and never tilts');
      const normalPhysical = [m[0]!, -m[1]!, 0];
      assert.ok(normalPhysical[0]! * Math.cos(phi) + normalPhysical[1]! * Math.sin(phi) > 1 - 1e-12, 'side normal must face camera azimuth');
      const centre = f.payload.farPlanes!.side.leaf.centerUnits;
      const point = [m[13]! / 50 - centre[0], m[12]! / 50 - centre[1], m[14]! / 50 - centre[2]];
      assert.ok(Math.abs(point[0]! * normalPhysical[0]! + point[1]! * normalPhysical[1]!) < 1e-10, 'plane turns around central vertical line');
      assert.equal(f.host.querySelectorAll(PICTURES).length, 6);
      // A side view is its own box: an image 16 views wide, slid under a clip, flickered on every drag in Chromium.
      for (const plane of f.host.querySelectorAll<HTMLElement>('[data-volume-side-plane]')) {
        assert.equal(plane.children.length, 0); assert.equal(plane.style.width, f.payload.farPlanes!.side.leaf.style.width);
      }
      assert.deepEqual([...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis="z"] img')].map(image => image.style.transform), f.payload.farPlanes!.stacks[0]!.leaves.map(leaf => leaf.style.transform));
    }
  } finally { f.runtime.destroy(); }
});

test('side atlas retains six images and crossfades the two nearest 22.5-degree views through wraparound', () => {
  const f = fixture();
  try {
    f.runtime.publish(f.publication(200));
    const resident = [...f.host.querySelectorAll(PICTURES)];
    for (const azimuth of [0, 7.5, 22.5, 37.5, 45, 90, 179, 270, 359.9]) {
      const phi = azimuth * Math.PI / 180;
      f.runtime.publish(f.publication(200, [-Math.sin(phi) * Math.SQRT1_2, Math.cos(phi) * Math.SQRT1_2, 0, Math.SQRT1_2]));
      const phase = azimuth / 22.5, index = Math.floor(phase), mix = phase - index;
      const roots = [...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis]')];
      const expected = completedStackOpacities([1 - mix, mix, 0]);
      for (const [slot, root] of roots.slice(0, 2).entries()) {
        assert.ok(Math.abs(Number(root.style.opacity) - expected[slot]!) < 1e-10);
        for (const plane of root.querySelectorAll<HTMLElement>('[data-volume-side-plane]')) {
          assert.ok(Math.abs(Number.parseFloat(plane.style.backgroundPosition) - (index + slot) % 16 / 15 * 100) < 1e-4);
        }
      }
      assert.deepEqual([...f.host.querySelectorAll(PICTURES)], resident);
    }
  } finally { f.runtime.destroy(); }
});

test('coasting across the boundary freezes membership in both directions and only changes transforms or opacity', () => {
  const f = fixture();
  try {
    for (const [from, to] of [[200, 35], [35, 200]] as const) {
      f.runtime.publish(f.publication(from));
      const before = f.host.innerHTML;
      const nodes = [...f.host.querySelectorAll<HTMLElement>('*')];
      const frozen = nodes.map(node => { const style = node.style.cssText.replace(/(?:transform|opacity):[^;]*;?/gu, ''); return { node, style }; });
      f.coasting(true); f.runtime.publish(f.publication(to));
      const after = [...f.host.querySelectorAll('*')];
      assert.equal(after.length, nodes.length);
      assert.ok(after.every((node, index) => node === nodes[index]), 'coasting must retain the exact resident nodes');
      for (const { node, style } of frozen) assert.equal(node.style.cssText.replace(/(?:transform|opacity):[^;]*;?/gu, ''), style);
      f.coasting(false); f.runtime.publish(f.publication(to));
      assert.notEqual(f.host.innerHTML, before);
      assert.equal(f.host.querySelectorAll(PICTURES).length, to === 200 ? 6 : 0);
      assert.equal(f.host.querySelectorAll('s').length, to === 200 ? 0 : 33);
    }
  } finally { f.runtime.destroy(); }
});

test('coast across every side atlas boundary writes only transform/opacity, including wraparound', () => {
  const f = fixture();
  try {
    f.runtime.publish(f.publication(200, [0, Math.SQRT1_2, 0, Math.SQRT1_2]));
    const nodes = [...f.host.querySelectorAll<HTMLElement>('*')], writes: string[] = [];
    for (const node of nodes) {
      const style = node.style;
      // A write that leaves a value as it was changes nothing the page draws; the proxy is a new object to the retained writes.
      const watched = new Proxy(style, {
        set(target, key, value) { if (Reflect.get(target, key) !== value) writes.push(String(key)); return Reflect.set(target, key, value); },
        get(target, key) {
          if (key === 'setProperty') return (name: string, value: string) => { writes.push(name); target.setProperty(name, value); };
          return Reflect.get(target, key);
        },
      });
      Object.defineProperty(node, 'style', { configurable: true, get: () => watched });
      const setAttribute = node.setAttribute.bind(node);
      node.setAttribute = (name, value) => { writes.push(`attribute:${name}`); setAttribute(name, value); };
    }
    f.coasting(true);
    for (const degree of [10, 23, 45, 68, 91, 181, 271, 359, 0, 24]) {
      const phi = degree * Math.PI / 180;
      const publication = f.publication(200, [-Math.sin(phi) * Math.SQRT1_2, Math.cos(phi) * Math.SQRT1_2, 0, Math.SQRT1_2]);
      f.runtime.publish({ ...publication, viewport: { ...publication.viewport, focalPixels: 1000, principalOffsetPixels: [1, 2] } });
    }
    assert.ok(writes.includes('transform') && writes.includes('opacity'), 'exercise actual changing views');
    assert.deepEqual([...new Set(writes)].sort(), ['opacity', 'transform']);
    assert.deepEqual([...f.host.querySelectorAll('*')], nodes);
  } finally { f.runtime.destroy(); }
});

test('far presentation replaces materials while keeping its fixed geometry and rejects topology changes', () => {
  const f = fixture();
  try {
    f.runtime.publish(f.publication(200));
    const changed = structuredClone(f.payload);
    const leaf = changed.farPlanes!.side.leaf;
    Object.assign(leaf, { texturePath: changed.farPlanes!.side.highTexturePath });
    const images = [...f.host.querySelectorAll(PICTURES)];
    f.coasting(true);
    f.runtime.setPresentation(changed);
    assert.ok(texture(images[0]!).includes('/side.png'), 'material changes wait out a coast');
    f.coasting(false); f.runtime.publish(f.publication(200));
    assert.deepEqual([...f.host.querySelectorAll(PICTURES)], images);
    assert.ok(texture(images[0]!).includes('/side-high.png'));
    const incompatible: PreparedCssVolume = { ...f.payload, farPlanes: { ...f.payload.farPlanes!, belowDiameterPixels: 301 } };
    assert.throws(() => f.runtime.setPresentation(incompatible), /topology/);
  } finally { f.runtime.destroy(); }
});

test('a coast past a side view boundary keeps the drawn mix continuous', () => {
  const f = fixture();
  try {
    const at = (degree: number) => { const phi = degree * Math.PI / 180;
      return f.publication(200, [-Math.sin(phi) * Math.SQRT1_2, Math.cos(phi) * Math.SQRT1_2, 0, Math.SQRT1_2]); };
    // What each side slot contributes through the source-over layers drawn after it (side-1 over side-0, then the top pair).
    const slots = () => { const [a, b, z] = [...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis]')].map(root => Number(root.style.opacity));
      return [a! * (1 - b!) * (1 - z!), b! * (1 - z!)]; };
    f.runtime.publish(at(20));
    f.coasting(true);
    f.runtime.publish(at(22.499)); const before = slots();
    f.runtime.publish(at(22.501)); const after = slots();
    // Without the held pair both slots exchange views here and their opacities jump by almost one.
    for (const [slot, value] of before.entries()) assert.ok(Math.abs(value - after[slot]!) < .01, `slot ${slot}: ${value} -> ${after[slot]}`);
    f.coasting(false); f.runtime.publish(at(22.501));
    const settled = [...f.host.querySelectorAll<HTMLElement>('[data-volume-side-plane]')].map(plane => plane.style.backgroundPosition);
    assert.equal(settled[0], `${Number((1 / 15 * 100).toFixed(6))}% 0%`, 'the next pair is committed on settle');
  } finally { f.runtime.destroy(); }
});

test('a zoom resting just below the threshold keeps the slabs until a tenth past it', () => {
  const f = fixture();
  try {
    const diameter = (z: number) => projectVolumeDiameter(f.publication(z), f.payload.frame, f.payload.farPlanes!.radiusUnits).diameterPixels;
    let near = 35, far = 200;
    for (let i = 0; i < 60; i++) { const mid = (near + far) / 2; if (diameter(mid) > 285) near = mid; else far = mid; }
    const between = (near + far) / 2;
    assert.ok(diameter(between) < 300 && diameter(between) > 270);
    const shown = () => f.host.querySelectorAll(PICTURES).length ? 'far' : f.host.querySelectorAll('s').length ? 'full' : 'none';
    f.runtime.publish(f.publication(200)); f.runtime.publish(f.publication(between));
    assert.equal(shown(), 'far');
    f.runtime.publish(f.publication(35)); f.runtime.publish(f.publication(between));
    assert.equal(shown(), 'full');
  } finally { f.runtime.destroy(); }
});

test('the slabs draw the far galaxy until its pictures are decoded', async () => {
  let release!: () => void;
  const decoded = new Promise<void>(resolve => { release = resolve; });
  const f = fixture(() => decoded);
  try {
    f.runtime.publish(f.publication(200));
    assert.equal(f.host.querySelectorAll(PICTURES).length, 0); assert.equal(f.host.querySelectorAll('s').length, 33);
    // No further publication: readiness republishes the last camera itself.
    release(); await decoded; await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.host.querySelectorAll(PICTURES).length, 6); assert.equal(f.host.querySelectorAll('s').length, 0);
  } finally { f.runtime.destroy(); }
});

test('a picture decode that never finishes gives way to the pictures after three seconds', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(() => new Promise<void>(() => {}));
  try {
    f.runtime.publish(f.publication(200));
    assert.equal(f.host.querySelectorAll('s').length, 33);
    t.mock.timers.tick(2999); await Promise.resolve(); await Promise.resolve();
    assert.equal(f.host.querySelectorAll(PICTURES).length, 0);
    t.mock.timers.tick(1); for (let i = 0; i < 4; i++) await Promise.resolve();
    assert.equal(f.host.querySelectorAll(PICTURES).length, 6); assert.equal(f.host.querySelectorAll('s').length, 0);
  } finally { f.runtime.destroy(); }
});

test('a coast that turns half round keeps the view it reached, without snapping back', () => {
  const f = fixture();
  try {
    const at = (degree: number) => { const phi = degree * Math.PI / 180;
      return f.publication(200, [-Math.sin(phi) * Math.SQRT1_2, Math.cos(phi) * Math.SQRT1_2, 0, Math.SQRT1_2]); };
    const slots = () => [...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis]')].slice(0, 2).map(root => Number(root.style.opacity));
    f.runtime.publish(at(10));
    f.coasting(true);
    let previous: number[] | null = null;
    // Past 180 degrees from the held view the shortest way back is the other way round; the mix must not follow it.
    // Back at 360 degrees the camera is inside the held pair again, and the mix follows it.
    for (let degree = 10; degree < 360; degree += 5) {
      f.runtime.publish(at(degree)); const now = slots();
      if (previous && degree > 30) assert.deepEqual(now, previous, `${degree} degrees`);
      previous = now;
    }
  } finally { f.runtime.destroy(); }
});

test('a coast frame that skips past a view boundary ends at the boundary it crossed', () => {
  for (const [from, to, end] of [[10, 25, 1], [20, -1, 0]] as const) {
    const f = fixture();
    try {
      const at = (degree: number) => { const phi = degree * Math.PI / 180;
        return f.publication(200, [-Math.sin(phi) * Math.SQRT1_2, Math.cos(phi) * Math.SQRT1_2, 0, Math.SQRT1_2]); };
      // What the two slots draw through the layers over them; the held pair is views 0 and 1.
      const drawn = () => { const [a, b, z] = [...f.host.querySelectorAll<HTMLElement>('[data-volume-far-axis]')].map(root => Number(root.style.opacity));
        return [a! * (1 - b!) * (1 - z!), b! * (1 - z!)]; };
      f.runtime.publish(at(from)); f.coasting(true); f.runtime.publish(at(to));
      const [first, second] = drawn();
      assert.ok(end ? second! > first! * 100 : first! > second! * 100, `${from} -> ${to} degrees: ${first}, ${second}`);
      f.runtime.publish(at(to + (end ? 30 : -30)));
      assert.deepEqual(drawn(), [first, second], 'the end it crossed is kept as the coast turns on');
    } finally { f.runtime.destroy(); }
  }
});

test('a crossing crossfades the pictures over the slabs, and the outgoing presentation leaves when the fade ends', () => {
  const frames: (() => void)[] = [], now = { ms: 0 };
  const f = fixture(undefined, frames, now);
  const run = (ms: number) => { now.ms = ms; const due = frames.splice(0); for (const frame of due) frame(); };
  const picturesOpacity = () => Number(f.host.querySelector<HTMLElement>('.css-volume-far-planes')?.style.opacity ?? Number.NaN);
  try {
    f.runtime.publish(f.publication(35));
    assert.equal(f.host.querySelectorAll('s').length, 33); assert.equal(f.host.querySelectorAll(PICTURES).length, 0);
    f.runtime.publish(f.publication(200));
    // Both are drawn, the pictures over the slabs, from opacity 0.
    assert.equal(f.host.querySelectorAll('s').length, 33); assert.equal(f.host.querySelectorAll(PICTURES).length, 6);
    assert.ok(f.host.querySelector('.css-volume-far-planes')!.previousElementSibling?.className.includes('css-volume-projection'));
    assert.equal(picturesOpacity(), 0);
    run(125); assert.ok(picturesOpacity() > .3 && picturesOpacity() < .7, String(picturesOpacity()));
    f.coasting(true); run(250); run(300);
    assert.equal(f.host.querySelectorAll('s').length, 33, 'the slabs wait out a coast');
    f.coasting(false); run(320);
    assert.equal(f.host.querySelectorAll('s').length, 0); assert.ok(picturesOpacity() > .99);
    // And back: the slabs return under the pictures, which fade out and leave.
    f.runtime.publish(f.publication(35));
    assert.equal(f.host.querySelectorAll('s').length, 33); assert.ok(picturesOpacity() > .99);
    run(500); run(700);
    assert.equal(f.host.querySelectorAll(PICTURES).length, 0); assert.equal(f.host.querySelectorAll('s').length, 33);
  } finally { f.runtime.destroy(); }
});
