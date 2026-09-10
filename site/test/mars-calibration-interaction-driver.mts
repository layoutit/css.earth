export interface InteractionGeometry {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly crop: { readonly left: number; readonly top: number };
  readonly disc: { readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number };
}

interface InteractionEvent {
  readonly id: string;
  readonly kind: string;
  readonly atMilliseconds: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly button?: number;
  readonly clickCount?: number;
  readonly deltaY?: number;
}

interface InteractionScenario {
  readonly id: string;
  readonly set: "training" | "heldout";
  readonly tags: readonly string[];
  readonly startCamera: {
    readonly latitude: number;
    readonly longitude: number;
    readonly distance: number;
    readonly tilt: number;
    readonly azimuth: number;
  };
  readonly events: readonly InteractionEvent[];
}
interface InteractionCorpus { readonly scenarios: readonly InteractionScenario[]; }
type LoadInteractionCorpus = (options: { readonly set?: "all" | "training" | "heldout" }) => Promise<InteractionCorpus>;
type ResolveScenarioEvents = (scenario: InteractionScenario, geometry: InteractionGeometry) => readonly InteractionEvent[];
interface BrowserInteractionEvent {
  readonly id: string;
  readonly kind: string;
  readonly atMilliseconds: number;
  readonly x: number;
  readonly y: number;
  readonly button?: number;
  readonly clickCount?: number;
  readonly deltaY?: number;
}

export async function browserInteractionScenarios({ set, geometryFor }: {
  readonly set?: "all" | "training" | "heldout";
  readonly geometryFor: (scenario: InteractionScenario) => InteractionGeometry;
}): Promise<readonly { readonly scenario: InteractionScenario; readonly events: readonly BrowserInteractionEvent[] }[]> {
  const { loadInteractionCorpus, resolveScenarioEvents } = requireInteractionCorpus(
    await import(new URL("../../tests/objects/oracle/mars/google-earth-pro/interaction-corpus.mts", import.meta.url).href),
  );
  const corpus = await loadInteractionCorpus({ set });
  return Object.freeze(corpus.scenarios.map((scenario) => Object.freeze({
    scenario,
    events: Object.freeze(resolveScenarioEvents(
      scenario,
      geometryFor(scenario),
    ).map((event) => Object.freeze({
      id: event.id,
      kind: event.kind,
      atMilliseconds: event.atMilliseconds,
      x: event.clientX,
      y: event.clientY,
      ...(event.button === undefined ? {} : { button: event.button }),
      ...(event.clickCount === undefined
        ? {}
        : { clickCount: event.clickCount }),
      ...(event.deltaY === undefined ? {} : { deltaY: event.deltaY }),
    }))),
  })));
}

function requireInteractionCorpus(value: unknown): {
  readonly loadInteractionCorpus: LoadInteractionCorpus;
  readonly resolveScenarioEvents: ResolveScenarioEvents;
} {
  if (typeof value !== "object" || value === null) throw new TypeError("Interaction corpus module must be an object.");
  const module = value as { readonly loadInteractionCorpus?: unknown; readonly resolveScenarioEvents?: unknown };
  if (typeof module.loadInteractionCorpus !== "function" || typeof module.resolveScenarioEvents !== "function") {
    throw new TypeError("Interaction corpus module must export its scenario loaders.");
  }
  return {
    loadInteractionCorpus: module.loadInteractionCorpus as LoadInteractionCorpus,
    resolveScenarioEvents: module.resolveScenarioEvents as ResolveScenarioEvents,
  };
}
