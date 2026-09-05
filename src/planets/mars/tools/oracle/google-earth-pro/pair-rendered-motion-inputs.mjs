// Bind observed input history and frame clocks without replaying camera poses.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";

const dir = resolve(process.argv[2]);
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(dir, "paired-input-report.json");
const n = JSON.parse(await readFile(resolve(dir, "report.json")));
const historyPath = n.inputHistoryPath ?? resolve(dir, "input-history.jsonl");
const timingPath = n.frameTimingPath ?? resolve(dir, "frame-timing.tsv");
const records = (await readFile(historyPath, "utf8")).trim().split("\n").map(JSON.parse);
const batch = n.inputs.find(e => e.event === "native-input-batch-accepted").acceptedMonotonicSeconds;
const end = n.captureConfiguration?.captureUntilRest === false
  ? records.at(-1).t : n.frames.at(-1).monotonicSeconds;
const offsets = records.filter(r => r.clock > 0).map(r => r.t-r.clock).sort((a,b) => a-b);
const offset = offsets[offsets.length >> 1];
const local = records.filter(r => r.t >= batch && r.t <= end);
const accepted = n.gesture.map(event => {
  const receipt = n.inputs.find(e => e.event === "native-input-accepted" && e.id === event.id);
  assert.ok(receipt, `Missing input receipt: ${event.id}`);
  return {...event, atMilliseconds:(receipt.acceptedMonotonicSeconds-batch)*1000};
});
let consumedGesture = accepted;
let qualification = "native handler receipts; camera-consumption timing remains unqualified";
let launch = null, windowCount = null;
const gestures = [];
const pointerAccepted = accepted.filter(e => ["down", "drag", "up"].includes(e.kind));
if (pointerAccepted.some(e => e.kind === "drag")) {
  const groups = [];
  for (const event of pointerAccepted) {
    if (event.kind === "down") {
      assert.ok(!groups.length || groups.at(-1).at(-1).kind === "up", "Nested pointer press.");
      groups.push([]);
    }
    assert.ok(groups.length, "Drag must begin with a press.");
    groups.at(-1).push(event);
  }
  for (const [index, group] of groups.entries()) {
  assert.equal(group.at(-1).kind, "up", "Drag must include its release.");
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
  const related = local.filter(r => r.history[0][2] + offset >=
    batch + group[0].atMilliseconds / 1000 - .02 &&
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
      e.atMilliseconds > group[0].atMilliseconds && e.atMilliseconds < group.at(-1).atMilliseconds)) {
    gestures.push({ events: group, launch: null, windowCount: null,
      qualification: "held-button Qt wheel cancels the grab; later pointer inputs have handler receipts without a movement history" });
    continue;
  }
  assert.ok(complete.length, "No complete native pointer history for this drag.");
  launch = thrown ?? complete[0];
  windowCount = null;
  const h = launch.history, last = h.length-1;
  let releaseMilliseconds = group.at(-1).atMilliseconds;
  if (launch.average.some(v => v !== 0)) {
    let dx=0, dy=0;
    const candidates=[];
    for (let count=1; count<=last; count++) {
      dx+=h[last-count+1][0];dy+=h[last-count+1][1];
      if (count<2) continue;
      const seconds=Math.abs(launch.average[0])>1e-8?dx/launch.average[0]:dy/launch.average[1];
      const release=h[last-count][2]+seconds;
      if (Math.abs(dy/seconds-launch.average[1])>1e-6) continue;
      if (seconds <= launch.window) {
        // A gesture younger than the averaging window uses its complete
        // history; its inferred release lands on the final consumed sample.
        if (count !== last) continue;
      } else if (count>2 && release-h[last-count+1][2]>launch.window) continue;
      candidates.push({count,release});
    }
    assert.ok(candidates.length, "No release boundary matches the recorded average.");
    const receiptClock = batch + group.at(-1).atMilliseconds / 1000 - offset;
    candidates.sort((a, b) =>
      Math.abs(a.release - receiptClock) - Math.abs(b.release - receiptClock));
    if (candidates.length > 1) assert.ok(Math.abs(
      Math.abs(candidates[0].release - receiptClock) -
      Math.abs(candidates[1].release - receiptClock),
    ) > 1e-9,
      "Release boundary is still ambiguous after its handler receipt.",
    );
    windowCount=candidates[0].count;
    releaseMilliseconds=(candidates[0].release+offset-batch)*1000;
    qualification="native consumed pointer history and release average" +
      (candidates.length > 1 ? "; release boundary resolved by handler receipt" : "");
  } else {
    releaseMilliseconds=Math.max(releaseMilliseconds,
      (h.at(-1)[2]+offset-batch)*1000);
    qualification="native consumed drag history; release handler receipt, no native throw";
  }
  let x=launch.point[0]-h.reduce((s,v)=>s+v[0],0);
  let y=launch.point[1]-h.reduce((s,v)=>s+v[1],0);
  let priorDeliveredIndex = -1;
  const events=h.map((sample,i)=>{
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
    return {...matched.event,kind:i===0?"down":"drag",
      ...(matched.event.kind === "up" ? {id:`${matched.event.id}:position`} : {}),
      x:viewportX,y:viewportY,atMilliseconds:(sample[2]+offset-batch)*1000};
  });
  events.push({...group.at(-1),x:events.at(-1).x,y:events.at(-1).y,
    atMilliseconds:releaseMilliseconds});
  gestures.push({events,launch,windowCount,qualification});
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
const timing=(await readFile(timingPath,"utf8")).trim().split("\n").map(l=>l.split("\t").map(Number));
const nativeFrameClock=[];
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
  const before=nativeFrameClock.findLast(f=>f.atMilliseconds<=gesture.events.at(-1).atMilliseconds);
  assert.ok(Math.abs(before.periodMilliseconds-gesture.launch.window/5*1000)<.001,"Release window and frame clock disagree.");
}
const result={...n,sourceReport:resolve(dir,"report.json"),nativeMotionTrace:n.nativeMotionTrace??resolve(dir,"motion.bin"),consumedGesture,nativeFrameClock,
  consumedInputEvidence:{historyPath,timingPath,clockOffsetSeconds:offset,
    clockOffsetSpreadMs:(offsets.at(-1)-offsets[0])*1000,launch,windowCount,qualification,gestures}};
await mkdir(dirname(outputPath), { recursive:true });
await writeFile(outputPath,JSON.stringify(result,null,2));
console.log(JSON.stringify({scenario:n.scenario,qualification,windowCount,frames:n.frames.length}));
