import assert from "node:assert/strict";

// Native history and frame-period records come from the same present call.
// Use its interval, not a nearest timestamp or an image-similarity search.
export function renderedMotionSteps(native, history, timing) {
  if (native.gesture?.some(e => e.kind === "wheel")) return wheelMotionSteps(native, history, timing);
  if (!native.consumedGesture?.some(e => e.kind === "drag") ||
      native.consumedInputEvidence?.gestures?.every(g => g.launch === null)) {
    return receiptMotionSteps(native, timing);
  }
  assert.ok(native.consumedGesture?.length);
  assert.ok(native.consumedGesture.every(e => ["down", "drag", "up"].includes(e.kind)));
  const evidence = native.consumedInputEvidence;
  const gestures = evidence.gestures?.length ? evidence.gestures :
    [{events:native.consumedGesture,launch:evidence.launch}];
  assert.deepEqual(gestures.flatMap(g => g.events), native.consumedGesture);
  const receiptGestures = gestures.filter(g => g.launch === null);
  const dragGestures = gestures.filter(g => g.launch !== null);
  const object = dragGestures[0].launch.object;
  assert.ok(dragGestures.every(g => g.launch.object === object));
  const records = history.filter(h => h.object === object);
  const batch = native.inputs.find(e => e.event === "native-input-batch-accepted").acceptedMonotonicSeconds;
  const pressClocks = dragGestures.map(g =>
    g.events[0].atMilliseconds / 1000 + batch - evidence.clockOffsetSeconds);
  const gestureIndex = h => pressClocks.findIndex(clock =>
    Math.abs((h.history?.[0]?.[2] ?? -Infinity) - clock) < 1e-6);
  const first = records.findLastIndex(h => h.t <= native.frames[0].monotonicSeconds);
  assert.ok(first >= 0);
  assert.ok(gestureIndex(records[first]) < 0 || records[first].length <= 1,
    "Capture must begin before the first drag movement.");
  const periods = new Map(timing.map(([present, period, clock]) => [present, { period, clock }]));
  const steps = [];
  let active = -1, cursor = 0, released = false, callbackMilliseconds = 0;
  for (let i = first; i < records.length; i++) {
    const h = records[i], next = records[i + 1]?.t ?? Infinity;
    if (h.t > native.frames.at(-1).monotonicSeconds) break;
    const frame = periods.get(h.t);
    assert.ok(frame, "A present history must have its own frame-period record.");
    // Each recorded present advanced the native camera, including adjacent
    // presents that reported the same display-clock sample. Preserve the
    // measured per-present period instead of suppressing that camera step.
    const tick = true;
    callbackMilliseconds += frame.period * 1000;
    // A reset view can retain the previous drag's history until the new press.
    const index = gestureIndex(h);
    if (index >= 0 && index !== active) {
      assert.equal(index, active + 1, "Native pointer history skipped or reversed a gesture.");
      assert.ok(active < 0 || released, "A new press cannot skip the preceding release.");
      active = index; cursor = 0; released = false;
    }
    const gesture = index >= 0 ? dragGestures[index] : undefined;
    // A non-launching release can update the stored pointer point without
    // changing the camera. Ignore that post-release history sample.
    const length = gesture ? Math.min(h.length, gesture.events.length - 1) : cursor;
    if (gesture) assert.ok(length >= cursor && length < gesture.events.length);
    const events = gesture?.events.slice(cursor, length) ?? [];
    if (gesture) cursor = length;
    const release = gesture?.events.at(-1);
    const launched = Boolean(gesture && h.t >= gesture.launch.t && h.average.some(v => v !== 0));
    const elapsed = (h.clock + evidence.clockOffsetSeconds - batch) * 1000;
    if (gesture && !released && cursor === gesture.events.length - 1 &&
        (launched || (!gesture.launch.average.some(v => v !== 0) && elapsed >= release.atMilliseconds))) {
      events.push(release);
      released = true;
    }
    const captures = native.frames.filter(f => f.monotonicSeconds >= h.t && f.monotonicSeconds < next);
    steps.push({ presentSeconds: h.t, clockSeconds: frame.clock, callbackMilliseconds,
      periodMilliseconds: frame.period * 1000, tick,
      events:events.map(event => ({...event,
        ...(event.kind === "up" && gesture.launch.average.some(v => v !== 0)
          ? {afterTick:true} : {beforeTick:true})})), captures,
      historyLength: length, gestureIndex:active, launched, released });
  }
  for (const event of receiptGestures.flatMap(gesture => gesture.events)) {
    const step = steps.find(value => value.presentSeconds >= batch + event.atMilliseconds / 1000);
    assert.ok(step, "Input receipt falls outside the rendered steps.");
    // A receipt-only pointer edge is observed after this present's camera
    // update. It interrupts the following update without erasing this one.
    step.events.push({...event, ...(event.qtMouseTarget ? {beforeTick:true} : {afterTick:true})});
    step.events.sort((a, b) => a.atMilliseconds - b.atMilliseconds);
  }
  assert.equal(steps.flatMap(s => s.captures).length, native.frames.length);
  assert.equal(active, dragGestures.length - 1);
  assert.equal(cursor, dragGestures.at(-1).events.length - 1);
  assert.ok(released, "The complete release must be replayed.");
  return steps;
}

