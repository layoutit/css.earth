import {
  loadInteractionCorpus,
  resolveScenarioEvents,
  type CorpusSet, type CorpusScenario, type InteractionGeometry,
} from "./interaction-corpus.mts";

export async function nativeInteractionScenarios({ set, geometryFor }: { set?: CorpusSet; geometryFor: (scenario: CorpusScenario) => InteractionGeometry }) {
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
      x: event.normalizedViewportX,
      y: event.normalizedViewportY,
      ...(event.button === undefined ? {} : { button: event.button }),
      ...(event.clickCount === undefined
        ? {}
        : { clickCount: event.clickCount }),
      ...(event.deltaY === undefined ? {} : { deltaY: event.deltaY }),
    }))),
  })));
}

