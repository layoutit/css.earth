import { createWorldContextPlanner } from './world-context-planner.js';
import type { PlannedWorldContext, WorldContextView } from './world-context-planner.js';
import { parsePreparedWorldContext } from './prepared-world-context.js';
import type { PreparedWorldContext } from './prepared-world-context.js';
import type { WorldPlannerSource } from './world-context-planner-client.js';
import { createPointFramePlanner, pointFrameTransfers } from '../stars/point-field-frame.js';
import { loadPreparedCssPointField } from '../stars/loader.js';
import { createWorldContextFrameEncoder, contextFrameTransfers } from './world-context-frame.js';
import type { PreparedCssPointField } from '../stars/types.js';
import { unpackWorldBodies } from './world-context-view-transport.js';

type Initialise = { annotationPriorities?: Readonly<Record<string, number>> } &
  ({ plan: PreparedWorldContext; stars?: PreparedCssPointField } | { source: WorldPlannerSource });
const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<Initialise | { id: number; view: Omit<WorldContextView, 'bodies'>; bodies: Float64Array }>) => void;
  postMessage(value: unknown, transfer?: Transferable[]): void;
};
let calculate: ReturnType<typeof createWorldContextPlanner>;
let points: ReturnType<typeof createPointFramePlanner> | undefined;
let encode = createWorldContextFrameEncoder();
let bodies: Map<string, PreparedWorldContext['focus']>;
const report = (error: unknown) => scope.postMessage({ error: error instanceof Error ? error.message : String(error) });

async function read(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Prepared planner resource request failed: ${response.status}.`);
  return response.arrayBuffer();
}
// The same validation the main thread runs, on the worker's own copy.
async function load(source: WorldPlannerSource) {
  const [plan, stars] = await Promise.all([
    read(source.contextUrl).then(bytes => parsePreparedWorldContext(JSON.parse(new TextDecoder().decode(bytes)))),
    source.stars ? loadPreparedCssPointField(source.stars.descriptor, { read: path => {
      const url = source.stars!.files[path];
      if (typeof url !== 'string') throw new Error(`Prepared planner resource unavailable: ${path}.`);
      return read(url);
    } }) : undefined,
  ]);
  return { plan, stars };
}
function initialise(plan: PreparedWorldContext, stars: PreparedCssPointField | undefined, annotationPriorities?: Readonly<Record<string, number>>) {
  encode = createWorldContextFrameEncoder();
  calculate = createWorldContextPlanner(plan, annotationPriorities);
  points = stars ? createPointFramePlanner(stars) : undefined;
  bodies = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  scope.postMessage({ ready: true });
}
scope.onmessage = ({ data }) => {
  try {
    if ('source' in data) {
      void load(data.source).then(({ plan, stars }) => initialise(plan, stars, data.annotationPriorities)).catch(report);
    } else if ('plan' in data) {
      initialise(data.plan, data.stars, data.annotationPriorities);
    } else {
      const view: WorldContextView = { ...data.view, bodies: unpackWorldBodies(data.bodies) };
      const frame: PlannedWorldContext = calculate(view);
      if (view.points && points) frame.points = points(data.id, view.points, view.world,
        view.viewport, bodies.get(view.selectedId));
      const packet = encode(data.id, view.contextCommittedId ?? 0, frame);
      scope.postMessage({ id: data.id, frame: packet }, [...contextFrameTransfers(packet), ...(frame.points ? pointFrameTransfers(frame.points) : [])]);
    }
  } catch (error) {
    report(error);
  }
};
