import { object, array, text, integer } from "./oracle-values.mts";
import { parseInteractionScenario, type InteractionScenario } from "./interaction-corpus.mts";

export interface SuiteConfiguration extends Record<string, unknown> {
  appRoot: string; renderHook: string; seedAudit: string; outputRoot: string;
  evidenceRoot?: string; browserUrl?: string; pointerTransport?: string;
  repeatCount?: number; port?: number; cases?: InteractionScenario[];
}
export interface FrameBoundCapture { inputs: string; browser: string; comparison: string }
export interface BrowserCapture { browser: string; comparison?: string; frameBound?: FrameBoundCapture }
export interface SuiteRun {
  repeat: number; status: string; native?: string; browser?: string; comparison?: string;
  frameBound?: FrameBoundCapture; error?: string; previousAttempts?: SuiteRun[];
  previousBrowserCaptures?: BrowserCapture[];
}
export interface SuiteCase { id: string; set: string; tags: readonly string[]; runs: SuiteRun[] }
export interface SuiteManifest {
  schema: string; startedAt: string; completedAt?: string;
  configuration: SuiteConfiguration & { cases: InteractionScenario[] };
  configurationSha256: string; configPath: string; cases: SuiteCase[];
  validation?: { summary: string; report: string };
}
export function parseSuiteConfiguration(value: unknown): SuiteConfiguration {
  const entry = object(value, "suite configuration");
  return { ...entry,
    appRoot: text(entry.appRoot, "appRoot"), renderHook: text(entry.renderHook, "renderHook"),
    seedAudit: text(entry.seedAudit, "seedAudit"), outputRoot: text(entry.outputRoot, "outputRoot"),
    evidenceRoot: optionalText(entry.evidenceRoot), browserUrl: optionalText(entry.browserUrl),
    pointerTransport: optionalText(entry.pointerTransport),
    repeatCount: entry.repeatCount === undefined ? undefined : integer(entry.repeatCount, "repeatCount"),
    port: entry.port === undefined ? undefined : integer(entry.port, "port"),
    cases: entry.cases === undefined ? undefined : array(entry.cases, "cases").map(parseInteractionScenario),
  };
}
export function parseSuiteManifest(value: unknown): SuiteManifest {
  const entry = object(value, "suite manifest");
  const config = parseSuiteConfiguration(entry.configuration);
  if (!config.cases) throw new TypeError("Suite configuration must contain its cases.");
  const validation = entry.validation === undefined ? undefined : object(entry.validation, "validation");
  return { ...entry, schema: text(entry.schema), startedAt: text(entry.startedAt), completedAt: optionalText(entry.completedAt),
    configuration: { ...config, cases: config.cases }, configurationSha256: text(entry.configurationSha256), configPath: text(entry.configPath),
    cases: array(entry.cases, "suite cases").map(value => {
      const valueCase = object(value, "suite case");
      return { ...valueCase, id: text(valueCase.id), set: text(valueCase.set), tags: array(valueCase.tags).map(value => text(value)), runs: array(valueCase.runs).map(parseSuiteRun) };
    }), validation: validation === undefined ? undefined : { summary: text(validation.summary), report: text(validation.report) },
  };
}
function parseSuiteRun(value: unknown): SuiteRun {
  const entry = object(value, "suite run");
  return { ...entry, repeat: integer(entry.repeat), status: text(entry.status), native: optionalText(entry.native),
    browser: optionalText(entry.browser), comparison: optionalText(entry.comparison), error: optionalText(entry.error),
    frameBound: entry.frameBound === undefined ? undefined : parseFrameBound(entry.frameBound),
    previousAttempts: entry.previousAttempts === undefined ? undefined : array(entry.previousAttempts).map(parseSuiteRun),
    previousBrowserCaptures: entry.previousBrowserCaptures === undefined ? undefined : array(entry.previousBrowserCaptures).map(value => {
      const capture = object(value, "prior browser capture");
      return { browser: text(capture.browser), comparison: optionalText(capture.comparison), frameBound: capture.frameBound === undefined ? undefined : parseFrameBound(capture.frameBound) };
    }),
  };
}
function parseFrameBound(value: unknown): FrameBoundCapture {
  const entry = object(value, "frame-bound capture");
  return { inputs: text(entry.inputs), browser: text(entry.browser), comparison: text(entry.comparison) };
}
function optionalText(value: unknown): string | undefined { return value === undefined ? undefined : text(value); }
