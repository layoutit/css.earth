import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test, vi } from 'vitest';
import { mountPreparedCssPointField, pointPhotometry, projectPreparedPoint } from './prepared-point-field-runtime.js';
import { createPointFieldSelection } from './point-field-selection.js';
import { parsePreparedCssPointField } from './validation.js';
import type { PreparedCssPointField } from './types.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';

class FakeElement {
  writes = 0;
  readonly children: FakeElement[] = [];
  readonly style = new Proxy({ setProperty(name: string, value: string) { Object.assign(this, { [name]: value }); } }, {
    set: (target, key, value) => { this.writes++; return Reflect.set(target, key, value); },
  }) as unknown as CSSStyleDeclaration;
  readonly dataset: Record<string,string> = new Proxy({}, { set: (target: Record<string,string>, key: string, value: string) => {
    this.writes++; target[key] = value; return true;
  } });
  parentNode: FakeElement|null = null; className=''; ariaHidden=''; textContent=''; clientWidth=800; clientHeight=600;
  constructor(readonly ownerDocument: FakeDocument) {}
  get offsetWidth(){return this.textContent.length*8;}
  get offsetHeight(){return 17;}
  getBoundingClientRect() {return {x:0,y:0,left:0,top:0,right:this.clientWidth,bottom:this.clientHeight,width:this.clientWidth,height:this.clientHeight};}
  appendChild(child: FakeElement): FakeElement { this.insertBefore(child,null); return child; }
  insertBefore(child: FakeElement,before: FakeElement|null): void {
    child.remove(); child.parentNode=this;
    const index=before===null?this.children.length:this.children.indexOf(before);
    this.children.splice(index<0?this.children.length:index,0,child);
  }
  remove(): void { if(this.parentNode){const siblings=this.parentNode.children,index=siblings.indexOf(this);if(index>=0)siblings.splice(index,1);this.parentNode=null;} }
}
class FakeDocument {
  private next=0; readonly frames=new Map<number,FrameRequestCallback>();
  private time=0;
  readonly defaultView={
    performance:{now:()=>this.time},
    requestAnimationFrame:(callback:FrameRequestCallback)=>{const id=++this.next;this.frames.set(id,callback);return id;},
    cancelAnimationFrame:(id:number)=>{this.frames.delete(id);},
  };
  createElement(): FakeElement {return new FakeElement(this);}
  frame(delta=16): void {this.time+=delta;const callbacks=[...this.frames.values()];this.frames.clear();for(const callback of callbacks)callback(this.time);}
}
const parsec=3.085677581491367e16;
const viewport={focalPixels:400,principalOffsetPixels:[30,-20] as const};
function world(x=0,z=0,orientation:WorldCameraPose['pose']['orientationXyzw']=[0,0,0,1]):WorldCameraPose {
  return {referenceFrame:'sun-icrf',epochJdTt:2461286.5,pose:{positionM:[x*parsec,0,z*parsec],orientationXyzw:orientation}};
}
function fixture():PreparedCssPointField {
  return {
    schema:'cssearth-css-point-field@1',id:'fixture',frame:{referenceFrame:'sun-icrf',epochJdTt:2461286.5,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:parsec,boundsUnits:{min:[-1024,-1024,-1024],max:[1024,1024,1024]}},
    stars:[{id:'a',name:null,coverageAnchor:false,positionUnits:[-110,0,-100],absoluteMagnitude:0,colorIndex:0},{id:'b',name:null,coverageAnchor:false,positionUnits:[-90,0,-100],absoluteMagnitude:0,colorIndex:0},{id:'c',name:null,coverageAnchor:false,positionUnits:[10,0,-100],absoluteMagnitude:0,colorIndex:0}],
    nodes:[{positionUnits:[-50,0,-100],radiusUnits:60,absoluteMagnitude:-1,colorIndex:0,first:0,count:3,children:[1,2]},
      {positionUnits:[-100,0,-100],radiusUnits:10,absoluteMagnitude:-.75,colorIndex:0,first:0,count:2,children:[]},
      {positionUnits:[10,0,-100],radiusUnits:0,absoluteMagnitude:0,colorIndex:0,first:2,count:1,children:[]}],
    atlas:{path:'points.png',columns:1,tileSize:32,colors:[[255,255,255]],haloRadii:2.5},
    photometry:{floor:1/255,minimumRadiusPx:.6,limitingMagnitude:20,hintsLimitMagnitude:10,minimumMagnitude:0,maximumMagnitude:20,step:5,samples:[{radiusPx:1,luminance:1},{radiusPx:1,luminance:.8},{radiusPx:1,luminance:.6},{radiusPx:1,luminance:.4},{radiusPx:1,luminance:.2}]},
    labels:{activeSlots:1,transitionSlots:1,capHeightPx:12,gapPx:7,maxAlpha:.8,fadeMs:500},
    policy:{activeSlots:4,transitionSlots:4,maxErrorPx:2,transitionMs:180},resources:[{path:'points.png',sha256:'0'.repeat(64),bytes:1,width:32,height:32}],provenance:{},
  };
}
function mount(payload=fixture(), showLabels = true) {
  const document=new FakeDocument(),host=document.createElement(),before=document.createElement();host.appendChild(before);
  const resolveResource=vi.fn((path:string)=>`/prepared/${path}`);
  const layer=mountPreparedCssPointField({host:host as unknown as HTMLElement,before:before as unknown as Element,payload,resolveResource,showLabels});
  return {document,host,before,layer,root:layer.root as unknown as FakeElement,resolveResource};
}
function leaves(root: FakeElement): FakeElement[] {
  return root.children.flatMap(child => child.className === 'prepared-point-field-stars' ? child.children.flatMap(block => block.children) : [child]);
}

