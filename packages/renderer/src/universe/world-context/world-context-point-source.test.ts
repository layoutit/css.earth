import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
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
const plan = parsePreparedWorldContext({ schema:'cssearth-world-context@2', frame:{referenceFrame:'sun-icrf',epochJdTt:1,originM:[0,0,0],presentationToReference:[1, 0, 0, 0, -1, 0, 0, 0, 1],metersPerUnit:1,bodyRadiusM:10},
  focus:{id:'sun',name:'Sun',color:'#f5a623',positionM:[0,0,0],radiusM:10,pointSource:{absoluteMagnitude:4.832125665882298,color:'#fff5e0',proximityEnhancement:{fullDistanceM:1e12,fadeOutDistanceM:1e14,radiusMultiplier:1.6,brightnessMultiplier:1.5}}},bodies:[{id:'mercury',name:'Mercury',color:'#999999',positionM:[1,0,0],radiusM:1,orbit:{centerBodyId:'sun',centerPositionM:[0,0,0],verticesM:[[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0]],trail:[1,1,1,1,1,1,1,1]}}],
  camera:{minimumDistanceM:11,maximumDistanceM:1e25,framingReferenceZoom:1,presentation:{projection:{model:'css-perspective-shared-with-sky',cssPerspective:'1px'},dolly:{model:'multiplicative-wheel-distance',wheelStepPerDelta:.1,minimumDistanceRadii:1.1,maximumDistanceOverOrbitExtent:1},levelOfDetail:{model:'silhouette-diameter-crossfade',billboardFadeStartDiscPixels:20,billboardFullDiscPixels:14,markerFadeStartDiscPixels:8,markerFullDiscPixels:4.5},orbitLineFade:{visibleBelowDiscHeightShare:.1,hiddenAboveDiscHeightShare:.2},drag:{model:'screen-axis-tumble'}}},volume:{objectId:'milky-way',fadeStartDistanceM:1e18,fullDistanceM:1e19},stars:{objectId:'stellar-neighbourhood',fadeStartDistanceM:1e12,fullDistanceM:1e15},system:{fadeOutStartDistanceM:1e14,hiddenDistanceM:1e15},sky:{sceneRegistration:'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'} });
const field: PreparedCssPointField = { schema:'cssearth-css-point-field@1',id:'stars',frame:{referenceFrame:'sun-icrf',epochJdTt:1,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:parsec,boundsUnits:{min:[-1,-1,-1],max:[1,1,1]}},stars:[{id:'star',positionUnits:[0,0,-1],absoluteMagnitude:0,colorIndex:0,name:null,coverageAnchor:false}],nodes:[{positionUnits:[0,0,-1],radiusUnits:0,absoluteMagnitude:0,colorIndex:0,first:0,count:1,children:[]}],atlas:{path:'points.png',columns:2,tileSize:32,colors:[[255,245,224],[0,0,0]],haloRadii:2.5},photometry:{minimumMagnitude:-10,maximumMagnitude:20,step:10,floor:1/255,limitingMagnitude:20,hintsLimitMagnitude:10,minimumRadiusPx:.6,samples:[{radiusPx:1,luminance:1},{radiusPx:1,luminance:.5},{radiusPx:1,luminance:.1},{radiusPx:1,luminance:0}]},policy:{activeSlots:1,transitionSlots:1,maxErrorPx:2,transitionMs:100},labels:{activeSlots:1,transitionSlots:1,capHeightPx:12,gapPx:7,maxAlpha:.55,fadeMs:300},resources:[{path:'points.png',bytes:1,width:64,height:32}] };
const viewport={focalPixels:400,widthPixels:800,heightPixels:600,principalOffsetPixels:[0,0] as const};
const world = (distanceM:number) => ({referenceFrame:'sun-icrf',epochJdTt:1,pose:{positionM:[0,0,distanceM] as const,orientationXyzw:[0,0,0,1] as const}});

test('focus point schema is optional, exact, and rejects malformed photometry', () => {
  assert.ok(Math.abs(plan.focus.pointSource!.absoluteMagnitude! - (4.832125665882298)) < 10 ** -12 / 2, `${plan.focus.pointSource?.absoluteMagnitude} is not close to ${4.832125665882298}`);
  const { pointSource: _pointSource, ...withoutPointSource } = plan.focus;
  assert.equal(parsePreparedWorldContext({ ...plan, focus: withoutPointSource }).focus.pointSource, undefined);
  assert.throws(() => parsePreparedWorldContext({ ...plan, focus:{ ...plan.focus, pointSource:{absoluteMagnitude:4.8,color:'yellow'} } }), /point color/);
  assert.throws(() => parsePreparedWorldContext({ ...plan, focus:{ ...plan.focus, pointSource:{...plan.focus.pointSource!,
    proximityEnhancement:{fullDistanceM:1e14,fadeOutDistanceM:1e12,radiusMultiplier:.5,brightnessMultiplier:1} } } }), /proximity/);
});

