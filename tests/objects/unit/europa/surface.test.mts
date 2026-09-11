import {parseObservedSource,parseColorSource} from '../observed-atlas-proof.mts';
import {required} from '../../../../tools/test-values.mts';
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {publishedObservation,canonicalPoint,expectedMonochromeTexel,assertDisplayClose} from "../observed-atlas-proof.mts";
import { fromFile } from "geotiff";
import {createSourceManifest} from "../../../../src/platform/source-manifest.mts";
const source = await createSourceManifest({planetId:"europa",planetName:"Europa",sourceRoot:new URL("../../../../src/planets/europa/source/",import.meta.url).pathname});
const verifyEuropaSourceManifest = () => source.verify();
function europaSourceInputsFor(consumer:"surfaces"): ReturnType<typeof parseObservedSource>[];
function europaSourceInputsFor(consumer:"color"): ReturnType<typeof parseColorSource>[];
function europaSourceInputsFor(consumer:"surfaces"|"color"){return consumer==="surfaces"?source.inputsFor(consumer).map(parseObservedSource):source.inputsFor(consumer).map(parseColorSource);}
import config from "../../../../src/planets/europa/source/preparation/terrestrial.json" with {type:"json"};
import {colorPhotometricGain as gain,loadControlledObservationGeometry,matchObservedColorLevels} from "../../../../tools/objects/terrestrial-layers/photometric-observations.mts";
import type { RgbObservation } from "../../../../tools/objects/terrestrial-layers/contracts.mts";
import type { ObservationGeometry } from "../../../../tools/objects/terrestrial-layers/contracts.mts";
const recipe=config.raster.observedColors[0].photometry;
const COLOR_PHOTOMETRY=recipe.profile;
const colorPhotometricGain=(normal: readonly number[],geometry: ObservationGeometry,weight: number)=>gain(normal,geometry,weight,COLOR_PHOTOMETRY);
const loadColorGeometry=async()=>loadControlledObservationGeometry({sourceDirectory:new URL("../../../../src/planets/europa/source/",import.meta.url).pathname,entries:(await source.validateGroup(recipe.consumer)).map(parseColorSource),vectors:recipe.vectors});
const matchEuropaColorLevels=(color: Pick<{ rgb: Float32Array<ArrayBuffer>; missing: Uint8Array<ArrayBuffer>; owners: Uint8Array<ArrayBuffer>; observationNames: string[]; coverage: Record<string,{ pixels: number; surfacePercent: number; }>; photometry: { observations: Record<string,{ correctedPixels: number; withheldPixels: number; }>; correctedPixels: number; withheldPixels: number; radiusKm: number; maximumIncidenceDegrees: number; maximumEmissionDegrees: number; referenceIncidenceDegrees: number; referenceEmissionDegrees: number; observationWeights: Record<string,number>; }; sourceIds: string[]|undefined; },"rgb"|"observationNames"|"owners">,monochrome: RgbObservation,size: { width: number; height: number; boundaryPixels?: number; luminance?: readonly number[]; })=>matchObservedColorLevels(color,monochrome,{...size,...recipe.levels});

