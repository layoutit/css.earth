// Compare actual renderer frames on their input clocks. No optical-flow warp.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import pixelmatch from "pixelmatch";
import { array, object, text, finite, parseJson } from "./oracle-values.mts";
import { parseRenderedNativeReport, parseRenderedBrowserReport, loadHeldInitialFrame } from "./rendered-motion-records.mts";
import { cameraMatrix } from "./interaction-analysis-records.mts";
import type { NativeMotionFrame } from "./native-motion-trace-reader.mts";
import type { Matrix3 } from "../../../../site/test/interaction-orientation.mts";
import { decodeNativeMotionTrace } from "./native-motion-trace-reader.mts";
import { relativeOrientation3, multiply3, orientationErrorDegrees } from "../../../../site/test/interaction-orientation.mts";

const exec = promisify(execFile);
const [nativeArgument, browserArgument, outputArgument, visualization = "absolute", thresholdArgument = "0.1"] = process.argv.slice(2);
assert.ok(nativeArgument && browserArgument && outputArgument);
assert.ok(["absolute", "pixelmatch"].includes(visualization));
const threshold = Number(thresholdArgument);
assert.ok(Number.isFinite(threshold) && threshold >= 0 && threshold <= 1,
  "Pixelmatch threshold must be between zero and one.");
const pixelmatchOptions: NonNullable<Parameters<typeof pixelmatch>[5]> = { threshold, includeAA:true, alpha:0.1, diffColor:[255,0,0] };
const n = parseRenderedNativeReport(parseJson(await readFile(resolve(nativeArgument), "utf8")));
const b = parseRenderedBrowserReport(parseJson(await readFile(resolve(browserArgument), "utf8")));
assert.notEqual(b.timingMode, "motion-only",
  "Motion-only traces contain boundary images, not a rendered video sequence");
assert.notEqual(n.captureConfiguration?.captureUntilRest, false,
  "Reference boundary images are not a rendered video sequence");
assert.equal(n.calibrationSha256, b.calibrationSha256);
assert.ok(n.bindings.every(entry => entry.mapped));
const out = resolve(outputArgument), size = n.crop.width;
assert.equal(n.crop.height, size);
const headerScale = size / 700, headerHeight = 2 * Math.ceil(86 * headerScale / 2);
const footerHeight = 2 * Math.ceil(40 * headerScale / 2);
for (const dir of ["native", "browser", "absolute", "pixelmatch", "triptych"]) await mkdir(resolve(out, dir), { recursive:true });
const startEvent = n.inputs.find(e => e.event === "native-input-batch-accepted" && e.revision === (n.revision ?? 100));
assert.ok(startEvent, "Native input batch receipt is missing.");
const start = finite(startEvent.acceptedMonotonicSeconds);
assert.ok(n.frames.length > 0, "Native rendered frames are missing.");
const nativeFrames = [...n.frames].sort((a,b) => a.monotonicSeconds - b.monotonicSeconds);
const frameLocked = b.frameBinding === "native-present-step-and-verified-pixel-marker";
const browserFrames = [...b.frames].sort((a,b) => a.timestamp - b.timestamp);
if (!frameLocked && browserFrames[0]?.timestamp * 1000 > b.epoch) {
  browserFrames.unshift(await loadHeldInitialFrame(browserArgument, b.epoch));
}
const browserByNative = new Map(browserFrames.map(f => [f.nativeIndex, f]));
let nativePoses = new Map<number, NativeMotionFrame>(), initialNative: readonly number[] = [];
const parseMatrix = cameraMatrix;
const flip: Matrix3 = [[1,0,0],[0,-1,0],[0,0,1]];
if (frameLocked) {
  assert.equal(browserByNative.size,nativeFrames.length,"Every native frame needs one distinct browser frame");
  nativePoses=new Map(decodeNativeMotionTrace(await readFile(text(n.nativeMotionTrace))).frames.map(f=>[f.frameSequence,f]));
  const initialPose=nativePoses.get(nativeFrames[0].presentIndex);
  assert.ok(initialPose, "Initial native camera pose is missing.");
  initialNative=initialPose.modelViewMatrix;
}
const differenceTitle = visualization === "pixelmatch" ? `PIXELMATCH · threshold ${threshold}` : "ABSOLUTE RGB DIFFERENCE · 4×";
const legend = visualization === "pixelmatch"
  ? `Actual rendered frames · red: differences above ${threshold} · antialiasing included · diagnostic, not a parity pass`
  : `Actual rendered frames · ${frameLocked ? "input-step paired, not realtime timing · " : b.frameClock?.startsWith("recorded") ? "recorded input + frame clock · " : b.controlledCadenceHz ? `${b.controlledCadenceHz} Hz controlled browser cadence · ` : "aligned input clock · "}diagnostic, not a parity pass`;
