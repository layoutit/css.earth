import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { PreparedCssPointField } from '../../stars/types.js';
import { parsePreparedWorldContext } from '../../prepared-data/world-context.js';
import { mountWorldContextPointSource, worldContextPointAppearance, worldContextPointSourceFade, worldContextPointSourceGain } from './world-context-point-source.js';

const parsec = 3.085677581491367e16;
class Element extends EventTarget {
  readonly children: Element[] = []; readonly style: Record<string, string> = {}; readonly dataset: Record<string, string> = {};
  parentNode: Element | null = null; clientWidth = 800; clientHeight = 600;
  tabIndex = -1; readonly attributes = new Map<string, string>();
  readonly ownerDocument: Document;
  constructor(ownerDocument: Document) { super(); this.ownerDocument = ownerDocument; }
  appendChild(child: Element) { this.insertBefore(child, null); return child; }
  insertBefore(child: Element, before: Element | null) { child.remove(); child.parentNode = this; const index = before === null ? this.children.length : this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, child); }
  remove() { if (this.parentNode) { const index = this.parentNode.children.indexOf(this); if (index >= 0) this.parentNode.children.splice(index, 1); this.parentNode = null; } }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
class Document { createElement() { return new Element(this); } }
const plan = parsePreparedWorldContext({ schema:'cssearth-world-context@1', frame:{referenceFrame:'sun-icrf',epochJdTt:1,originM:[0,0,0],presentationToReference:[1, 0, 0, 0, -1, 0, 0, 0, 1],metersPerUnit:1,bodyRadiusM:10},
  focus:{id:'sun',name:'Sun',color:'#f5a623',positionM:[0,0,0],radiusM:10,pointSource:{absoluteMagnitude:4.832125665882298,color:'#fff5e0',proximityEnhancement:{fullDistanceM:1e12,fadeOutDistanceM:1e14,radiusMultiplier:1.6,brightnessMultiplier:1.5}}},bodies:[{id:'mercury',name:'Mercury',color:'#999999',positionM:[1,0,0],radiusM:1,orbit:{centerBodyId:'sun',centerPositionM:[0,0,0],verticesM:[[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0]],trail:[1,1,1,1,1,1,1,1]}}],
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
  expect(near.diameterPx).toBeCloseTo(30,10);
  expect(near.radiusPx * 2).toBeGreaterThanOrEqual(near.diameterPx);
  expect(near.radiusPx * 2).toBeLessThan(near.diameterPx * 1.02);
  const widerHalo = worldContextPointAppearance(plan, { ...field, atlas: { ...field.atlas, haloRadii: 5 } }, world(distanceForThirtyPixelDisc), viewport)!;
  expect(widerHalo.radiusPx).toBe(near.radiusPx);
  const distant=worldContextPointAppearance(plan,field,world(10*parsec),viewport)!;
  expect(distant.magnitude).toBeCloseTo(4.832125665882298,12); expect(distant.colorIndex).toBe(0); expect(distant.opacity).toBe(1);
  const distanceForMidpoint=10*Math.sqrt(1+(800/12.25)**2);
  const detailed=worldContextPointAppearance(plan,field,world(distanceForMidpoint),viewport,{selectedDetail:true})!;
  const undetailed=worldContextPointAppearance(plan,field,world(distanceForMidpoint),viewport,{selectedDetail:false})!;
  expect(detailed.opacity).toBeCloseTo(.5,10); expect(undetailed.opacity).toBe(1);
  expect(worldContextPointAppearance(plan,field,world(10*parsec),viewport,{occluder:{positionM:[0,0,5*parsec],radiusM:1}})).toBeNull();
});

