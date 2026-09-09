import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import type { PreparedWorldContext } from './prepared-world-context.js';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ plan: PreparedWorldContext; annotationPriorities?: Readonly<Record<string, number>> } | { id: number; view: WorldContextView }>) => void;
  postMessage(value: unknown): void;
};
let calculate: ReturnType<typeof createWorldContextPlanner>;
scope.onmessage = ({ data }) => {
  try {
    if ('plan' in data) { calculate = createWorldContextPlanner(data.plan, data.annotationPriorities); scope.postMessage({ ready: true }); }
    else scope.postMessage({ id: data.id, frame: calculate(data.view) });
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