test("observed terrain survives preparation and explicit polar no-data stays marked", async () => {
  await verifyEuropaSourceManifest();
  const sourcePath = new URL("../../../../src/planets/europa/source/europa-global-500m.tif", import.meta.url).pathname;
  const tiff = await fromFile(sourcePath);
  const source = await tiff.getImage();
  assert.equal(source.getGDALNoData(), 0);
  const bottom = await source.readRasters({window:[9800,9815,9830,9816], interleave:true});
  assert.ok(bottom.every(value => value === 0));
  await tiff.close();
  const map=await publishedObservation('europa','normal');
  assert.equal(map.record.layout.width,4096);assert.equal(map.record.layout.height,2048);
  const original=await fromFile(sourcePath);
  try {
    const image=await original.getImage();
    assert.deepEqual(image.getOrigin().slice(0,2),[-4907750.3455436,2453875.1727718]);
    assert.deepEqual(image.getResolution().slice(0,2),[499.97456657942,-499.97456657942]);
    const entry=europaSourceInputsFor('surfaces').find(e=>e.lensId==='normal');
    for(const [x,y]of [[700,750],[1500,1024],[2400,900],[3100,1100]] as const){
      const p=canonicalPoint(x,y,4096,2048),actual=map.sample(p.longitude,p.latitude);
      const value=await expectedMonochromeTexel(image,entry,map.record.layout,actual);
      assertDisplayClose(actual.rgb,[value,value,value],`native source-window anchor ${x},${y}`);
    }
  } finally {await original.close();}
  const southPoint=canonicalPoint(2048,2047,4096,2048);
  assertDisplayClose(map.sample(southPoint.longitude,southPoint.latitude).rgb,[82,84,82],'Published polar gap stays gray in the actual pole atlas');
  const enhanced=await publishedObservation('europa','enhanced');
  const metadata={surfaces:[map.record,enhanced.record]};
  assert.ok(map.record.missingPixels>0);assert.ok(map.record.missingPixels<4096*2048/10);
  // Retain the independent fallback anchors, including the excluded coarse
  // 28ESGLOCOL01 patches; only terminal WebP codec error is tolerated.
  for(const [x,y]of [[700,750],[3100,1100],[2048,2047],[2500,400],[2300,500],[1900,750]] as const){
    const p=canonicalPoint(x,y,4096,2048);
    assertDisplayClose(enhanced.sample(p.longitude,p.latitude).rgb,map.sample(p.longitude,p.latitude).rgb,'Monochrome terrain and true gaps remain outside color coverage');
  }
  const colorPoint=canonicalPoint(1500,700,4096,2048);
  assert.notDeepEqual(enhanced.sample(colorPoint.longitude,colorPoint.latitude).rgb,map.sample(colorPoint.longitude,colorPoint.latitude).rgb,'Observed color overlays the base');
  assert.ok(required(enhanced.record.monochromePixels)>4096*2048/2);
  const photometry = required(metadata.surfaces[1].photometry);
  const observations = new Set(europaSourceInputsFor("color").map(image => image.observation));
  assert.deepEqual(new Set(Object.keys(photometry.observations)), observations);
  for (const observation of observations) {
    assert.ok(photometry.observations[observation].correctedPixels > 0, `${observation} receives correction`);
    assert.ok(photometry.observations[observation].withheldPixels > 0, `${observation} withholds unstable angles`);
    assert.equal(photometry.observations[observation].correctedPixels, required(metadata.surfaces[1].observationCoverage)[observation].pixels);
  }
});

test("disk normalization preserves its reference and withholds oblique or unlit observations", () => {
  const normal = [1, 0, 0], radius = COLOR_PHOTOMETRY.radiusKm;
  const position = (degrees: number) => [radius + 10000 * Math.cos(degrees * Math.PI / 180), 10000 * Math.sin(degrees * Math.PI / 180), 0];
  for (const weight of [0, 0.5, 1]) {
    assert.ok(Math.abs(required(colorPhotometricGain(normal, { sun:position(30), observer:position(0) }, weight)) - 1) < 1e-12);
    for (const angle of [76, 90, 120, 180]) {
      assert.equal(colorPhotometricGain(normal, { sun:position(angle), observer:position(0) }, weight), null);
      assert.equal(colorPhotometricGain(normal, { sun:position(30), observer:position(angle) }, weight), null);
    }
  }
  const geometry = { sun:position(60), observer:position(0) };
  const lambert = required(colorPhotometricGain(normal, geometry, 0)), mixed = required(colorPhotometricGain(normal, geometry, .5));
  const lommel = required(colorPhotometricGain(normal, geometry, 1));
  assert.ok(Math.abs(lambert - Math.sqrt(3)) < 1e-12);
  assert.ok(lommel > 1 && lommel < mixed && mixed < lambert);
  assert.ok(.001 * mixed > 0, "Observed dark terrain is scaled, never classified as absent");
  assert.throws(() => Reflect.apply(colorPhotometricGain,undefined,[normal,geometry]), /weight/);
});