const header = Buffer.from(`<svg width="${size*3}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#17191e"/>
  <g fill="white" font-family="Arial" font-size="${24*headerScale}"><text x="${20*headerScale}" y="${33*headerScale}">NATIVE · injected test texture</text><text x="${size+20*headerScale}" y="${33*headerScale}">BROWSER · same prepared source</text><text x="${size*2+20*headerScale}" y="${33*headerScale}">${differenceTitle}</text></g>
  <text x="${20*headerScale}" y="${67*headerScale}" fill="#f9cd77" font-family="Arial" font-size="${20*headerScale}">${legend}</text></svg>`);
interface ComparisonRow { index: number; nativeIndex: number; browserIndex: number; timeMilliseconds: number;
  browserFrameSkewMilliseconds: number | null; nativeFinalHeld: boolean; nativeFrameAgeMilliseconds: number;
  absoluteBrowserFrameSkewMilliseconds: number | null; cameraRotationErrorDegrees: number | null;
  projectedCenter: { native: number[]; browser: number[]; errorPixels: number } | null;
  phase: string | null; nativeSha256: string; browserRawSha256: string; nativePngSha256: string;
  browserCropSha256: string; meanAbsoluteRgb: number; pixelmatchChanged: number; pixelmatchRatio: number; }
const cachedBrowser = new Map<string, Buffer>(), rows: ComparisonRow[] = [];
const nativeTimes = nativeFrames.map(frame => (frame.monotonicSeconds-start)*1000);
const timeline = frameLocked ? nativeTimes : [...new Set([
  ...nativeTimes,
  ...browserFrames.map(frame => frame.timestamp*1000-b.epoch)
    .filter(time => time >= nativeTimes[0]),
])].sort((a,b)=>a-b);
for (let index = 0; index < timeline.length; index++) {
  const time = timeline[index];
  const nf = frameLocked ? nativeFrames[index] : nativeFrames.findLast(frame =>
    (frame.monotonicSeconds-start)*1000 <= time);
  // Hold the latest observed image on each source clock. Never show a future
  // frame or truncate a slower browser when the native recording has stopped.
  assert.ok(nf, "No native frame had been presented at this sample time.");
  const bf = frameLocked ? browserByNative.get(nf.index) : browserFrames.findLast(frame =>
    frame.timestamp*1000-b.epoch <= time);
  assert.ok(bf, "No browser frame had been presented at this native sample time.");
  let cameraRotationErrorDegrees = null, projectedCenter = null;
  if (frameLocked) {
    assert.equal(bf.nativePresentIndex,nf.presentIndex);
    assert.ok(bf.marker !== undefined && bf.marker>0 && bf.pose,"Captured pixels must identify their frozen camera state");
    const nativePose=nativePoses.get(nf.presentIndex);
    assert.ok(nativePose, "Native frame camera pose is missing.");
    const model=nativePose.modelViewMatrix;
    const browserMatrix=parseMatrix(bf.pose.scene);
    assert.deepEqual(browserMatrix.slice(12,15),[0,0,0],
      "Projected-center measurement requires the captured rotation-only body transform");
    const actual=multiply3(multiply3(flip,relativeOrientation3(browserMatrix,parseMatrix(b.state.pose.scene))),flip);
    cameraRotationErrorDegrees=orientationErrorDegrees(relativeOrientation3(model,initialNative),actual);
    // Measure translation separately: a rotation-only score misses a shifted globe.
    const p=nativePose.projectionMatrix, origin=model.slice(12,16);
    const clip=Array.from({length:4},(_,row)=>origin.reduce((sum,v,col)=>sum+p[col*4+row]*v,0));
    assert.ok(clip[3]>0);
    const dpr=n.viewport.deviceScaleFactor, crop=b.crop??n.crop;
    assert.ok(b.cameraOffset, "Frame-bound capture camera offset is missing.");
    const nativeCenter=[(1+clip[0]/clip[3])*n.viewport.width/2*dpr-n.crop.left,
      (1-clip[1]/clip[3])*n.viewport.height/2*dpr-n.crop.top];
    const browserCenter=[(n.viewport.sceneLeft+n.viewport.width/2+b.cameraOffset.x)*dpr-crop.left,
      (n.viewport.height/2+b.cameraOffset.y)*dpr-crop.top];
    projectedCenter={native:nativeCenter,browser:browserCenter,
      errorPixels:Math.hypot(...nativeCenter.map((v,i)=>v-browserCenter[i]))};
  }
  const nativePixels = await pixels(nf.path);
  if (!cachedBrowser.has(bf.path)) {
    const image = sharp(await readFile(bf.path));
    cachedBrowser.set(bf.path, await (bf.heldInitialFrame
      ? image
      : image.extract(b.crop ?? n.crop)).ensureAlpha().raw().toBuffer());
  }
  const browserPixels = cachedBrowser.get(bf.path);
  assert.equal(nativePixels.length, size*size*4);
  assert.ok(browserPixels);
  assert.equal(browserPixels.length, nativePixels.length);
  const absolute = Buffer.alloc(nativePixels.length);
  let sum = 0;
  for (let p = 0; p < nativePixels.length; p += 4) {
    for (let c=0;c<3;c++) { const d = Math.abs(nativePixels[p+c]-browserPixels[p+c]); sum+=d; absolute[p+c]=Math.min(255,d*4); }
    absolute[p+3]=255;
  }
  const name = `frame_${String(index).padStart(6,"0")}.png`;
  const png = async (data: Buffer) => sharp(data,{ raw:{width:size,height:size,channels:4} }).png().toBuffer();
  const thresholded = Buffer.alloc(nativePixels.length);
  const changed = pixelmatch(nativePixels,browserPixels,thresholded,size,size,pixelmatchOptions);
  const [np,bp,ap,pp] = await Promise.all([png(nativePixels),png(browserPixels),png(absolute),png(thresholded)]);
  await Promise.all([writeFile(resolve(out,"native",name),np),writeFile(resolve(out,"browser",name),bp),writeFile(resolve(out,"absolute",name),ap),writeFile(resolve(out,"pixelmatch",name),pp)]);
  const meanAbsoluteRgb=sum/(size*size*3);
  const nativeFinalHeld = !frameLocked && time > nativeTimes[nativeTimes.length - 1];
  const label=`Frame ${index}/${timeline.length-1} · ${((time-nativeTimes[0])/1000).toFixed(3)} s`+
    (nativeFinalHeld ? " · native final frame held" : "")+
    (frameLocked?` · rotation ${finite(cameraRotationErrorDegrees).toFixed(3)}° · center ${finite(projectedCenter?.errorPixels).toFixed(2)} px`:"")+
    ` · mean absolute RGB ${meanAbsoluteRgb.toFixed(3)}/255`;
  const footer=Buffer.from(`<svg width="${size*3}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#17191e"/><text x="${20*headerScale}" y="${27*headerScale}" fill="white" font-family="Arial" font-size="${22*headerScale}">${label}</text></svg>`);
  await sharp({create:{width:size*3,height:size+headerHeight+footerHeight,channels:3,background:"black"}})
    .composite([{input:header,top:0,left:0},{input:np,top:headerHeight,left:0},{input:bp,top:headerHeight,left:size},{input:visualization === "pixelmatch" ? pp : ap,top:headerHeight,left:size*2},{input:footer,top:headerHeight+size,left:0}])
    .png().toFile(resolve(out,"triptych",name));
  const browserFrameSkewMilliseconds = frameLocked ? null : bf.timestamp*1000-b.epoch-time;
  rows.push({index,nativeIndex:nf.index,browserIndex:bf.index,timeMilliseconds:time,
    browserFrameSkewMilliseconds,nativeFinalHeld,
    nativeFrameAgeMilliseconds:time-(nf.monotonicSeconds-start)*1000,
    absoluteBrowserFrameSkewMilliseconds:browserFrameSkewMilliseconds === null
      ? null : Math.abs(browserFrameSkewMilliseconds),
    cameraRotationErrorDegrees,projectedCenter,phase:bf.interaction?.activeMode??null,
    nativeSha256:hash(await readFile(nf.path)),browserRawSha256:bf.sha256,
    nativePngSha256:hash(np),browserCropSha256:hash(bp),
    meanAbsoluteRgb,pixelmatchChanged:changed,pixelmatchRatio:changed/(size*size)});
}
const durations = rows.map((row,i) => i+1 < rows.length ?
  (rows[i+1].timeMilliseconds-row.timeMilliseconds)/1000 : 1/60);
