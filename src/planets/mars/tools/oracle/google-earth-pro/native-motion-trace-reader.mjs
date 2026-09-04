export function decodeNativeMotionTrace(bytes) {
  if (bytes.length < 40 || bytes.toString("ascii", 0, 7) !== "CSMOTN2") {
    throw new Error("Motion trace has an invalid binary header.");
  }
  const header = Object.freeze({
    magic: bytes.toString("ascii", 0, 7),
    version: bytes.readUInt32LE(8),
    headerSize: bytes.readUInt32LE(12),
    recordSize: bytes.readUInt32LE(16),
    flags: bytes.readUInt32LE(20),
    timebaseNumerator: bytes.readUInt32LE(24),
    timebaseDenominator: bytes.readUInt32LE(28),
    ringCapacity: Number(bytes.readBigUInt64LE(32)),
  });
  if (header.version !== 2 || header.headerSize !== 40 ||
      header.recordSize !== 220 ||
      (bytes.length - header.headerSize) % header.recordSize !== 0) {
    throw new Error("Motion trace size does not match schema 2.");
  }
  const phases = [
    "idle",
    "move",
    "drag-held",
    "post-release-unresolved",
    "wheel",
    "double-click-fly-to",
  ];
  const toNanoseconds = (ticks) => Number(
    ticks * BigInt(header.timebaseNumerator) /
      BigInt(header.timebaseDenominator),
  );
  const frames = [];
  for (let offset = header.headerSize;
    offset + header.recordSize <= bytes.length; offset += header.recordSize) {
    const started = bytes.readBigUInt64LE(offset + 32);
    const ended = bytes.readBigUInt64LE(offset + 40);
    const instrumentationEnded = bytes.readBigUInt64LE(offset + 48);
    frames.push(Object.freeze({
      frameSequence: Number(bytes.readBigUInt64LE(offset)),
      inputSerial: Number(bytes.readBigUInt64LE(offset + 8)),
      inputRevision: Number(bytes.readBigUInt64LE(offset + 16)),
      inputIdentifierHash: bytes.readBigUInt64LE(offset + 24).toString(),
      monotonicNanoseconds: toNanoseconds(started),
      presentEndedNanoseconds: toNanoseconds(ended),
      instrumentationEndedNanoseconds: toNanoseconds(instrumentationEnded),
      presentDurationNanoseconds: toNanoseconds(ended - started),
      instrumentationNanoseconds: toNanoseconds(
        instrumentationEnded - started,
      ),
      threadId: Number(bytes.readBigUInt64LE(offset + 56)),
      context: `0x${bytes.readBigUInt64LE(offset + 64).toString(16)}`,
      viewport: Object.freeze(Array.from({ length: 4 }, (_, index) =>
        bytes.readInt32LE(offset + 72 + index * 4))),
      modelViewMatrix: Object.freeze(Array.from({ length: 16 }, (_, index) =>
        bytes.readFloatLE(offset + 88 + index * 4))),
      projectionMatrix: Object.freeze(Array.from({ length: 16 }, (_, index) =>
        bytes.readFloatLE(offset + 152 + index * 4))),
      inputPhase: phases[bytes[offset + 216]] ?? "unknown",
      currentContext: bytes[offset + 217] === 1,
      matricesCaptured: bytes[offset + 218] === 1,
    }));
  }
  return Object.freeze({ header, frames: Object.freeze(frames) });
}

