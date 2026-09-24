import { createWorldContextPlanner } from './world-context-planner.js';
import type { PlannedWorldContext, WorldContextView } from './world-context-planner.js';
import { decodeWorldOrbitBank, orbitBankOf, parsePreparedWorldContextSummary } from '../../prepared-data/world-context.js';
import type { PreparedWorldContext, PreparedWorldContextGeometry } from '../../prepared-data/world-context.js';
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
  if (!response.ok) throw new Error(`Prepared planner resource ${url} request failed: ${response.status}.`);
  return response.arrayBuffer();
}

// Orbit paths arrive per bank (an orbit centre's, or a plain dot's own): a frame that needs a path it lacks names the body,
// and its bank is read once, decoded and attached; the page is told so it plans again. A bank that fails is logged
// once and left out, so a missing file costs its orbits, not the world.
let banks: { plan: PreparedWorldContext; source: WorldPlannerSource; bankOf: ReadonlyMap<string, string>;
  requested: Set<string> } | null = null;
function requestWantedBanks() {
  const wanted = calculate.takeWantedOrbits();
  if (!banks || !wanted.length) return;
  const { plan, source, bankOf, requested } = banks;
  for (const centre of new Set(wanted.flatMap(id => bankOf.get(id) ?? []))) {
    if (requested.has(centre)) continue;
    requested.add(centre);
    read(`${source.orbitBanksUrl}${centre}.bin`).then(bytes => {
      calculate.attachOrbits(decodeWorldOrbitBank(plan, centre, bytes));
      scope.postMessage({ orbitsLoaded: centre });
    }).catch(error => console.error(`World orbit bank ${centre} could not be loaded; its orbits stay undrawn.`, error));
  }
}

function initialise(plan: PreparedWorldContext | PreparedWorldContextGeometry, annotationPriorities?: Readonly<Record<string, number>>, annotationLandmarks?: readonly string[]) {
  encode = createWorldContextFrameEncoder();
  calculate = createWorldContextPlanner(plan, annotationPriorities, annotationLandmarks);
  scope.postMessage({ ready: true });
}
scope.onmessage = ({ data }) => {
  try {
    if ('source' in data) {
      const source = data.source;
      void read(source.summaryUrl).then(bytes => {
        const plan = parsePreparedWorldContextSummary(JSON.parse(new TextDecoder().decode(bytes)));
        banks = { plan, source, requested: new Set(),
          bankOf: new Map(plan.bodies.flatMap(body => body.orbit ? [[body.id, orbitBankOf(body.orbit)] as const] : [])) };
        initialise(plan, data.annotationPriorities, data.annotationLandmarks);
      }).catch(report);
    } else if ('plan' in data) {
      banks = null;
      initialise(data.plan, data.annotationPriorities, data.annotationLandmarks);
    } else {
      const view: WorldContextView = { ...data.view, bodies: unpackWorldBodies(data.bodies) };
      const frame: PlannedWorldContext = calculate(view);
      const packet = encode(data.id, view.contextCommittedId ?? 0, frame);
      scope.postMessage({ id: data.id, frame: packet }, contextFrameTransfers(packet));
      requestWantedBanks();
    }
  } catch (error) {
    report(error);
  }
};