const concat = rows.map((_,i) => `file '${resolve(out,"triptych",`frame_${String(i).padStart(6,"0")}.png`)}'\noption framerate 1000000\nduration ${durations[i].toFixed(9)}`).join("\n");
await writeFile(resolve(out,"frames.ffconcat"),`ffconcat version 1.0\n${concat}\n`);
await exec("ffmpeg",["-y","-v","error","-f","concat","-safe","0","-i",resolve(out,"frames.ffconcat"),
  "-fps_mode","vfr","-enc_time_base","1:1000000","-c:v","libx264","-bf","0","-crf","18","-pix_fmt","yuv420p","-video_track_timescale","1000000","-movflags","+faststart",resolve(out,"rendered-comparison.mp4")],{timeout:60000});
const encoded=object(parseJson((await exec("ffprobe",["-v","error","-show_frames",
  "-show_entries","frame=best_effort_timestamp_time","-of","json",resolve(out,"rendered-comparison.mp4")],{maxBuffer:4*1024*1024})).stdout)).frames;
const encodedFrames=array(encoded).map(value => { const frame=object(value); return { best_effort_timestamp_time:text(frame.best_effort_timestamp_time) }; });
assert.equal(encodedFrames.length,rows.length,"Video export lost or duplicated a source frame");
const maximumVideoTimestampErrorMilliseconds=Math.max(...encodedFrames.map((frame,i)=>
  Math.abs(Number(frame.best_effort_timestamp_time)*1000-(rows[i].timeMilliseconds-rows[0].timeMilliseconds))));