test('foreground label exclusion hides only star text and is released by the next publication',()=>{
  const source=fixture(),payload={...source,stars:source.stars.map((star,index)=>({...star,name:index===2?'Rigil Kentaurus':null}))};
  const {layer,root,document}=mount(payload);
  layer.publish(world(),viewport,1);document.frame(500);
  const labels=root.children.filter(element=>element.className==='prepared-star-label'),active=labels[0]!;
  expect(active.textContent).toBe('Rigil Kentaurus');expect(active.style.visibility).toBe('');
  const points=layer.inspect().points.filter(point=>point.reference!==null && point.element.style.visibility!=='hidden');
  expect(points.length).toBeGreaterThan(0);
  const retained=leaves(root),drawn=layer.inspect().visiblePoints;
  const alpha=Number(active.style.opacity);
  // The named star projects to (70,-20), with text directly above that anchor.
  layer.publish(world(),viewport,1,[{left:50,top:-50,right:90,bottom:-25}]);
  expect(Number(active.style.opacity)).toBeCloseTo(alpha);document.frame(250);
  expect(Number(active.style.opacity)).toBeCloseTo(alpha/2);document.frame(250);
  expect(Number(active.style.opacity)).toBe(0);expect(layer.inspect().visiblePoints).toBe(drawn);
  expect(points.every(point=>point.element.style.visibility!=='hidden')).toBe(true);
  expect(leaves(root)).toEqual(retained);
  layer.publish(world(),viewport,1);expect(Number(active.style.opacity)).toBe(0);
  document.frame(250);expect(Number(active.style.opacity)).toBeCloseTo(alpha/2);layer.destroy();
});
function find(layer:ReturnType<typeof mountPreparedCssPointField>,reference:string):FakeElement {
  const element=layer.inspect().points.find(point=>point.reference===reference && point.element.style.visibility!=='hidden')?.element as unknown as FakeElement;
  if(!element)throw new Error(`No visible slot for ${reference}`);return element;
}
function center(element:FakeElement):readonly [number,number] {
  const match=/translate\(([-\d.e+]+)px,([-\d.e+]+)px\) scale\(([-\d.e+]+)\)/.exec(element.style.transform??'');
  if(!match)throw new Error('Point slot has no prepared projection');
  const half=Number(match[3])*32/2;return [Number(match[1])+half,Number(match[2])+half];
}
afterEach(()=>vi.useRealTimers());

