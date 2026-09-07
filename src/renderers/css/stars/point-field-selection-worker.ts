import { createPointFieldSelection } from './point-field-selection.js';
import type { PointFieldView } from './point-field-selection.js';
import type { PreparedCssPointField } from './types.js';

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<{ payload: PreparedCssPointField } | { id: number; view: PointFieldView }>) => void;
  postMessage(value: unknown): void;
};
let select: ReturnType<typeof createPointFieldSelection>;
let previous = new Set<string>();
scope.onmessage = ({ data }) => {
  try {
    if ('payload' in data) { select = createPointFieldSelection(data.payload); scope.postMessage({ ready: true }); }
    else {
      const selection = select(data.view);
      const identities = selection.representatives.map(point => `${point.kind}:${point.index}`);
      const changed = identities.length !== previous.size || identities.some(identity => !previous.has(identity));
      if (changed) previous = new Set(identities);
      // A changed observer does not necessarily change the retained identities.
      // Acknowledge unchanged cuts without transporting or reconciling them again.
      scope.postMessage({ id: data.id, ...(changed ? { selection } : {}) });
    }
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