test('point source uses the prepared star photometry, nearest atlas color, and selected-detail handoff', () => {
  assert.equal(worldContextPointSourceFade(4.5,plan), 1); assert.equal(worldContextPointSourceFade(20,plan), 0); assert.ok(Math.abs(worldContextPointSourceFade(12.25,plan) - (.5)) < 10 ** -12 / 2, `${worldContextPointSourceFade(12.25,plan)} is not close to ${.5}`);
  assert.deepEqual(worldContextPointSourceGain(1e12,plan), {radius:1.6,brightness:1.5});
  assert.deepEqual(worldContextPointSourceGain(1e13,plan), {radius:1.3,brightness:1.25});
  assert.deepEqual(worldContextPointSourceGain(1e14,plan), {radius:1,brightness:1});
  const distanceForThirtyPixelDisc=10*Math.sqrt(1+(800/30)**2);
  const near=worldContextPointAppearance(plan,field,world(distanceForThirtyPixelDisc),viewport)!;
  assert.ok(Math.abs(near.diameterPx - (30)) < 10 ** -10 / 2, `${near.diameterPx} is not close to ${30}`);
  assert.ok((near.radiusPx * 2) >= near.diameterPx);
  assert.ok((near.radiusPx * 2) < near.diameterPx * 1.02);
  const widerHalo = worldContextPointAppearance(plan, { ...field, atlas: { ...field.atlas, haloRadii: 5 } }, world(distanceForThirtyPixelDisc), viewport)!;
  assert.equal(widerHalo.radiusPx, near.radiusPx);
  const distant=worldContextPointAppearance(plan,field,world(10*parsec),viewport)!;
  assert.ok(Math.abs(distant.magnitude - (4.832125665882298)) < 10 ** -12 / 2, `${distant.magnitude} is not close to ${4.832125665882298}`); assert.equal(distant.colorIndex, 0); assert.equal(distant.opacity, 1);
  const distanceForMidpoint=10*Math.sqrt(1+(800/12.25)**2);
  const detailed=worldContextPointAppearance(plan,field,world(distanceForMidpoint),viewport,{selectedDetail:true})!;
  const undetailed=worldContextPointAppearance(plan,field,world(distanceForMidpoint),viewport,{selectedDetail:false})!;
  assert.ok(Math.abs(detailed.opacity - (.5)) < 10 ** -10 / 2, `${detailed.opacity} is not close to ${.5}`); assert.equal(undetailed.opacity, 1);
  assert.equal(worldContextPointAppearance(plan,field,world(10*parsec),viewport,{occluder:{positionM:[0,0,5*parsec],radiusM:1}}), null);
});