test('an unchanged camera and surviving identities do not rewrite retained star DOM', () => {
  vi.useFakeTimers();
  const { layer, root } = mount(fixture(), false);
  layer.publish(world(), viewport, 1);
  const slots = leaves(root);
  const projected = layer.inspect().projectedPoints;
  slots.forEach(slot => { slot.writes = 0; });
  layer.publish(world(), viewport, 1);
  expect(slots.reduce((sum, slot) => sum + slot.writes, 0)).toBe(0);
  expect(layer.inspect().projectedPoints).toBe(projected, 'Equivalent views do not re-project the retained point pools');
  layer.publish(world(1), viewport, 1);
  expect(center(find(layer, 'star:2'))[0]).toBeCloseTo(66, 12);
  expect(leaves(root)).toEqual(slots);
  layer.destroy();
});

test('point projection preserves principal point and distance-dependent parallax under translation and rotation',()=>{
  const identity=[1,0,0,0,1,0,0,0,1] as const;
  const near=projectPreparedPoint([10,20,-100],[0,0,0],identity,400,30,-20);
  expect(near.x).toBe(70);expect(near.y).toBe(60);expect(near.depth).toBe(100);
  const moved=projectPreparedPoint([10,20,-100],[5,0,0],identity,400,30,-20);
  const far=projectPreparedPoint([10,20,-200],[0,0,0],identity,400,30,-20);
  const farMoved=projectPreparedPoint([10,20,-200],[5,0,0],identity,400,30,-20);
  expect(near.x-moved.x).toBe(20);expect(far.x-farMoved.x).toBe(10);
  const rolled=projectPreparedPoint([10,20,-100],[0,0,0],[0,1,0,-1,0,0,0,0,1],400,30,-20);
  expect(rolled.x).toBe(110);expect(rolled.y).toBe(-60);
});

test('distance modulus selects/interpolates the prepared photometry and clamps its endpoints',()=>{
  const data=fixture();
  expect(pointPhotometry(data,5,10).luminance).toBeCloseTo(.8,12);
  expect(pointPhotometry(data,5,100).luminance).toBeCloseTo(.6,12);
  expect(pointPhotometry(data,5,Math.sqrt(1000)).luminance).toBeCloseTo(.7,12);
  expect(pointPhotometry(data,5,0).luminance).toBe(1);
  expect(pointPhotometry(data,5,1e20).luminance).toBe(.2);
  const metres={...data,frame:{...data.frame,metersPerUnit:1}};
  expect(pointPhotometry(metres,5,10*parsec)).toEqual(pointPhotometry(data,5,10));
});

test('mounted slots follow the physical observer while surviving identities stay on the same nodes',()=>{
  vi.useFakeTimers();const {document,layer,root,resolveResource}=mount();
  layer.publish(world(),viewport,1);
  const survivor=find(layer,'star:2'),slots=[...leaves(root)];
  expect(center(survivor)[0]).toBeCloseTo(70,12);
  layer.publish(world(-10),viewport,1);
  expect(find(layer,'star:2')).toBe(survivor);expect(Number(survivor.style.opacity)).toBeGreaterThan(0);
  expect(find(layer,'star:0').style.opacity).toBe('0');
  document.frame();expect(Number(find(layer,'star:0').style.opacity)).toBeGreaterThan(0);
  layer.publish(world(5,0),viewport,1);
  expect(center(survivor)[0]).toBeCloseTo(50,12);
  layer.publish(world(5,0,[0,0,Math.SQRT1_2,Math.SQRT1_2]),viewport,1);
  expect(center(survivor)[0]).toBeCloseTo(30,12);expect(center(survivor)[1]).toBeCloseTo(-40,12);
  expect(leaves(root)).toEqual(slots);expect(layer.inspect().catalogueCount).toBe(3);expect(layer.inspect().coveredCount).toBe(3);
  expect(resolveResource).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(180);expect(vi.getTimerCount()).toBe(1); // Reconcile the rotation queued during admission.
  document.frame();vi.advanceTimersByTime(180);expect(vi.getTimerCount()).toBe(0);
  layer.destroy();
});