test('the prepared Sun landmark grows smoothly from the light-year handoff without changing its physical disc', async () => {
  const source = JSON.parse(await readFile(new URL('../../../../objects/sun/prepared/world-context.json', import.meta.url), 'utf8'));
  const solarPlan = parsePreparedWorldContext(source), au = 149597870700, lightYearM = 299792458 * 31557600;
  const sample = (distanceAu: number, context = solarPlan) => worldContextPointAppearance(context, field,
    { ...world(distanceAu * au), epochJdTt: context.frame.epochJdTt }, { ...viewport, focalPixels: 1280 * Math.sqrt(3) / 2 }, { selectedDetail: true })!;
  const unenhanced = { ...solarPlan, focus: { ...solarPlan.focus, pointSource: {
    ...solarPlan.focus.pointSource!, proximityEnhancement: undefined,
  } } };
  const near = sample(5), plain = sample(5, unenhanced);
  expect(near.diameterPx).toBe(plain.diameterPx);
  expect(near.radiusPx).toBeGreaterThan(plain.radiusPx * 1.7);
  expect(near.radiusPx * 2 * field.atlas.haloRadii).toBeLessThan(16);
  let previous = sample(1).radiusPx;
  for (const distanceAu of [2, 5, 10, 20, 50, 100, 300, 1000, 10_000, 30_000, lightYearM / au]) {
    const appearance = sample(distanceAu);
    // The authored glow shrinks smoothly until it reaches the navigation core floor.
    if (previous > 1.2) expect(appearance.radiusPx).toBeLessThan(previous);
    else expect(appearance.radiusPx).toBe(previous);
    expect(sample(distanceAu * 1.001).radiusPx / appearance.radiusPx).toBeGreaterThan(.995);
    previous = appearance.radiusPx;
  }
  expect(sample(30_000).radiusPx).toBe(1.2);
  expect(sample(lightYearM / au).radiusPx).toBe(sample(lightYearM / au, unenhanced).radiusPx);
});

test('mount retains one PSF node, activates the actual point hit target, and removes it on destroy', () => {
  const document=new Document(),host=document.createElement(),before=document.createElement();host.appendChild(before);
  let selected = '';
  host.addEventListener('objectnavigate', event => { selected = (event as CustomEvent<{objectId:string}>).detail.objectId; });
  const layer=mountWorldContextPointSource({host:host as unknown as HTMLElement,before:before as unknown as globalThis.Element,plan,field,resolveResource:path=>`/prepared/${path}`});
  expect(layer).not.toBeNull(); layer!.publish(world(10*parsec),viewport);
  const element=layer!.element as unknown as Element;
  expect(element.style.backgroundImage).toContain('points.png'); expect(element.style.visibility).toBe(''); expect(element.style.transform).toContain('scale(');
  expect(element.dataset.objectNavigate).toBe('sun'); expect(element.style.pointerEvents).toBe('auto'); expect(element.style.cursor).toBe('pointer');
  element.dispatchEvent(new Event('click',{cancelable:true})); expect(selected).toBe('sun');
  layer!.publish(world(10*parsec),viewport,{occluder:{positionM:[0,0,5*parsec],radiusM:1}});
  expect(element.style.visibility).toBe('hidden'); expect(element.style.pointerEvents).toBe('none');
  layer!.destroy(); expect(host.children).not.toContain(element);
});


test('the Sun landmark stays faintly visible beyond the physical photometry limit at maximum zoom', () => {
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const layer = mountWorldContextPointSource({host: host as unknown as HTMLElement, before: before as unknown as globalThis.Element,
    plan, field, resolveResource: path => path})!;
  layer.publish(world(plan.camera.maximumDistanceM), viewport, {opacity: .55, selectedDetail: true});
  expect(layer.element.style.visibility).toBe('');
  expect(Number(layer.element.style.opacity)).toBeCloseTo(.3575);
  expect(layer.element.dataset.objectNavigate).toBe('sun');
  layer.publish(world(plan.camera.maximumDistanceM), viewport, {opacity: .55, selectedDetail: true,
    occluder: {positionM: [0, 0, plan.camera.maximumDistanceM / 2], radiusM: 10}});
  expect(layer.element.style.visibility).toBe('hidden');
  layer.destroy();
});

test('an unresolved focus keeps a readable navigation core at stellar and maximum distances', () => {
  const faint = { ...field, photometry: { ...field.photometry,
    samples: field.photometry.samples.map(() => ({ radiusPx: 0, luminance: 0 })) } };
  for (const distance of [101.51 * 299792458 * 31557600, plan.camera.maximumDistanceM]) {
    const appearance = worldContextPointAppearance(plan, faint, world(distance), viewport, { selectedDetail: true })!;
    expect(appearance.diameterPx).toBeLessThan(1);
    // Match the default body-marker diameter; a 1.2 px PSF core vanishes after downsampling.
    expect(appearance.radiusPx * 2).toBeGreaterThanOrEqual(2.4);
    expect(appearance.luminance).toBeGreaterThanOrEqual(.65);
    expect(appearance.opacity).toBe(1);
  }
});
