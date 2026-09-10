// Bind observed input history and frame clocks without replaying camera poses.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

type InputKind = "down" | "drag" | "up" | "wheel" | "move";
interface InputEvent { readonly id: string; readonly event?: string; readonly kind: InputKind; readonly x: number; readonly y: number; readonly qtButtons?: number; readonly acceptedMonotonicSeconds?: number; readonly atMilliseconds?: number; }
interface HistoryRecord { readonly t: number; readonly clock: number; readonly history: readonly (readonly [number, number, number])[]; readonly average: readonly [number, number]; readonly point: readonly [number, number]; readonly window: number; }
interface Receipt { readonly event: string; readonly id?: string; readonly acceptedMonotonicSeconds?: number; }
interface Report { readonly scenario?: string; readonly inputHistoryPath?: string; readonly frameTimingPath?: string; readonly inputs: readonly Receipt[]; readonly gesture: readonly InputEvent[]; readonly frames: readonly { readonly monotonicSeconds: number }[]; readonly captureConfiguration?: { readonly captureUntilRest?: boolean }; readonly viewport: { readonly width: number; readonly height: number; readonly sceneLeft: number; readonly contentWidth: number }; readonly nativeMotionTrace?: string; }

function record(value: unknown, label: string): Record<string, unknown> { if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); const result: Record<string, unknown> = {}; for (const [key, entry] of Object.entries(value)) result[key] = entry; return result; }
function number(value: unknown, label: string): number { if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`); return value; }
function text(value: unknown, label: string): string { if (typeof value !== "string") throw new TypeError(`${label} must be a string.`); return value; }
function array(value: unknown, label: string): readonly unknown[] { if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`); return value; }
function tuple2(value: unknown, label: string): readonly [number, number] { const values = array(value, label); if (values.length !== 2) throw new TypeError(`${label} must have two values.`); return [number(values[0], `${label}[0]`), number(values[1], `${label}[1]`)]; }
function tuple3(value: unknown, label: string): readonly [number, number, number] { const values = array(value, label); if (values.length !== 3) throw new TypeError(`${label} must have three values.`); return [number(values[0], `${label}[0]`), number(values[1], `${label}[1]`), number(values[2], `${label}[2]`)]; }
function input(value: unknown, label: string): InputEvent { const source = record(value, label); const kind = text(source.kind, `${label}.kind`); if (kind !== "down" && kind !== "drag" && kind !== "up" && kind !== "wheel" && kind !== "move") throw new TypeError(`${label}.kind is invalid.`); return { ...source, id: text(source.id, `${label}.id`), kind, x: number(source.x, `${label}.x`), y: number(source.y, `${label}.y`), event: source.event === undefined ? undefined : text(source.event, `${label}.event`), qtButtons: source.qtButtons === undefined ? undefined : number(source.qtButtons, `${label}.qtButtons`), acceptedMonotonicSeconds: source.acceptedMonotonicSeconds === undefined ? undefined : number(source.acceptedMonotonicSeconds, `${label}.acceptedMonotonicSeconds`) }; }
function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean.`);
  return value;
}
function receipt(value: unknown, label: string): Receipt {
  const row = record(value, label);
  return { ...row, event: text(row.event, `${label}.event`),
    id: row.id === undefined ? undefined : text(row.id, `${label}.id`),
    acceptedMonotonicSeconds: row.acceptedMonotonicSeconds === undefined ? undefined : number(row.acceptedMonotonicSeconds, `${label}.acceptedMonotonicSeconds`) };
}
function parseReport(value: unknown): Report { const source = record(value, "native report"); const viewport = record(source.viewport, "native report.viewport"); const capture = source.captureConfiguration === undefined ? undefined : record(source.captureConfiguration, "native report.captureConfiguration"); return { ...source, scenario: source.scenario === undefined ? undefined : text(source.scenario, "native report.scenario"), inputHistoryPath: source.inputHistoryPath === undefined ? undefined : text(source.inputHistoryPath, "native report.inputHistoryPath"), frameTimingPath: source.frameTimingPath === undefined ? undefined : text(source.frameTimingPath, "native report.frameTimingPath"), inputs: array(source.inputs, "native report.inputs").map((entry, index) => receipt(entry, `native report.inputs[${index}]`)), gesture: array(source.gesture, "native report.gesture").map((entry, index) => input(entry, `native report.gesture[${index}]`)), frames: array(source.frames, "native report.frames").map((entry, index) => ({ ...record(entry, `native report.frames[${index}]`), monotonicSeconds: number(record(entry, `native report.frames[${index}]`).monotonicSeconds, `native report.frames[${index}].monotonicSeconds`) })), captureConfiguration: capture === undefined ? undefined : { ...capture, captureUntilRest: capture.captureUntilRest === undefined ? undefined : boolean(capture.captureUntilRest, "native report.captureUntilRest") }, viewport: { ...viewport, width: number(viewport.width, "native report.viewport.width"), height: number(viewport.height, "native report.viewport.height"), sceneLeft: number(viewport.sceneLeft, "native report.viewport.sceneLeft"), contentWidth: number(viewport.contentWidth, "native report.viewport.contentWidth") }, nativeMotionTrace: source.nativeMotionTrace === undefined ? undefined : text(source.nativeMotionTrace, "native report.nativeMotionTrace") }; }
function parseHistory(value: unknown, label: string): HistoryRecord { const source = record(value, label); return { t: number(source.t, `${label}.t`), clock: number(source.clock, `${label}.clock`), history: array(source.history, `${label}.history`).map((entry, index) => tuple3(entry, `${label}.history[${index}]`)), average: tuple2(source.average, `${label}.average`), point: tuple2(source.point, `${label}.point`), window: number(source.window, `${label}.window`) }; }
function parseTimingLine(line: string, index: number): readonly [number, number, number] { const fields = line.split("\t"); if (fields.length !== 3) throw new TypeError(`frame timing row ${index + 1} must have three tab-separated fields.`); return [number(Number(fields[0]), `frame timing row ${index + 1} present`), number(Number(fields[1]), `frame timing row ${index + 1} period`), number(Number(fields[2]), `frame timing row ${index + 1} clock`)]; }

const dir = resolve(process.argv[2]);
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(dir, "paired-input-report.json");
const n = parseReport(JSON.parse(await readFile(resolve(dir, "report.json"), "utf8")));
const historyPath = n.inputHistoryPath ?? resolve(dir, "input-history.jsonl");
const timingPath = n.frameTimingPath ?? resolve(dir, "frame-timing.tsv");
const records = (await readFile(historyPath, "utf8")).trim().split("\n").filter(Boolean).map((line, index) => parseHistory(JSON.parse(line), `input history row ${index + 1}`));
const batchReceipt = n.inputs.find(e => e.event === "native-input-batch-accepted");
if (!batchReceipt || batchReceipt.acceptedMonotonicSeconds === undefined) throw new Error("Native input batch receipt is unavailable.");
const batch = batchReceipt.acceptedMonotonicSeconds;
const lastRecord = records.at(-1), lastFrame = n.frames.at(-1);
if (!lastRecord || !lastFrame) throw new Error("Native report has no timing samples.");
const end = n.captureConfiguration?.captureUntilRest === false
  ? lastRecord.t : lastFrame.monotonicSeconds;
const offsets = records.filter(r => r.clock > 0).map(r => r.t-r.clock).sort((a,b) => a-b);
const offset = offsets[offsets.length >> 1];
if (offset === undefined) throw new Error("Native input history has no clock offset.");
const local = records.filter(r => r.t >= batch && r.t <= end);
const accepted = n.gesture.map(event => {
  const receipt = n.inputs.find(e => e.event === "native-input-accepted" && e.id === event.id);
  assert.ok(receipt, `Missing input receipt: ${event.id}`);
  if (receipt.acceptedMonotonicSeconds === undefined) throw new Error(`Input receipt ${event.id} has no monotonic timestamp.`);
  return {...event, atMilliseconds:(receipt.acceptedMonotonicSeconds-batch)*1000};
});
let consumedGesture = accepted;
let qualification = "native handler receipts; camera-consumption timing remains unqualified";
let launch: HistoryRecord | null = null, windowCount: number | null = null;
const gestures: Array<{ readonly events: Array<InputEvent & { readonly atMilliseconds: number }>; readonly launch: HistoryRecord | null; readonly windowCount: number | null; readonly qualification: string }> = [];
const pointerAccepted = accepted.filter(e => ["down", "drag", "up"].includes(e.kind));
if (pointerAccepted.some(e => e.kind === "drag")) {
  const groups: Array<Array<InputEvent & { readonly atMilliseconds: number }>> = [];
  for (const event of pointerAccepted) {
    if (event.kind === "down") {
      const priorGroup = groups.at(-1), priorEvent = priorGroup?.at(-1);
      assert.ok(!priorEvent || priorEvent.kind === "up", "Nested pointer press.");
      groups.push([]);
    }
    assert.ok(groups.length, "Drag must begin with a press.");
    const group = groups.at(-1);
    if (!group) throw new Error("Drag must begin with a press.");
    group.push(event);
  }
  for (const [index, group] of groups.entries()) {
  const firstGroupEvent = group[0], lastGroupEvent = group.at(-1);
  if (!firstGroupEvent || !lastGroupEvent) throw new Error("Pointer gesture is empty.");
  assert.equal(lastGroupEvent.kind, "up", "Drag must include its release.");
  if (!group.some((event) => event.kind === "drag")) {
    gestures.push({
      events: group,
      launch: null,
      windowCount: null,
      qualification: "native handler receipts for click sequence",
    });
    continue;
  }
  const nextPressMilliseconds = groups[index + 1]?.[0].atMilliseconds ?? Infinity;
  const related = local.filter(r => r.history[0] !== undefined && r.history[0][2] + offset >=
    batch + firstGroupEvent.atMilliseconds / 1000 - .02 &&
    r.history[0][2] + offset < batch + nextPressMilliseconds / 1000 - .02);
  const thrown = related.find(r => r.average.some(v => v !== 0));
  // A non-launching release can still consume its final pointer position.
  // That delta participates in the release decision; dropping it can turn a
  // stopped reference into a browser throw. Use the observed complete history,
  // then verify every reconstructed position against delivered input below.
  const sampleCount = thrown?.history.length ?? Math.max(0, ...related.map(r => r.history.length));
  assert.ok(sampleCount <= 16, "Pointer history ring wrapped; full consumption cannot be reconstructed.");
  const complete = related.filter(r => r.history.length === sampleCount);
  if (!complete.length && accepted.some(e => e.kind === "wheel" && e.qtButtons === 1 &&
      e.atMilliseconds > firstGroupEvent.atMilliseconds && e.atMilliseconds < lastGroupEvent.atMilliseconds)) {
    gestures.push({ events: group, launch: null, windowCount: null,
      qualification: "held-button Qt wheel cancels the grab; later pointer inputs have handler receipts without a movement history" });
    continue;
  }
  assert.ok(complete.length, "No complete native pointer history for this drag.");
  launch = thrown ?? complete[0];
  windowCount = null;
  const currentLaunch = launch;
  if (!currentLaunch) throw new Error("Native launch history is unavailable.");
  const h = currentLaunch.history, last = h.length-1;
  let releaseMilliseconds = lastGroupEvent.atMilliseconds;
  if (currentLaunch.average.some(v => v !== 0)) {
    let dx=0, dy=0;
    const candidates: Array<{ readonly count: number; readonly release: number }> = [];
    for (let count=1; count<=last; count++) {
      dx+=h[last-count+1][0];dy+=h[last-count+1][1];
      if (count<2) continue;
      const seconds=Math.abs(currentLaunch.average[0])>1e-8?dx/currentLaunch.average[0]:dy/currentLaunch.average[1];
      const release=h[last-count][2]+seconds;
      if (Math.abs(dy/seconds-launch.average[1])>1e-6) continue;
      if (seconds <= currentLaunch.window) {
        // A gesture younger than the averaging window uses its complete
        // history; its inferred release lands on the final consumed sample.
        if (count !== last) continue;
      } else if (count>2 && release-h[last-count+1][2]>currentLaunch.window) continue;
      candidates.push({count,release});
    }
    assert.ok(candidates.length, "No release boundary matches the recorded average.");
    const receiptClock = batch + lastGroupEvent.atMilliseconds / 1000 - offset;
    candidates.sort((a, b) =>
      Math.abs(a.release - receiptClock) - Math.abs(b.release - receiptClock));
    if (candidates.length > 1) assert.ok(Math.abs(
      Math.abs(candidates[0].release - receiptClock) -
      Math.abs(candidates[1].release - receiptClock),
    ) > 1e-9,
      "Release boundary is still ambiguous after its handler receipt.",
    );
    const selectedCandidate = candidates[0];
    if (!selectedCandidate) throw new Error("Release boundary candidate is unavailable.");
    windowCount=selectedCandidate.count;
    releaseMilliseconds=(selectedCandidate.release+offset-batch)*1000;
    qualification="native consumed pointer history and release average" +
      (candidates.length > 1 ? "; release boundary resolved by handler receipt" : "");
  } else {
    releaseMilliseconds=Math.max(releaseMilliseconds,
      ((h.at(-1)?.[2] ?? 0) + offset-batch)*1000);
    qualification="native consumed drag history; release handler receipt, no native throw";
  }
  let x=currentLaunch.point[0]-h.reduce((s,v)=>s+v[0],0);
  let y=currentLaunch.point[1]-h.reduce((s,v)=>s+v[1],0);
  let priorDeliveredIndex = -1;
  const events: Array<InputEvent & { readonly atMilliseconds: number }> = h.map((sample,i)=>{
    x+=sample[0];y+=sample[1];
    const viewportX = ((x+1)*n.viewport.width/2+n.viewport.sceneLeft)/n.viewport.contentWidth;
    const viewportY = (1-y)/2;
    const candidates = group.map((event,index) => ({event,index,distance:Math.hypot(
      (event.x-viewportX)*n.viewport.contentWidth,(event.y-viewportY)*n.viewport.height)}))
      .filter(c => c.index > priorDeliveredIndex && (i === 0 ? c.event.kind === "down" : c.event.kind !== "down"))
      .sort((a,b) => a.distance-b.distance || a.index-b.index);
    const matched = candidates[0];
    assert.ok(matched && matched.distance <= Math.SQRT1_2 + 1e-5,
      "Consumed pointer position does not match a delivered input within Qt integer rounding");
    priorDeliveredIndex = matched.index;
    const reconstructedKind: InputKind = i === 0 ? "down" : "drag";
    return {...matched.event,kind:reconstructedKind,
      ...(matched.event.kind === "up" ? {id:`${matched.event.id}:position`} : {}),
      x:viewportX,y:viewportY,atMilliseconds:(sample[2]+offset-batch)*1000};
  });
  const lastReconstructedEvent = events.at(-1);
  if (!lastReconstructedEvent) throw new Error("Consumed pointer history is empty.");
  events.push({...lastGroupEvent,x:lastReconstructedEvent.x,y:lastReconstructedEvent.y,
    atMilliseconds:releaseMilliseconds});
  gestures.push({events,launch: currentLaunch,windowCount,qualification});
  }
  consumedGesture = [
    ...gestures.flatMap(g => g.events),
    ...accepted.filter(e => e.kind === "wheel"),
  ].sort((a,b) => a.atMilliseconds-b.atMilliseconds);
  const launchedGesture = gestures.find((gesture) => gesture.launch !== null);
  if (launchedGesture) ({ launch, windowCount } = launchedGesture);
  qualification = [...new Set(gestures.map(g => g.qualification))].join("; ") +
    (accepted.some(e => e.kind === "wheel") ?
      "; synchronous wheel-handler receipts" : "");
} else if (pointerAccepted.length) {
  qualification = "native handler receipts for click sequence; " +
    "present-side consumption remains uninstrumented";
}
const timing=(await readFile(timingPath,"utf8")).trim().split("\n").filter(Boolean).map(parseTimingLine);
const nativeFrameClock: Array<{ readonly atMilliseconds: number; readonly periodMilliseconds: number; readonly clockSeconds: number; readonly presentSeconds: number }> = [];
for (const [present,period,clock] of timing) {
  if (!(clock>0) || clock===nativeFrameClock.at(-1)?.clockSeconds) continue;
  const atMilliseconds=(clock+offset-batch)*1000;
  if (atMilliseconds>=0 && atMilliseconds<=(end-batch)*1000) {
    nativeFrameClock.push({atMilliseconds,periodMilliseconds:period*1000,clockSeconds:clock,presentSeconds:present});
  }
}
assert.ok(nativeFrameClock.length, "No recorded frame clock.");
for (const gesture of gestures) {
  if (gesture.windowCount === null) continue;
  const lastGestureEvent = gesture.events.at(-1);
  if (!lastGestureEvent) throw new Error("Gesture has no events.");
  const before=nativeFrameClock.findLast(f=>f.atMilliseconds<=lastGestureEvent.atMilliseconds);
  assert.ok(before, "No frame clock precedes the gesture release.");
  if (!gesture.launch) throw new Error("Gesture release window is unavailable.");
  assert.ok(Math.abs(before.periodMilliseconds-gesture.launch.window/5*1000)<.001,"Release window and frame clock disagree.");
}
const result={...n,sourceReport:resolve(dir,"report.json"),nativeMotionTrace:n.nativeMotionTrace??resolve(dir,"motion.bin"),consumedGesture,nativeFrameClock,
  consumedInputEvidence:{historyPath,timingPath,clockOffsetSeconds:offset,
    clockOffsetSpreadMs:((offsets.at(-1) ?? offset)-(offsets[0] ?? offset))*1000,launch,windowCount,qualification,gestures}};
await mkdir(dirname(outputPath), { recursive:true });
await writeFile(outputPath,JSON.stringify(result,null,2));
console.log(JSON.stringify({scenario:n.scenario,qualification,windowCount,frames:n.frames.length}));