test("capture vectors match the source geometry in the controlled east-positive frame", async () => {
  const geometry = await loadColorGeometry();
  assert.deepEqual(new Set(geometry.keys()), new Set(europaSourceInputsFor("color").map(image => image.id)),
    "Every color image has source-bound capture geometry");
  const [, first] = required([...geometry].find(([id]) => id.includes("s0440984926")));
  const coordinates = (v: readonly number[]) => ({ latitude:Math.asin(v[2] / Math.hypot(...v)) * 180 / Math.PI,
    longitude:(Math.atan2(v[1], v[0]) * 180 / Math.PI + 360) % 360, distance:Math.hypot(...v) });
  const sun = coordinates(first.sun), observer = coordinates(first.observer);
  // Original Galileo PDS label: Sun 1.399 N / 243.734 W, spacecraft
  // 0.047 N / 166.336 W. W0 changes from 35.67 to the controlled 36.054.
  // Small remaining differences come from the reconstructed ephemerides.
  assert.ok(Math.abs(sun.latitude - 1.399) < .001);
  assert.ok(Math.abs(observer.latitude - .047) < .001);
  assert.ok(Math.abs(sun.longitude - (360 - 243.734 - .384)) < .005);
  assert.ok(Math.abs(observer.longitude - (360 - 166.336 - .384)) < .005);
  assert.ok(Math.abs(observer.distance - 143510.7) < 10);
});

test("color sampling withholds incomplete footprints without erasing observed dark terrain", async () => {
  const { sampleColorBand } = await import("../../../../tools/objects/terrestrial-layers/scientific-raster.mts");
  const band = { noData:0,specialValueMagnitude:1e30,width:2,height:2,origin:[0,2],resolution:[1,-1],data:new Float32Array([.001,.001,.001,.001]) };
  assert.ok(required(sampleColorBand(band,1,1)) > 0);
  band.data[3] = 0;
  assert.equal(sampleColorBand(band,1,1), null, "A missing contributor cannot be interpolated into color");
  band.data[3] = -3.4028234663852886e38;
  assert.equal(sampleColorBand(band,1,1), null, "ISIS special pixels cannot become terrain");
  assert.equal(sampleColorBand(band,0,0), null, "The image footprint cannot be extrapolated");
});

test("level matching preserves color ratios, dark detail and gaps without clipping", () => {
  const width = 24, height = 24;
  const makeColor = () => {
    const rgb = new Float32Array(width * height * 3), owners = new Uint8Array(width * height);
    for (let y = 6; y < 18; y++) for (let x = 6; x < 18; x++) {
      const i = y * width + x;
      rgb.set([40, 60, 80], i * 3);
      owners[i] = 1;
    }
    rgb.set([4, 6, 8], (12 * width + 12) * 3);
    return { rgb, owners, observationNames:["observed-patch"] };
  };
  const monochrome = { rgb:Buffer.alloc(width * height * 3, 114), missing:new Uint8Array(width * height) };
  const color = makeColor();
  const [level] = matchEuropaColorLevels(color, monochrome, {width,height});
  assert.ok(Math.abs(level.gain - 2) < .01);
  assert.deepEqual([...color.rgb.subarray((12 * width + 12) * 3, (12 * width + 12) * 3 + 3)], [8,12,16]);
  assert.deepEqual([...color.rgb.subarray(0,3)], [0,0,0], "Missing color is never populated by level matching");
  monochrome.rgb.fill(250);
  const bright = makeColor();
  const [capped] = matchEuropaColorLevels(bright, monochrome, {width,height});
  assert.equal(capped.gain, 255 / 80, "One gain is capped by the brightest observed channel");
  assert.deepEqual([...bright.rgb.subarray((6 * width + 6) * 3, (6 * width + 6) * 3 + 3)], [128,191,255]);
  monochrome.missing.fill(1);
  const high = makeColor();
  high.rgb.set([200,300,400], (12 * width + 12) * 3);
  const [compressed] = matchEuropaColorLevels(high, monochrome, {width,height});
  assert.equal(compressed.gain, 255 / 400);
  for (const [c, expected] of [127.5,191.25,255].entries()) {
    assert.ok(Math.abs(high.rgb[(12 * width + 12) * 3 + c] - expected) <= .5,
      "Highlights above display white preserve channel ratios within 8-bit rounding");
  }
  const unsupported = makeColor(), before = unsupported.rgb.slice();
  const [unmatched] = matchEuropaColorLevels(unsupported, monochrome, {width,height});
  assert.equal(unmatched.boundarySamples, 0);
  assert.deepEqual(unsupported.rgb, before, "Absent monochrome cannot determine an adjustment");
});