// Wheel-only probes bind synchronous handler receipts to the next native
// present. This does not infer input timing from a camera/image difference.
function wheelMotionSteps(native, history, timing) {
  assert.ok(native.consumedGesture.every(e =>
    ["down", "drag", "up", "wheel"].includes(e.kind)));
  const evidence = native.consumedInputEvidence;
  const batch = native.inputs.find(e => e.event === "native-input-batch-accepted").acceptedMonotonicSeconds;
  if (native.consumedGesture.some(e => e.kind === "drag")) {
    const pointer = native.consumedGesture.filter(e => e.kind !== "wheel");
    const steps = renderedMotionSteps({
      ...native,
      gesture:native.gesture.filter(e => e.kind !== "wheel"),
      consumedGesture:pointer,
    }, history, timing);
    for (const event of native.consumedGesture.filter(e => e.kind === "wheel")) {
      const step=steps.find(value =>
        value.presentSeconds>=batch+event.atMilliseconds/1000);
      assert.ok(step,"Wheel receipt falls outside the rendered steps.");
      step.events.push({...event,beforeTick:true,
        callbackMilliseconds:step.callbackMilliseconds-step.periodMilliseconds});
    }
    return steps;
  }
  return receiptMotionSteps(native, timing);
}

// Click-only probes have handler receipts but no drag-history launch record.
// Bind each receipt to the first following present and keep every observed
// frame interval; the renderer remains responsible for deriving the motion.
function receiptMotionSteps(native, timing) {
  const batch = native.inputs.find(e => e.event === "native-input-batch-accepted").acceptedMonotonicSeconds;
  const periods = timing.map(([present, period, clock]) => ({present,period,clock}));
  const events = [...native.consumedGesture];
  const steps = [];
  let cursor = 0, callbackMilliseconds = 0;
  const first = periods.findLastIndex(frame =>
    frame.present <= native.frames[0].monotonicSeconds);
  assert.ok(first >= 0 &&
    native.frames[0].monotonicSeconds < (periods[first + 1]?.present ?? Infinity),
  "A receipt-bound capture must begin on a recorded present interval.");
  for (let index=first;index<periods.length;index++) {
    const frame=periods[index], next=periods[index+1]?.present ?? Infinity;
    if (frame.present > native.frames.at(-1).monotonicSeconds) break;
    callbackMilliseconds+=frame.period*1000;
    const due=[];
    while(cursor<events.length && batch+events[cursor].atMilliseconds/1000<=frame.present) {
      const event=events[cursor++];
      due.push({...event,callbackMilliseconds:callbackMilliseconds-
        frame.period*1000-
        Math.max(0,(frame.present-(batch+event.atMilliseconds/1000))*1000)});
    }
    const captures=native.frames.filter(capture =>
      capture.monotonicSeconds>=frame.present && capture.monotonicSeconds<next);
    steps.push({presentSeconds:frame.present,clockSeconds:frame.clock,
      callbackMilliseconds,periodMilliseconds:frame.period*1000,tick:true,
      events:due.map(event=>({...event,...(event.qtMouseTarget ? {beforeTick:true} : {afterTick:true})})),captures});
  }
  // An ignored input need not cause another native draw. Deliver the verified
  // tail receipts without inventing a frame or advancing the camera clock.
  while(cursor < events.length) {
    const event = events[cursor++];
    steps.push({presentSeconds:batch+event.atMilliseconds/1000,
      callbackMilliseconds,periodMilliseconds:0,tick:false,
      events:[{...event,afterTick:true,callbackMilliseconds}],captures:[]});
  }
  assert.equal(cursor,events.length);
  assert.equal(steps.flatMap(s=>s.captures).length,native.frames.length);
  return steps;
}