assert.ok(maximumVideoTimestampErrorMilliseconds<=1,"Video timing exceeded its one-millisecond encoding clock");
const nativeLatency = n.inputs.filter(e=>e.event==="native-input-posted").map(e=>(finite(e.postedMonotonicSeconds)-finite(e.sourceMonotonicSeconds))*1000);
const report = { qualification:"DIAGNOSTIC_RENDERER_PIXELMATCH_NOT_TIMING_PARITY",
  reasons:["Native capture readback and input lateness are measured; physical presentation timing is unproven.",
    "Visible body size and input rays are registered. The prepared rendering lens and retained surface still contribute static pixel differences.",
    "Retained-surface tessellation and atlas seams remain visible in the static baseline."],
  sourceSha256:n.calibrationSha256, nativeReport:resolve(nativeArgument),browserReport:resolve(browserArgument),
  inputTiming:b.inputTiming ?? "requested input timestamps", controlledCadenceHz:b.controlledCadenceHz ?? null,
  frameClock:b.frameClock ?? "browser animation clock",
  startingLens:{
    nativeFocalLength:(b.projectionBinding?.nativeProjection?.[5] ?? NaN) * n.viewport.height / 2,
    browserFocalLength:b.state.trackball?.focalLength,
    scope:"effective focal lengths in CSS pixels; camera orientation error is not isolated response error when these differ",
  },
  frameCounts:{native:n.frames.length,browser:b.frames.length,compared:rows.length,nativeDropped:n.dropped.length},
  pairing:frameLocked?"same native present step; original input history and frame periods; verified pixel marker; no image search or pose replay":"union of both capture clocks; hold latest observed frame, including native final frame through browser rest; no future frames, image search or pose replay; presentation synchronization remains diagnostic",
  stopObservation:{native:n.stopObservation??null,browser:b.stopObservation??null},
  maximumAbsoluteBrowserFrameSkewMilliseconds:frameLocked?null:Math.max(...rows.map(r=>finite(r.absoluteBrowserFrameSkewMilliseconds))),
  cameraFrameCoverage:frameLocked?{compared:rows.length,expected:nativeFrames.length,excluded:0}:null,
  maximumCameraRotationErrorDegrees:frameLocked?Math.max(...rows.map(r=>finite(r.cameraRotationErrorDegrees))):null,
  projectedCenterMeasurement:frameLocked?"model-origin projection in capture pixels; native matrices versus fixed browser camera offset; no frame realignment":null,
  maximumProjectedCenterErrorPixels:frameLocked?Math.max(...rows.map(r=>finite(r.projectedCenter?.errorPixels))):null,
  videoEncoding:{timing:"variable frame rate",inputTimeBase:"1/1000000",interpolatedFrames:0,
    verifiedFrameCount:encodedFrames.length,maximumTimestampErrorMilliseconds:maximumVideoTimestampErrorMilliseconds},
  maximumNativeInputLatenessMilliseconds:Math.max(...nativeLatency),
  initialMeanAbsoluteRgb:rows[0].meanAbsoluteRgb,worstMeanAbsoluteRgb:Math.max(...rows.map(r=>r.meanAbsoluteRgb)),
  visualization,
  pixelmatch:{...pixelmatchOptions,qualification:"raw diagnostic threshold, not an acceptance tolerance"},
  video:resolve(out,"rendered-comparison.mp4"), rows };
await writeFile(resolve(out,"report.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:undefined}));

async function pixels(path: string) {
  const bytes = await readFile(path);
  if (!path.endsWith(".ppm")) return sharp(bytes).ensureAlpha().raw().toBuffer();
  const h = /^P6\n(\d+) (\d+)\n255\n/.exec(bytes.toString("ascii",0,64));
  assert.ok(h);assert.equal(+h[1],size);assert.equal(+h[2],size);
  return sharp(bytes.subarray(h[0].length),{raw:{width:size,height:size,channels:3}}).ensureAlpha().raw().toBuffer();
}
function hash(bytes: Uint8Array){return createHash("sha256").update(bytes).digest("hex");}