test('destroy cancels the pending transition and animation frame and makes later publications inert',()=>{
  vi.useFakeTimers();const {document,host,layer,root}=mount();
  layer.publish(world(),viewport,1);layer.publish(world(-10),viewport,1);
  expect(vi.getTimerCount()).toBe(1);expect(document.frames.size).toBeGreaterThan(0);
  layer.destroy();layer.destroy();
  expect(vi.getTimerCount()).toBe(0);expect(document.frames.size).toBe(0);expect(host.children).not.toContain(root);
  const snapshot=JSON.stringify(root.dataset);layer.publish(world(1),viewport,1);expect(JSON.stringify(root.dataset)).toBe(snapshot);
});

test('changing camera photometry does not restart an entering star fade before its deadline',()=>{
  vi.useFakeTimers(); const {document,layer,root}=mount();
  layer.publish(world(),viewport,1); layer.publish(world(-10),viewport,1);
  for(let step=1;step<=10;step++) {
    layer.publish(world(-10-step*5, -step),viewport,1);
    document.frame(16); vi.advanceTimersByTime(16);
  }
  const point=find(layer,'star:0');
  const expected=pointPhotometry(fixture(),0,Math.hypot(-110+60,-100+10)).luminance;
  expect(Number(point.style.opacity)/expected).toBeGreaterThan(.85);
  layer.destroy();
});

test('reused outgoing slots start a fresh fade without retaining the previous opacity transition',()=>{
  vi.useFakeTimers();const {document,layer,root}=mount();
  layer.publish(world(-10),viewport,1);layer.publish(world(),viewport,1);
  document.frame();vi.advanceTimersByTime(180);
  layer.publish(world(-10),viewport,1);document.frame();vi.advanceTimersByTime(180);
  layer.publish(world(),viewport,1);
  const reused=leaves(root)[0]!;
  // The departed star is just beyond the frustum; bring it back during this fixed transition so its image is projectable.
  layer.publish(world(-10),viewport,1);
  expect(reused.style.visibility).not.toBe('hidden');
  expect(Number(reused.style.opacity)).toBeGreaterThan(0);
  expect(reused.style.transition ?? '').toBe('');
  layer.destroy();
});

test('canonical catalogue mounts only its fixed pool and preserves its full coverage during navigation',async()=>{
  const envelope=JSON.parse(await readFile(fileURLToPath(new URL('../../../objects/stellar-neighbourhood/prepared/stars.json',import.meta.url)),'utf8')) as {data:unknown};
  const payload=parsePreparedCssPointField(envelope.data),{layer,root}=mount(payload),slots=[...leaves(root)];
  expect(payload.stars.length).toBe(109389);expect(slots.length).toBe(4098);
  expect(layer.inspect().points).toHaveLength(4096);expect(layer.inspect().points.every(point=>Object.keys(point.element.dataset).length===0)).toBe(true);
  layer.publish(world(),viewport,1);expect(layer.inspect().coveredCount).toBe(109389);expect(layer.inspect().drawnCount).toBeGreaterThan(0);expect(layer.inspect().points.filter(point=>point.element.style.visibility!=='hidden' && point.reference).every(point=>point.reference!.startsWith('star:'))).toBe(true);
  layer.publish(world(10),viewport,1);expect(leaves(root)).toEqual(slots);expect(layer.inspect().coveredCount).toBe(109389);expect(layer.inspect().drawnCount).toBeGreaterThan(0);expect(layer.inspect().points.filter(point=>point.element.style.visibility!=='hidden' && point.reference).every(point=>point.reference!.startsWith('star:'))).toBe(true);
  layer.destroy();
});

