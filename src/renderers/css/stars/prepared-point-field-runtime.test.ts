import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, test, vi } from 'vitest';
import { mountPreparedCssPointField, pointPhotometry, projectPreparedPoint } from './prepared-point-field-runtime.js';
import { parsePreparedCssPointField } from './validation.js';
import type { PreparedCssPointField } from './types.js';
import type { WorldCameraPose } from '../navigation/world-camera.js';

class FakeElement {
  readonly children: FakeElement[] = []; readonly style: Record<string,string> = {}; readonly dataset: Record<string,string> = {};
  parentNode: FakeElement|null = null; className=''; ariaHidden=''; textContent=''; clientWidth=800; clientHeight=600;
  constructor(readonly ownerDocument: FakeDocument) {}
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
function mount(payload=fixture()) {
  const document=new FakeDocument(),host=document.createElement(),before=document.createElement();host.appendChild(before);
  const resolveResource=vi.fn((path:string)=>`/prepared/${path}`);
  const layer=mountPreparedCssPointField({host:host as unknown as HTMLElement,before:before as unknown as Element,payload,resolveResource});
  return {document,host,before,layer,root:layer.root as unknown as FakeElement,resolveResource};
}
function find(root:FakeElement,reference:string):FakeElement {
  const element=root.children.find(child=>child.dataset.starReference===reference && child.style.visibility!=='hidden');
  if(!element)throw new Error(`No visible slot for ${reference}`);return element;
}
function center(element:FakeElement):readonly [number,number] {
  const match=/translate\(([-\d.e+]+)px,([-\d.e+]+)px\) scale\(([-\d.e+]+)\)/.exec(element.style.transform??'');
  if(!match)throw new Error('Point slot has no prepared projection');
  const half=Number(match[3])*32/2;return [Number(match[1])+half,Number(match[2])+half];
}
afterEach(()=>vi.useRealTimers());

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
  const survivor=find(root,'star:2'),slots=[...root.children];
  expect(center(survivor)[0]).toBeCloseTo(70,12);
  layer.publish(world(-10),viewport,1);
  expect(find(root,'star:2')).toBe(survivor);expect(Number(survivor.style.opacity)).toBeGreaterThan(0);
  expect(find(root,'star:0').style.opacity).toBe('0');
  document.frame();expect(Number(find(root,'star:0').style.opacity)).toBeGreaterThan(0);
  layer.publish(world(5,0),viewport,1);
  expect(center(survivor)[0]).toBeCloseTo(50,12);
  layer.publish(world(5,0,[0,0,Math.SQRT1_2,Math.SQRT1_2]),viewport,1);
  expect(center(survivor)[0]).toBeCloseTo(30,12);expect(center(survivor)[1]).toBeCloseTo(-40,12);
  expect(root.children).toEqual(slots);expect(root.dataset.catalogueCount).toBe('3');expect(root.dataset.coveredCount).toBe('3');
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
  const point=find(root,'star:0');
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
  const reused=root.children[0]!;
  // The departed star is just beyond the frustum; bring it back during this fixed transition so its image is projectable.
  layer.publish(world(-10),viewport,1);
  expect(reused.style.visibility).not.toBe('hidden');
  expect(Number(reused.style.opacity)).toBeGreaterThan(0);
  expect(reused.style.transition ?? '').toBe('');
  layer.destroy();
});

test('canonical catalogue mounts only its fixed pool and preserves its full coverage during navigation',async()=>{
  const envelope=JSON.parse(await readFile(fileURLToPath(new URL('../../../objects/stellar-neighbourhood/prepared/stars.json',import.meta.url)),'utf8')) as {data:unknown};
  const payload=parsePreparedCssPointField(envelope.data),{layer,root}=mount(payload),slots=[...root.children];
  expect(payload.stars.length).toBe(109389);expect(slots.length).toBe(4098);
  expect(slots.filter(slot=>'starSlot' in slot.dataset)).toHaveLength(4096);
  layer.publish(world(),viewport,1);expect(root.dataset.coveredCount).toBe('109389');expect(Number(root.dataset.drawnCount)).toBeGreaterThan(0);expect(root.children.filter(slot=>slot.style.visibility!=='hidden' && slot.dataset.starReference).every(slot=>slot.dataset.starReference!.startsWith('star:'))).toBe(true);
  layer.publish(world(10),viewport,1);expect(root.children).toEqual(slots);expect(root.dataset.coveredCount).toBe('109389');expect(Number(root.dataset.drawnCount)).toBeGreaterThan(0);expect(root.children.filter(slot=>slot.style.visibility!=='hidden' && slot.dataset.starReference).every(slot=>slot.dataset.starReference!.startsWith('star:'))).toBe(true);
  layer.destroy();
});
