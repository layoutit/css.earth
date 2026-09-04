import {
  loadInteractionCorpus,
  resolveScenarioEvents,
} from "../../src/planets/mars/tools/oracle/google-earth-pro/interaction-corpus.mjs";

export async function browserInteractionScenarios({ set, geometryFor }) {
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