test('changing the detailed object updates star occlusion without replacing the catalogue slots', () => {
  const { layer, root } = mount(), slots = [...leaves(root)];
  layer.publish(world(), viewport, 1);
  const visible = find(layer, 'star:2');
  layer.setOccluder({ positionM: [5 * parsec, 0, -50 * parsec], radiusM: 2 * parsec });
  layer.publish(world(), viewport, 1);
  expect(visible.style.visibility).toBe('hidden');
  layer.setOccluder({ positionM: [50 * parsec, 0, -50 * parsec], radiusM: parsec });
  layer.publish(world(), viewport, 1);
  expect(find(layer, 'star:2')).toBe(visible);
  expect(leaves(root)).toEqual(slots);
  layer.destroy();
});

test('background catalogue names can be suppressed without changing the prepared star points', () => {
  const data = fixture();
  const named = { ...data, stars: data.stars.map(star => ({ ...star, name: 'Aldebaran' })) };
  const annotated = mount(named), background = mount(named, false);
  for (const camera of [world(), world(5)]) {
    annotated.layer.publish(camera, viewport, 1);
    background.layer.publish(camera, viewport, 1);
    expect(leaves(annotated.root).some(node => node.className === 'prepared-star-label' && node.textContent === 'Aldebaran')).toBe(true);
    expect(leaves(background.root).some(node => node.className === 'prepared-star-label')).toBe(false);
    expect(background.root.dataset).toEqual(annotated.root.dataset);
    const presentation = (layer: ReturnType<typeof mountPreparedCssPointField>) =>
      Object.fromEntries(Object.entries(find(layer, 'star:2').style).filter(([, value]) => typeof value !== 'function'));
    expect(presentation(background.layer)).toEqual(presentation(annotated.layer));
  }
  annotated.layer.destroy(); background.layer.destroy();
  expect(background.document.frames.size).toBe(0);
});

test('publication suppresses floating-point noise but bounds actual parallax rounding below a thousandth of a pixel', () => {
  const { layer, root } = mount(fixture(), false);
  layer.publish(world(), viewport, 1);
  const slots = leaves(root); slots.forEach(slot => { slot.writes = 0; });
  layer.publish(world(.000001), viewport, 1);
  expect(slots.reduce((sum, slot) => sum + slot.writes, 0)).toBe(0);
  layer.publish(world(.123456789), viewport, 1);
  const expected = projectPreparedPoint(fixture().stars[2].positionUnits, [.123456789, 0, 0], [1,0,0,0,1,0,0,0,1], 400, 30, -20);
  const actual = center(find(layer, 'star:2'));
  expect(Math.abs(actual[0] - expected.x)).toBeLessThan(.001);
  expect(Math.abs(actual[1] - expected.y)).toBeLessThan(.001);
  layer.destroy();
});

test('an unchanged worker cut updates diagnostics without projecting the same image twice', () => {
  let worker: { onmessage: ((event: { data: unknown }) => void) | null; sent: unknown[] };
  class Worker {
    onmessage = null; onerror = null; sent: unknown[] = [];
    constructor() { worker = this; }
    postMessage(value: unknown) { this.sent.push(value); }
    terminate() {}
  }
  vi.stubGlobal('Worker', Worker);
  const { layer, document } = mount(fixture(), false);
  try {
    layer.publish(world(), viewport, 1);
    const before = layer.inspect();
    worker!.onmessage!({ data: { ready: true } });
    const request = worker!.sent.at(-1) as { id: number; view: Parameters<ReturnType<typeof createPointFieldSelection>>[0] };
    const selection = createPointFieldSelection(fixture())(request.view);
    worker!.onmessage!({ data: { id: request.id, selection: { ...selection, consideredCount: 123 } } });
    document.frame();
    const after = layer.inspect();
    expect(after.consideredCount).toBe(123);
    expect(after.renderPasses).toBe(before.renderPasses);
    expect(after.projectedPoints).toBe(before.projectedPoints);
    expect(after.points).toEqual(before.points);
    layer.publish(world(1), viewport, 1);
    expect(layer.inspect().projectedPoints).toBeGreaterThan(after.projectedPoints);
  } finally { layer.destroy(); vi.unstubAllGlobals(); }
});