export function nativeScenarioTrace({
  decoded,
  events,
  revision,
  revisions = [revision],
  tailMs = 1600,
}) {
  const batch = events.find((event) =>
    event.event === "native-input-batch-accepted" &&
    event.revision === revisions[0]);
  const accepted = events.filter((event) =>
    event.event === "native-input-accepted" &&
    revisions.includes(event.revision));
  const posted = events.filter((event) =>
    event.event === "native-input-posted" &&
    revisions.includes(event.revision));
  if (!batch || accepted.length === 0) {
    throw new Error(
      `Native scenario revisions ${revisions.join(",")} have no input trace.`,
    );
  }
  const startNanoseconds = batch.acceptedMonotonicSeconds * 1e9;
  const lastAcceptedNanoseconds = Math.max(...accepted.map((event) =>
    event.acceptedMonotonicSeconds * 1e9));
  const endNanoseconds = lastAcceptedNanoseconds + tailMs * 1e6;
  const frames = decoded.frames.filter((frame) =>
    frame.monotonicNanoseconds >= startNanoseconds - 5e6 &&
    frame.monotonicNanoseconds <= endNanoseconds);
  const observedSerials = new Set(frames.map(({ inputSerial }) => inputSerial));
  const cameraSerials = accepted.filter((event) =>
    ["drag", "wheel"].includes(event.kind) || event.clickCount === 2 ||
    (event.kind === "up" && accepted.some(({ kind }) => kind === "drag")))
    .map(({ acceptedInputSerial }) => acceptedInputSerial);
  const sampleOffsetsMilliseconds = Object.freeze([
    0, 16, 33, 50, 67, 100, 150, 250, 400, 650, 1000, 1400,
  ]);
  return Object.freeze({
    revision,
    revisions: Object.freeze([...revisions]),
    batch,
    accepted: Object.freeze(accepted),
    posted: Object.freeze(posted),
    startNanoseconds,
    endNanoseconds,
    frameCount: frames.length,
    frames: Object.freeze(frames),
    sampleFrames: Object.freeze(sampleOffsetsMilliseconds.map((offset) =>
      closestNativeFrame(frames, lastAcceptedNanoseconds + offset * 1e6))
      .filter(Boolean)),
    expectedCameraInputSerials: Object.freeze(cameraSerials),
    missingCameraInputSerials: Object.freeze(cameraSerials.filter((serial) =>
      !observedSerials.has(serial))),
    cadence: nativeCadenceStatistics(frames),
    instrumentation: nativeInstrumentationStatistics(frames),
  });
}

export function nativeCadenceStatistics(frames) {
  const intervals = frames.slice(1).map((frame, index) =>
    (frame.monotonicNanoseconds - frames[index].monotonicNanoseconds) / 1e6);
  const displayBudget = 1000 / 60;
  return Object.freeze({
    sampleCount: intervals.length,
    minimumMilliseconds: minimum(intervals),
    medianMilliseconds: percentile(intervals, 0.5),
    percentile95Milliseconds: percentile(intervals, 0.95),
    maximumMilliseconds: maximum(intervals),
    missedDisplayFrames: intervals.reduce((total, interval) =>
      total + Math.max(0, Math.floor(interval / displayBudget) - 1), 0),
    intervalsOver50Milliseconds: intervals.filter((value) => value >= 50)
      .length,
  });
}

export function nativeInstrumentationStatistics(frames) {
  const values = frames.map(({ instrumentationNanoseconds }) =>
    instrumentationNanoseconds / 1e6);
  return Object.freeze({
    sampleCount: values.length,
    minimumMilliseconds: minimum(values),
    medianMilliseconds: percentile(values, 0.5),
    percentile95Milliseconds: percentile(values, 0.95),
    maximumMilliseconds: maximum(values),
    totalMilliseconds: values.reduce((sum, value) => sum + value, 0),
    longTaskCount: values.filter((value) => value >= 50).length,
  });
}

export function closestNativeFrame(frames, targetNanoseconds) {
  let selected = null;
  let distance = Infinity;
  for (const frame of frames) {
    const candidate = Math.abs(frame.monotonicNanoseconds - targetNanoseconds);
    if (candidate >= distance) continue;
    selected = frame;
    distance = candidate;
  }
  return selected === null ? null : Object.freeze({
    targetNanoseconds,
    actualNanoseconds: selected.monotonicNanoseconds,
    timingErrorMilliseconds: distance / 1e6,
    frameSequence: selected.frameSequence,
    inputSerial: selected.inputSerial,
    inputPhase: selected.inputPhase,
    viewport: selected.viewport,
    modelViewMatrix: selected.modelViewMatrix,
    projectionMatrix: selected.projectionMatrix,
  });
}

export function matrixMaximumError(reference, candidate) {
  if (!reference || !candidate || reference.length !== candidate.length) {
    return Infinity;
  }
  return reference.reduce((maximum, value, index) =>
    Math.max(maximum, Math.abs(value - candidate[index])), 0);
}

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.min(
    sorted.length - 1,
    Math.floor(sorted.length * fraction),
  )];
}

function minimum(values) {
  return values.length === 0 ? null : Math.min(...values);
}

function maximum(values) {
  return values.length === 0 ? null : Math.max(...values);
}
