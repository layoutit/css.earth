import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import { screenPicking } from '../navigation/screen-picking.js';

class Window {
  time = 0; next = 0; frames = new Map<number, (time: number) => void>();
  performance = { now: () => this.time };
  requestAnimationFrame = (callback: (time: number) => void) => { this.frames.set(++this.next, callback); return this.next; };
  cancelAnimationFrame = (id: number) => { this.frames.delete(id); };
  advance(time: number) { this.time = time; const frames = [...this.frames.values()]; this.frames.clear(); frames.forEach(frame => frame(time)); }
}
class Element extends EventTarget {
  children: Element[] = []; parent: Element | null = null; style: Record<string, string> = {}; dataset: Record<string, string> = {};
  textContent = ''; clientWidth = 800; clientHeight = 600;
  readonly ownerDocument: Document;
  constructor(ownerDocument: Document) { super(); this.ownerDocument = ownerDocument; }
  get offsetWidth() { return this.textContent.length * 6; } get offsetHeight() { return 14; }
  setAttribute() {}
  append(...children: Element[]) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child: Element, before: Element | null) { child.remove(); child.parent = this; this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, child); }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
}
class Document { count = 0; defaultView = new Window(); createElement() { this.count++; return new Element(this); } }
const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../objects/${path}`, import.meta.url), 'utf8'));

test('one retained catalogue combines both classes; cluster fades, source-aware focus and aperture follow the same observer', () => {
  const payload = read('local-group/prepared/catalogue.json'), clusters = read('galaxy-clusters/prepared/catalogue.json');
  const galaxyCount = payload.objects.filter((row: { membership: { group: string } }) => row.membership.group === 'local-group').length;
  const document = new Document(), host = document.createElement(), before = document.createElement(), pickingHost = document.createElement(); host.append(before);
  const picking = screenPicking(pickingHost as unknown as HTMLElement);
  const onSelect = vi.fn();
  const runtime = mountPreparedGalaxyCatalog({ host: host as unknown as HTMLElement, before: before as unknown as HTMLElement, payload, clusters, onSelect,
    pickingHost: pickingHost as unknown as HTMLElement });
  expect(runtime.inspect().count).toBe(galaxyCount + clusters.objects.length);
  expect(runtime.inspect().clusterCount).toBe(clusters.objects.length);
  const object = clusters.objects[0], nodes = document.count;
  const pose = { referenceFrame: clusters.frame.referenceFrame, epochJdTt: clusters.frame.epochJdTt,
    pose: { positionM: [object.positionM[0], object.positionM[1], object.positionM[2] + object.aperture.comovingRadiusM * 4] as const,
      orientationXyzw: [0,0,0,1] as const } };
  const viewport = { focalPixels: 600, principalOffsetPixels: [0,0] as const, widthPixels: 800, heightPixels: 600 };
  const label = runtime.inspect().labels[object.id]!, root = runtime.root as unknown as Element;
  const aperture = root.children.find(node => node.dataset.clusterAperture === object.id)!;
  runtime.select(object.id);
  runtime.publish(pose, viewport, 1, [], 0); document.defaultView.advance(250);
  expect(Number(label.style.opacity)).toBe(0); expect(label.style.pointerEvents).toBe('none');
  expect(picking.pick(0, -15)).not.toBe(label);
  runtime.publish(pose, viewport, 1, [], 1); document.defaultView.advance(350);
  expect(picking.pick(0, -15)).toBe(label);
  expect(screenPicking(host as unknown as HTMLElement).pick(0, -15)).toBeNull();
  expect(Number(label.style.opacity)).toBeCloseTo(.425); expect(Number(aperture.style.opacity)).toBeCloseTo(.1);
  const firstTransform = aperture.style.transform;
  const shifted = { ...pose, pose: { ...pose.pose, positionM: [pose.pose.positionM[0] + object.aperture.comovingRadiusM, ...pose.pose.positionM.slice(1)] as [number,number,number] } };
  const blockers = runtime.publish(shifted, viewport, 1, [], 1);
  expect(aperture.style.transform).not.toBe(firstTransform); expect(blockers.length).toBeGreaterThan(0);
  runtime.publish(shifted, viewport, 1, blockers, 1);
  expect(label.style.pointerEvents).toBe('none');
  expect(picking.pick(-150, -15)).not.toBe(label);
  label.dispatchEvent(new Event('dblclick')); expect(onSelect).not.toHaveBeenCalled();
  document.defaultView.advance(400); expect(Number(label.style.opacity)).toBeGreaterThan(0); expect(Number(label.style.opacity)).toBeLessThan(.425);
  runtime.publish(shifted, viewport, 1, [], 1); document.defaultView.advance(600);
  expect(Number(label.style.opacity)).toBe(.85); label.dispatchEvent(new Event('dblclick'));
  expect(onSelect).toHaveBeenCalledWith(object); expect(runtime.resolve(object.id)).toMatchObject({kind: 'galaxy-cluster'});
  expect(document.count).toBe(nodes);
  runtime.publish({ ...pose, pose: { ...pose.pose, positionM: [object.positionM[0], object.positionM[1], object.positionM[2] - object.aperture.comovingRadiusM * 4] } }, viewport, 1, [], 1);
  document.defaultView.advance(800); expect(Number(label.style.opacity)).toBe(0); expect(Number(aperture.style.opacity)).toBe(0);
  expect(picking.pick(0, -15)).not.toBe(label);
  runtime.publish(pose, viewport, 1, [], 1);
  expect(picking.pick(0, -15)).toBe(label);
  runtime.destroy(); expect(document.defaultView.frames.size).toBe(0); expect(host.children).toEqual([before]);
  expect(picking.pick(0, -15)).toBeNull();
});
