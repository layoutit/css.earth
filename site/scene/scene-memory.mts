import { readObjectDiagnostics } from '@cssearth/renderer/runtime/object-diagnostics.ts';

/** Snapshot values before/after synchronous teardown; never retain the retired mount.
 * The capture harness records the event only in a diagnostic build. */
export function observeSceneRetirement(target: Window, objectId: string) {
  const diagnostic = readObjectDiagnostics(target, objectId);
  if (!diagnostic) return () => {};
  const snapshot = () => ({ lifetime: diagnostic.runtime.lifetime(), resources: diagnostic.runtime.resources(),
    connectedNodes: diagnostic.stableNodes.reduce((count, node) => count + Number(node.isConnected), 0),
    initialNodes: diagnostic.stableNodes.length });
  const before = snapshot();
  return () => target.dispatchEvent(new CustomEvent('cssearthscenereleased', {
    detail: { objectId, atEpochMs: target.performance.timeOrigin + target.performance.now(), before, after: snapshot() },
  }));
}
