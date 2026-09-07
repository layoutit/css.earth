import { expect, test, vi } from 'vitest';
import { createPointFieldSelectionClient, type PointFieldWorker } from './point-field-selection-client.js';
import type { PreparedCssPointField } from './types.js';
import type { PointFieldView } from './point-field-selection.js';
const view = (x: number): PointFieldView => ({ eyeUnits: [x, 0, 0], viewRotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  focalPx: 400, viewportHalfWidthPx: 400, viewportHalfHeightPx: 300 });
const selection = { representatives: [], coveredCount: 10, consideredCount: 10, drawnCount: 0, maxProjectedErrorPx: 0, budgetLimited: false };
function setup() {
  const sent: any[] = [];
  const worker: PointFieldWorker = { onmessage: null, onerror: null, postMessage: value => sent.push(value), terminate: vi.fn() };
  const receive = vi.fn(), fail = vi.fn();
  const client = createPointFieldSelectionClient({} as PreparedCssPointField, receive, fail, () => worker);
  const reply = (data: unknown) => worker.onmessage?.({ data } as MessageEvent);
  return { worker, client, sent, receive, fail, reply };
}
test('retains one catalogue and replaces queued views while a selection is in flight', () => {
  const { client, sent, receive, reply } = setup();
  for (let x = 0; x < 100; x++) client.request(view(x));
  expect(sent).toHaveLength(1);
  reply({ ready: true });
  expect(sent[1]).toEqual({ id: 1, view: view(99) });
  for (let x = 100; x < 200; x++) client.request(view(x));
  expect(sent).toHaveLength(2);
  reply({ id: 1, selection });
  expect(receive).toHaveBeenCalledWith(selection);
  expect(sent[2]).toEqual({ id: 2, view: view(199) });
  reply({ id: 2, selection });
  client.request(view(199));
  expect(sent).toHaveLength(3);
  client.destroy();
});
test('ignores unexpected responses and destroys the worker without publishing late replies', () => {
  const { worker, client, sent, receive, reply } = setup();
  reply({ ready: true }); client.request(view(1));
  reply({ id: 99, selection }); expect(receive).not.toHaveBeenCalled();
  const handler = worker.onmessage!;
  client.destroy(); client.destroy();
  handler({ data: { id: 1, selection } } as MessageEvent);
  client.request(view(2));
  expect(receive).not.toHaveBeenCalled(); expect(sent).toHaveLength(2);
  expect(worker.terminate).toHaveBeenCalledOnce(); expect(worker.onmessage).toBeNull();
});
test('surfaces worker failures without falling back to per-frame main-thread selection', () => {
  const { worker, client, fail, sent, reply } = setup();
  reply({ error: 'Invalid point-field hierarchy' });
  expect(fail).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid point-field hierarchy' }));
  expect(worker.terminate).toHaveBeenCalledOnce(); client.request(view(1)); expect(sent).toHaveLength(1);
});
test('an unchanged cut is acknowledged without reconciling DOM or blocking the latest view', () => {
  const { client, sent, receive, reply } = setup();
  reply({ ready: true }); client.request(view(1)); client.request(view(2));
  reply({ id: 1 });
  expect(receive).not.toHaveBeenCalled(); expect(sent[2]).toEqual({ id: 2, view: view(2) });
  reply({ id: 2, selection }); expect(receive).toHaveBeenCalledOnce(); client.destroy();
});
