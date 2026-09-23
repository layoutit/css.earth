import { createWorldContextPlanner } from './world-context-planner.js';
import type { PlannedWorldContext, WorldContextView } from './world-context-planner.js';
import { decodeWorldOrbits, parsePreparedWorldContextSummary } from '../prepared-world-context.js';
import type { PreparedWorldContextGeometry } from '../prepared-world-context.js';
import type { WorldPlannerSource } from './world-context-planner-client.js';
import { createWorldContextFrameEncoder, contextFrameTransfers } from './world-context-frame.js';
import { unpackWorldBodies } from './world-context-view-transport.js';

type Initialise = { annotationPriorities?: Readonly<Record<string, number>>; annotationLandmarks?: readonly string[] } &
  ({ plan: PreparedWorldContextGeometry } | { source: WorldPlannerSource });
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<Initialise | { id: number; view: Omit<WorldContextView, 'bodies'>; bodies: Float64Array }>) => void;
  postMessage(value: unknown, transfer?: Transferable[]): void;
};
let calculate: ReturnType<typeof createWorldContextPlanner>;
let encode = createWorldContextFrameEncoder();
const report = (error: unknown) => scope.postMessage({ error: error instanceof Error ? error.message : String(error) });

async function read(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Prepared planner resource request failed: ${response.status}.`);
  return response.arrayBuffer();
}
// The summary, then the binary orbit bank it describes, read as typed-array views, never parsed as JSON.
async function load(source: WorldPlannerSource) {
  const [summary, orbits] = await Promise.all([read(source.summaryUrl), read(source.orbitsUrl)]);
  const plan = parsePreparedWorldContextSummary(JSON.parse(new TextDecoder().decode(summary)));
  return decodeWorldOrbits(plan, orbits);
}
function initialise(plan: PreparedWorldContextGeometry, annotationPriorities?: Readonly<Record<string, number>>, annotationLandmarks?: readonly string[]) {
  encode = createWorldContextFrameEncoder();
  calculate = createWorldContextPlanner(plan, annotationPriorities, annotationLandmarks);
  scope.postMessage({ ready: true });
}
scope.onmessage = ({ data }) => {
  try {
    if ('source' in data) {
      void load(data.source).then(plan => initialise(plan, data.annotationPriorities, data.annotationLandmarks)).catch(report);
    } else if ('plan' in data) {
      initialise(data.plan, data.annotationPriorities, data.annotationLandmarks);
    } else {
      const view: WorldContextView = { ...data.view, bodies: unpackWorldBodies(data.bodies) };
      const frame: PlannedWorldContext = calculate(view);
      const packet = encode(data.id, view.contextCommittedId ?? 0, frame);
      scope.postMessage({ id: data.id, frame: packet }, contextFrameTransfers(packet));
    }
  } catch (error) {
    report(error);
  }
};
