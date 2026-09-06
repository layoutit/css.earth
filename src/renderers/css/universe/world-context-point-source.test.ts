import { expect, test } from 'vitest';
import type { PreparedCssPointField } from '../stars/types.js';
import { parsePreparedWorldContext } from './prepared-world-context.js';
import { mountWorldContextPointSource, worldContextPointAppearance, worldContextPointSourceFade, worldContextPointSourceGain } from './world-context-point-source.js';

const parsec = 3.085677581491367e16;
class Element extends EventTarget {
  readonly children: Element[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: Element | null = null; clientWidth = 800; clientHeight = 600;
  tabIndex = -1; readonly attributes = new Map<string, string>();
  constructor(readonly ownerDocument: Document) { super(); }
  appendChild(child: Element) { this.insertBefore(child, null); return child; }
  insertBefore(child: Element, before: Element | null) { child.remove(); child.parentNode = this; const index = before === null ? this.children.length : this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, child); }
  remove() { if (this.parentNode) { const index = this.parentNode.children.indexOf(this); if (index >= 0) this.parentNode.children.splice(index, 1); this.parentNode = null; } }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
class Document { createElement() { return new Element(this); } }
const plan = parsePreparedWorldContext({ schema:'cssearth-world-context@1', frame:{referenceFrame:'sun-icrf',epochJdTt:1,originM:[0,0,0],presentationToReference:[1,0,0,0,1,0,0,0,1],metersPerUnit:1,bodyRadiusM:10},
  focus:{id:'sun',name:'Sun',color:'#f5a623',positionM:[0,0,0],radiusM:10,pointSource:{absoluteMagnitude:4.832125665882298,color:'#fff5e0',proximityEnhancement:{fullDistanceM:1e12,fadeOutDistanceM:1e14,radiusMultiplier:1.6,brightnessMultiplier:1.5}}},bodies:[{id:'mercury',name:'Mercury',color:'#999999',positionM:[1,0,0],radiusM:1,orbit:{verticesM:[[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0]],trail:[1,1,1,1,1,1,1,1]}}],
  camera:{minimumDistanceM:11,maximumDistanceM:1e25,framingReferenceZoom:1,presentation:{projection:{model:'css-perspective-shared-with-sky',cssPerspective:'1px'},dolly:{model:'multiplicative-wheel-distance',wheelStepPerDelta:.1,minimumDistanceRadii:1.1,maximumDistanceOverOrbitExtent:1},levelOfDetail:{model:'silhouette-diameter-crossfade',billboardFadeStartDiscPixels:20,billboardFullDiscPixels:14,markerFadeStartDiscPixels:8,markerFullDiscPixels:4.5},orbitLineFade:{visibleBelowDiscHeightShare:.1,hiddenAboveDiscHeightShare:.2},drag:{model:'screen-axis-tumble'}}},volume:{objectId:'milky-way',fadeStartDistanceM:1e18,fullDistanceM:1e19},stars:{objectId:'stellar-neighbourhood',fadeStartDistanceM:1e12,fullDistanceM:1e15},system:{fadeOutStartDistanceM:1e14,hiddenDistanceM:1e15},sky:{sceneRegistration:'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'} });
const field: PreparedCssPointField = { schema:'cssearth-css-point-field@1',id:'stars',frame:{referenceFrame:'sun-icrf',epochJdTt:1,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:parsec,boundsUnits:{min:[-1,-1,-1],max:[1,1,1]}},stars:[{id:'star',positionUnits:[0,0,-1],absoluteMagnitude:0,colorIndex:0,name:null,coverageAnchor:false}],nodes:[{positionUnits:[0,0,-1],radiusUnits:0,absoluteMagnitude:0,colorIndex:0,first:0,count:1,children:[]}],atlas:{path:'points.png',columns:2,tileSize:32,colors:[[255,245,224],[0,0,0]],haloRadii:2.5},photometry:{minimumMagnitude:-10,maximumMagnitude:20,step:10,floor:1/255,limitingMagnitude:20,hintsLimitMagnitude:10,minimumRadiusPx:.6,samples:[{radiusPx:1,luminance:1},{radiusPx:1,luminance:.5},{radiusPx:1,luminance:.1},{radiusPx:1,luminance:0}]},policy:{activeSlots:1,transitionSlots:1,maxErrorPx:2,transitionMs:100},labels:{activeSlots:1,transitionSlots:1,capHeightPx:12,gapPx:7,maxAlpha:.55,fadeMs:300},resources:[{path:'points.png',sha256:'0'.repeat(64),bytes:1,width:64,height:32}],provenance:{} };
const viewport={focalPixels:400,principalOffsetPixels:[0,0] as const};
const world = (distanceM:number) => ({referenceFrame:'sun-icrf',epochJdTt:1,pose:{positionM:[0,0,distanceM] as const,orientationXyzw:[0,0,0,1] as const}});

test('focus point schema is optional, exact, and rejects malformed photometry', () => {
  expect(plan.focus.pointSource?.absoluteMagnitude).toBeCloseTo(4.832125665882298, 12);
  const { pointSource: _pointSource, ...withoutPointSource } = plan.focus;
  expect(parsePreparedWorldContext({ ...plan, focus: withoutPointSource }).focus.pointSource).toBeUndefined();
  expect(() => parsePreparedWorldContext({ ...plan, focus:{ ...plan.focus, pointSource:{absoluteMagnitude:4.8,color:'yellow'} } })).toThrow('point color');
  expect(() => parsePreparedWorldContext({ ...plan, focus:{ ...plan.focus, pointSource:{...plan.focus.pointSource!,
    proximityEnhancement:{fullDistanceM:1e14,fadeOutDistanceM:1e12,radiusMultiplier:.5,brightnessMultiplier:1} } } })).toThrow('proximity');
});

test('point source uses the prepared star photometry, nearest atlas color, and selected-detail handoff', () => {
  expect(worldContextPointSourceFade(4.5,plan)).toBe(1); expect(worldContextPointSourceFade(20,plan)).toBe(0); expect(worldContextPointSourceFade(12.25,plan)).toBeCloseTo(.5,12);
  expect(worldContextPointSourceGain(1e12,plan)).toEqual({radius:1.6,brightness:1.5});
  expect(worldContextPointSourceGain(1e13,plan)).toEqual({radius:1.3,brightness:1.25});
  expect(worldContextPointSourceGain(1e14,plan)).toEqual({radius:1,brightness:1});
  const distanceForThirtyPixelDisc=10*Math.sqrt(1+(800/30)**2);
  const near=worldContextPointAppearance(plan,field,world(distanceForThirtyPixelDisc),viewport)!;
  expect(near.diameterPx).toBeCloseTo(30,10); expect(near.radiusPx*2*field.atlas.haloRadii).toBeCloseTo(30,10);
  const distant=worldContextPointAppearance(plan,field,world(10*parsec),viewport)!;
  expect(distant.magnitude).toBeCloseTo(4.832125665882298,12); expect(distant.colorIndex).toBe(0); expect(distant.opacity).toBe(1);
  const distanceForMidpoint=10*Math.sqrt(1+(800/12.25)**2);
  const detailed=worldContextPointAppearance(plan,field,world(distanceForMidpoint),viewport,{selectedDetail:true})!;
  const undetailed=worldContextPointAppearance(plan,field,world(distanceForMidpoint),viewport,{selectedDetail:false})!;
  expect(detailed.opacity).toBeCloseTo(.5,10); expect(undetailed.opacity).toBe(1);
  expect(worldContextPointAppearance(plan,field,world(10*parsec),viewport,{occluder:{positionM:[0,0,5*parsec],radiusM:1}})).toBeNull();
});

test('mount retains one PSF node, activates the actual point hit target, and removes it on destroy', () => {
  const document=new Document(),host=document.createElement(),before=document.createElement();host.appendChild(before);
  let selected = '';
  host.addEventListener('objectnavigate', event => { selected = (event as CustomEvent<{objectId:string}>).detail.objectId; });
  const layer=mountWorldContextPointSource({host:host as unknown as HTMLElement,before:before as unknown as Element,plan,field,resolveResource:path=>`/prepared/${path}`});
  expect(layer).not.toBeNull(); layer!.publish(world(10*parsec),viewport);
  const element=layer!.element as unknown as Element;
  expect(element.style.backgroundImage).toContain('points.png'); expect(element.style.visibility).toBe(''); expect(element.style.transform).toContain('scale(');
  expect(element.dataset.objectNavigate).toBe('sun'); expect(element.style.pointerEvents).toBe('auto'); expect(element.style.cursor).toBe('pointer');
  element.dispatchEvent(new Event('click',{cancelable:true})); expect(selected).toBe('sun');
  layer!.publish(world(10*parsec),viewport,{occluder:{positionM:[0,0,5*parsec],radiusM:1}});
  expect(element.style.visibility).toBe('hidden'); expect(element.style.pointerEvents).toBe('none');
  layer!.destroy(); expect(host.children).not.toContain(element);
});
