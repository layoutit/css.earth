import { readFile } from 'node:fs/promises';
import { array, object, finite, text, boolean, parseJson } from './oracle-values.mts';

export const json = async (path: string): Promise<Record<string, unknown>> =>
  object(parseJson(await readFile(path, 'utf8')), path);
export const records = (value: unknown) => array(value).map(entry => object(entry));
const optionalNumber = (value: unknown) => value == null ? undefined : finite(value);
const optionalText = (value: unknown) => value == null ? undefined : text(value);

export function cameraMatrix(value: unknown): number[] {
  const css = text(value);
  if (!css.startsWith('matrix3d(') || !css.endsWith(')')) throw new TypeError('Expected a CSS matrix3d camera pose.');
  const matrix = css.slice(9, -1).split(',').map(Number);
  if (matrix.length !== 16 || !matrix.every(Number.isFinite)) throw new TypeError('Expected 16 finite camera matrix entries.');
  return matrix;
}

function gesture(value: unknown) {
  const row = object(value);
  const kind = text(row.kind);
  if (!['move', 'drag', 'down', 'up', 'wheel'].includes(kind)) throw new TypeError('Unknown native gesture kind.');
  return { ...row, kind, id: optionalText(row.id),
    atMilliseconds: optionalNumber(row.atMilliseconds),
    qtWheelTarget: optionalText(row.qtWheelTarget), qtMouseTarget: optionalText(row.qtMouseTarget),
    qtButtons: optionalNumber(row.qtButtons), qtX: optionalNumber(row.qtX), qtY: optionalNumber(row.qtY),
    qtDelta: optionalNumber(row.qtDelta), clickCount: optionalNumber(row.clickCount) };
}

export function inputReceipt(value: unknown) {
  const row = object(value);
  return { ...row, event: text(row.event), id: optionalText(row.id), revision: optionalNumber(row.revision),
    acceptedMonotonicSeconds: optionalNumber(row.acceptedMonotonicSeconds) };
}

export function gestureReport(value: unknown) {
  const report = object(value);
  return { gesture: array(report.gesture).map(gesture), inputs: array(report.inputs).map(inputReceipt) };
}

export function deliveryRecords(value: unknown) {
  // Event logs contain many unrelated records. Validate only the Qt delivery records used here.
  return records(value).filter(row => row.event === 'qt-wheel-delivered' || row.event === 'qt-mouse-delivered')
    .map(row => ({ ...row, event: text(row.event), id: text(row.id), before: finite(row.before),
      accepted: boolean(row.accepted), buttons: optionalNumber(row.buttons),
      target: text(row.target), x: finite(row.x), y: finite(row.y),
      delta: optionalNumber(row.delta), type: optionalNumber(row.type), button: optionalNumber(row.button) }));
}

export function nativeReport(value: unknown) {
  const row = object(value), viewport = object(row.viewport);
  const visibility = (value: unknown) => {
    const view = object(value);
    return { visibleWindowCount: finite(view.visibleWindowCount),
      frontmostApplication: view.frontmostApplication == null ? null : { pid: finite(object(view.frontmostApplication).pid) } };
  };
  const inputs = records(row.inputs).map(inputReceipt);
  return { ...row, pid: finite(row.pid), before: visibility(row.before), after: visibility(row.after),
    revision: optionalNumber(row.revision), inputs, gesture: array(row.gesture).map(gesture),
    consumedGesture: row.consumedGesture == null ? undefined : array(row.consumedGesture).map(value => {
      const event = gesture(value); return { ...event, atMilliseconds: finite(event.atMilliseconds) };
    }),
    frames: records(row.frames).map(frame => ({ ...frame, presentIndex: finite(frame.presentIndex),
      monotonicSeconds: finite(frame.monotonicSeconds), path: text(frame.path) })),
    viewport: { ...viewport, width: finite(viewport.width), height: finite(viewport.height), sceneLeft: finite(viewport.sceneLeft) },
    dropped: array(row.dropped), stopObservation: { ...object(row.stopObservation),
      lastPresentedSequence: finite(object(row.stopObservation).lastPresentedSequence) },
    nativeMotionTrace: optionalText(row.nativeMotionTrace), eventLog: optionalText(row.eventLog) };
}

export function browserState(value: unknown) {
  const state = object(value), pose = object(state.pose), trackball = object(state.trackball);
  const scene = text(pose.scene); cameraMatrix(scene);
  return { ...state, nodes: finite(state.nodes), pose: { ...pose, scene },
    trackball: { ...trackball, focalLength: finite(trackball.focalLength),
      renderFocalLength: optionalNumber(trackball.renderFocalLength),
      centerX: optionalNumber(trackball.centerX), centerY: optionalNumber(trackball.centerY) } };
}

export function browserReport(value: unknown) {
  const row = object(value);
  return { ...row, timingMode: text(row.timingMode), state: browserState(row.state),
    readbackDuringGesture: boolean(row.readbackDuringGesture), stopObservation: object(row.stopObservation),
    epoch: finite(row.epoch), zoom: finite(row.zoom), finalNodes: finite(row.finalNodes), failures: array(row.failures),
    clock: { ...object(row.clock), timeOrigin: finite(object(row.clock).timeOrigin) },
    inputs: records(row.inputs).map(input => ({ ...input, type: text(input.type), receivedAt: finite(input.receivedAt) })),
    motionSamples: records(row.motionSamples).map(sample => {
      const interaction = object(sample.interaction), pose = object(sample.pose);
      const scene = text(pose.scene); cameraMatrix(scene);
      return { ...sample, timestamp: finite(sample.timestamp), zoom: finite(sample.zoom), pose: { ...pose, scene },
        interaction: { ...interaction, activeMode: text(interaction.activeMode),
          activeMotionCount: finite(interaction.activeMotionCount),
          wheelZoom: { active: boolean(object(interaction.wheelZoom).active) } } };
    }) };
}

export function frameBoundReport(value: unknown) {
  const row = object(value);
  return { ...row, state: browserState(row.state), failures: array(row.failures), finalNodes: finite(row.finalNodes),
    timingMode: text(row.timingMode), frameBinding: text(row.frameBinding), finalNodesScope: optionalText(row.finalNodesScope),
    codeResources: row.codeResources == null ? undefined : array(row.codeResources),
    captureToolSha256: optionalText(row.captureToolSha256),
    frames: records(row.frames).map(frame => {
      const pose = object(frame.pose), scene = text(pose.scene); cameraMatrix(scene);
      return { ...frame, nativePresentIndex: finite(frame.nativePresentIndex), marker: finite(frame.marker),
        zoom: finite(frame.zoom), pose: { ...pose, scene } };
    }) };
}