test('the prepared Sun landmark grows smoothly from the light-year handoff without changing its physical disc', async () => {
  const source = JSON.parse(await readFile(new URL('../../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8'));
  const solarPlan = parsePreparedWorldContext(source), au = 149597870700, lightYearM = 299792458 * 31557600;
  const sample = (distanceAu: number, context = solarPlan) => worldContextPointAppearance(context, field,
    { ...world(distanceAu * au), epochJdTt: context.frame.epochJdTt }, { ...viewport, focalPixels: 1280 * Math.sqrt(3) / 2 }, { selectedDetail: true })!;
  const unenhanced = { ...solarPlan, focus: { ...solarPlan.focus, pointSource: {
    ...solarPlan.focus.pointSource!, proximityEnhancement: undefined,
  } } };
  const near = sample(5), plain = sample(5, unenhanced);
  assert.equal(near.diameterPx, plain.diameterPx);
  assert.ok(near.radiusPx > plain.radiusPx * 1.7);
  assert.ok((near.radiusPx * 2 * field.atlas.haloRadii) < 16);
  let previous = sample(1).radiusPx;
  for (const distanceAu of [2, 5, 10, 20, 50, 100, 300, 1000, 10_000, 30_000, lightYearM / au]) {
    const appearance = sample(distanceAu);
    // The authored glow shrinks smoothly until it reaches the navigation core floor.
    if (previous > 1.2) assert.ok(appearance.radiusPx < previous);
    else assert.equal(appearance.radiusPx, previous);
    assert.ok((sample(distanceAu * 1.001).radiusPx / appearance.radiusPx) > .995);
    previous = appearance.radiusPx;
  }
  assert.equal(sample(30_000).radiusPx, 1.2);
  assert.equal(sample(lightYearM / au).radiusPx, sample(lightYearM / au, unenhanced).radiusPx);
});

test('mount retains one PSF node, activates the actual point hit target, and removes it on destroy', () => {
  const document=new Document(),host=document.createElement(),before=document.createElement();host.appendChild(before);
  let selected = '';
  host.addEventListener('objectnavigate', event => { selected = (event as CustomEvent<{objectId:string}>).detail.objectId; });
  const layer=mountWorldContextPointSource({host:host as unknown as HTMLElement,before:before as unknown as globalThis.Element,plan,field,resolveResource:path=>`/prepared/${path}`});
  assert.notEqual(layer, null); layer!.publish(world(10*parsec),viewport);
  const element=layer!.element as unknown as Element;
  assert.ok(element.style.backgroundImage.includes('points.png')); assert.equal(element.style.visibility, ''); assert.ok(element.style.transform.includes('scale('));
  assert.equal(element.dataset.objectNavigate, 'sun'); assert.equal(element.style.pointerEvents, 'auto'); assert.equal(element.style.cursor, 'pointer');
  element.dispatchEvent(new Event('click',{cancelable:true})); assert.equal(selected, 'sun');
  layer!.publish(world(10*parsec),viewport,{occluder:{positionM:[0,0,5*parsec],radiusM:1}});
  assert.equal(element.style.visibility, 'hidden'); assert.equal(element.style.pointerEvents, 'none');
  layer!.destroy(); assert.ok(!host.children.includes(element));
});

test('off-screen focus points leave keyboard navigation after the coast, using the measured viewport', () => {
  const document = new Document(), host = document.createElement(), before = document.createElement();
  host.appendChild(before);
  const layer = mountWorldContextPointSource({ host: host as unknown as HTMLElement,
    before: before as unknown as globalThis.Element, plan, field, resolveResource: path => path })!;
  const visible = world(10 * parsec);
  const outside = { ...visible, pose: { ...visible.pose, positionM: [1000 * parsec, 0, 10 * parsec] as const } };
  layer.publish(visible, viewport);
  const element = layer.element as unknown as Element;
  assert.equal(element.tabIndex, 0);
  const attributes = new Map(element.attributes), data = { ...element.dataset };
  layer.setCoasting(true);
  layer.publish(outside, viewport);
  assert.equal(element.tabIndex, 0);
  assert.deepEqual(element.attributes, attributes);
  assert.deepEqual(element.dataset, data);
  layer.setCoasting(false);
  layer.publish(outside, viewport);
  assert.equal(element.tabIndex, -1);
  assert.equal(element.attributes.has('role'), false);
  layer.publish(visible, viewport);
  assert.equal(element.tabIndex, 0);
  assert.equal(element.attributes.get('aria-label'), 'Go to Sun');
  layer.destroy();
});


test('the Sun landmark stays faintly visible beyond the physical photometry limit at maximum zoom', () => {
  const document = new Document(), host = document.createElement(), before = document.createElement(); host.appendChild(before);
  const layer = mountWorldContextPointSource({host: host as unknown as HTMLElement, before: before as unknown as globalThis.Element,
    plan, field, resolveResource: path => path})!;
  layer.publish(world(plan.camera.maximumDistanceM), viewport, {opacity: .55, selectedDetail: true});
  assert.equal(layer.element.style.visibility, '');
  assert.ok(Math.abs(Number(layer.element.style.opacity) - (.3575)) < 10 ** -2 / 2, `${Number(layer.element.style.opacity)} is not close to ${.3575}`);
  assert.equal(layer.element.dataset.objectNavigate, 'sun');
  layer.publish(world(plan.camera.maximumDistanceM), viewport, {opacity: .55, selectedDetail: true,
    occluder: {positionM: [0, 0, plan.camera.maximumDistanceM / 2], radiusM: 10}});
  assert.equal(layer.element.style.visibility, 'hidden');
  layer.destroy();
});

test('an unresolved focus keeps a readable navigation core at stellar and maximum distances', () => {
  const faint = { ...field, photometry: { ...field.photometry,
    samples: field.photometry.samples.map(() => ({ radiusPx: 0, luminance: 0 })) } };
  for (const distance of [101.51 * 299792458 * 31557600, plan.camera.maximumDistanceM]) {
    const appearance = worldContextPointAppearance(plan, faint, world(distance), viewport, { selectedDetail: true })!;
    assert.ok(appearance.diameterPx < 1);
    // Match the default body-marker diameter; a 1.2 px PSF core vanishes after downsampling.
    assert.ok((appearance.radiusPx * 2) >= 2.4);
    assert.ok(appearance.luminance >= .65);
    assert.equal(appearance.opacity, 1);
  }
});
