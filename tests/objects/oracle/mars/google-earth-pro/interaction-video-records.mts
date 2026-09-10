import { object, array, finite, text, numbers } from './oracle-values.mts';
const records = (value: unknown) => array(value).map(entry => object(entry));
const matrix = (value: unknown) => {
  const result = numbers(value);
  if (result.length !== 16) throw new TypeError('Camera matrix must contain 16 entries.');
  return result;
};

export function parseNativeVideoScenario(value: unknown) {
  const row = object(value), trace = object(row.trace);
  return { ...row, id: text(row.id), trace: { path: text(trace.path), sha256: text(trace.sha256) },
    settlementMilliseconds: finite(row.settlementMilliseconds) };
}
export type NativeVideoScenario = ReturnType<typeof parseNativeVideoScenario>;

export function parseBrowserVideoScenario(value: unknown) {
  const row = object(value), binding = object(row.nativeFrameBinding), input = object(row.input);
  const frames = records(row.frames).map(frame => ({ ...frame,
    timestamp: finite(frame.timestamp), skyboxMatrix: matrix(frame.skyboxMatrix),
    camera: { ...object(frame.camera), zoom: finite(object(frame.camera).zoom) }, activeMode: text(frame.activeMode) }));
  if (frames.length === 0) throw new TypeError('Browser video scenario has no frames.');
  return { ...row, id: text(row.id), screenshots: array(row.screenshots), frames,
    nativeFrameBinding: { repeat: finite(binding.repeat), traceSha256: text(binding.traceSha256) },
    input: { ...input, startTimestamp: finite(input.startTimestamp),
      acceptedEvents: records(input.acceptedEvents).map(event => ({ ...event, type: text(event.type), timeStamp: finite(event.timeStamp) })) } };
}
export type BrowserVideoScenario = ReturnType<typeof parseBrowserVideoScenario>;

export function parseNativeVideoReport(value: unknown) {
  const row = object(value), application = object(row.application), viewport = object(application.viewportContract);
  const calibration = object(row.calibration);
  return { ...row, qualification: text(row.qualification),
    application: { ...application, viewportContract: { ...viewport, scene: object(viewport.scene) } },
    calibration: { ...calibration, decodedRgbaSha256: text(calibration.decodedRgbaSha256) },
    scenarioQualifications: records(row.scenarioQualifications).map(value => ({ ...value, id: text(value.id), qualification: text(value.qualification) })),
    runs: records(row.runs).map(run => ({ ...run, repeat: finite(run.repeat),
      scenarios: array(run.scenarios).map(parseNativeVideoScenario),
      visualReplay: { ...object(run.visualReplay), scenarios: records(object(run.visualReplay).scenarios).map(value => ({ ...value, id: text(value.id), frames: array(value.frames) })) } })) };
}

export function parseBrowserVideoReport(value: unknown) {
  const row = object(value), calibration = object(row.calibration);
  return { ...row, qualification: text(row.qualification), viewport: object(row.viewport), deviceScaleFactor: finite(row.deviceScaleFactor),
    calibration: { ...calibration, sourceDecodedRgbaSha256: text(calibration.sourceDecodedRgbaSha256) },
    includedScenarios: records(row.includedScenarios).map(value => ({ ...value, id: text(value.id) })),
    runs: records(row.runs).map(run => ({ ...run, repeat: finite(run.repeat), scenarios: array(run.scenarios).map(parseBrowserVideoScenario) })) };
}

export function parseVideoTrace(value: unknown) {
  const row = object(value);
  const frames = records(row.frames).map(frame => ({ ...frame, modelViewMatrix: matrix(frame.modelViewMatrix),
    monotonicNanoseconds: finite(frame.monotonicNanoseconds), inputPhase: text(frame.inputPhase), inputSerial: finite(frame.inputSerial) }));
  if (frames.length === 0) throw new TypeError('Native motion trace has no frames.');
  return { ...row, startNanoseconds: finite(row.startNanoseconds), frames,
    accepted: records(row.accepted).map(value => ({ ...value, id: text(value.id),
      acceptedMonotonicSeconds: finite(value.acceptedMonotonicSeconds), acceptedInputSerial: finite(value.acceptedInputSerial) })) };
}
export type VideoTrace = ReturnType<typeof parseVideoTrace>;
