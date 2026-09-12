import { readFile } from "node:fs/promises";
import { object, array, text, finite, integer, strings, numbers, parseJson } from "./oracle-values.mts";
import type { ViewInfo } from "./controller.mts";

export type CorpusSet = "all" | "training" | "heldout";
export type InteractionKind = "move" | "down" | "drag" | "up" | "wheel";
export interface InteractionEvent {
  readonly id: string; readonly kind: InteractionKind; readonly atMilliseconds: number;
  readonly discX: number; readonly discY: number;
  readonly button?: number; readonly clickCount?: number; readonly deltaY?: number;
}
export interface InteractionScenario {
  readonly id: string; readonly set: "training" | "heldout" | "regression";
  readonly tags: readonly string[]; readonly startCamera: Readonly<ViewInfo>;
  readonly events: readonly InteractionEvent[];
  readonly expectedMeasuredOutputs?: readonly string[];
}
export interface CorpusScenario extends InteractionScenario {
  readonly set: "training" | "heldout";
  readonly expectedMeasuredOutputs: readonly string[];
}
export interface InteractionGeometry {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly crop: { readonly left: number; readonly top: number };
  readonly disc: { readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number };
}
export interface ResolvedInteractionEvent extends InteractionEvent {
  readonly clientX: number; readonly clientY: number;
  readonly normalizedViewportX: number; readonly normalizedViewportY: number;
}
export function parseInteractionEvent(value: unknown): InteractionEvent {
  const entry = object(value, "interaction event");
  const kind = text(entry.kind, "event.kind");
  if (kind !== "move" && kind !== "down" && kind !== "drag" && kind !== "up" && kind !== "wheel") throw new TypeError(`Unknown event kind: ${kind}`);
  return { ...entry, id: text(entry.id, "event.id"), kind,
    atMilliseconds: finite(entry.atMilliseconds, "event.atMilliseconds"),
    discX: finite(entry.discX, "event.discX"), discY: finite(entry.discY, "event.discY"),
    ...(entry.button === undefined ? {} : { button: integer(entry.button, "event.button") }),
    ...(entry.clickCount === undefined ? {} : { clickCount: integer(entry.clickCount, "event.clickCount") }),
    ...(entry.deltaY === undefined ? {} : { deltaY: finite(entry.deltaY, "event.deltaY") }),
  };
}
export function parseInteractionScenario(value: unknown): InteractionScenario {
  const entry = object(value, "interaction scenario");
  const set = text(entry.set, "scenario.set");
  if (set !== "training" && set !== "heldout" && set !== "regression") throw new TypeError(`Unknown scenario set: ${set}`);
  const camera = object(entry.startCamera, "scenario.startCamera");
  return { ...entry, id: text(entry.id, "scenario.id"), set, tags: strings(entry.tags, "scenario.tags"),
    startCamera: { latitude: finite(camera.latitude), longitude: finite(camera.longitude), distance: finite(camera.distance), tilt: finite(camera.tilt), azimuth: finite(camera.azimuth) },
    events: array(entry.events, "scenario.events").map(parseInteractionEvent),
    ...(entry.expectedMeasuredOutputs === undefined ? {} : { expectedMeasuredOutputs: strings(entry.expectedMeasuredOutputs, "scenario.expectedMeasuredOutputs") }),
  };
}
export function parseInteractionCorpus(value: unknown) {
  const entry = object(value, "interaction corpus");
  const coordinate = object(entry.coordinateContract, "coordinateContract");
  const time = object(entry.timeContract, "timeContract");
  const split = object(entry.splitContract, "splitContract");
  const scenarios = array(entry.scenarios, "corpus.scenarios").map((value): CorpusScenario => {
    const scenario = parseInteractionScenario(value);
    if (scenario.set === "regression") throw new TypeError("The corpus split must be training or heldout.");
    return { ...scenario, set: scenario.set, expectedMeasuredOutputs: strings(scenario.expectedMeasuredOutputs, "scenario.expectedMeasuredOutputs") };
  });
  return { ...entry, schema: text(entry.schema), version: integer(entry.version),
    coordinateContract: { ...coordinate, range: numbers(coordinate.range), space: text(coordinate.space) },
    timeContract: { ...time, clock: text(time.clock) },
    splitContract: { ...split, training: integer(split.training), heldOut: integer(split.heldOut), heldOutFraction: finite(split.heldOutFraction) }, scenarios,
  };
}


const CORPUS_URL = new URL("./interaction-corpus-v1.json", import.meta.url);

export async function loadInteractionCorpus({ set = "all" }: { set?: CorpusSet } = {}) {
  const corpus = parseInteractionCorpus(parseJson(await readFile(CORPUS_URL, "utf8")));
  const scenarios = set === "all"
    ? corpus.scenarios
    : corpus.scenarios.filter((scenario) => scenario.set === set);
  if (set !== "all" && !["training", "heldout"].includes(set)) {
    throw new TypeError(`Unknown interaction corpus set: ${set}`);
  }
  return Object.freeze({
    ...corpus,
    scenarios: Object.freeze(scenarios.map(freezeScenario)),
  });
}

export function resolveScenarioEvents(scenario: Pick<InteractionScenario, "events">, geometry: InteractionGeometry): readonly ResolvedInteractionEvent[] {
  const { viewport, crop, disc } = geometry;
  const values = [
    viewport?.width,
    viewport?.height,
    crop?.left,
    crop?.top,
    disc?.centerX,
    disc?.centerY,
    disc?.width,
    disc?.height,
  ];
  if (values.some((value) => !Number.isFinite(value)) ||
      viewport.width <= 0 || viewport.height <= 0 ||
      disc.width <= 0 || disc.height <= 0) {
    throw new TypeError("Interaction corpus geometry is invalid.");
  }
  const radiusX = disc.width / 2;
  const radiusY = disc.height / 2;
  return Object.freeze(scenario.events.map((event) => {
    const clientX = crop.left + disc.centerX + event.discX * radiusX;
    const clientY = crop.top + disc.centerY + event.discY * radiusY;
    return Object.freeze({
      ...event,
      clientX,
      clientY,
      normalizedViewportX: clientX / viewport.width,
      normalizedViewportY: clientY / viewport.height,
    });
  }));
}

function freezeScenario(scenario: CorpusScenario) {
  return Object.freeze({
    ...scenario,
    tags: Object.freeze([...scenario.tags]),
    startCamera: Object.freeze({ ...scenario.startCamera }),
    events: Object.freeze(scenario.events.map((event) =>
      Object.freeze({ ...event }))),
    expectedMeasuredOutputs: Object.freeze([
      ...scenario.expectedMeasuredOutputs,
    ]),
  });
}
