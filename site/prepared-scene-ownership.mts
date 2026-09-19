/** The request owns a prepared bank until a scene session takes responsibility for it.
 * Renderer claims remain authoritative for the native resources and detached tree. */
export function createPreparedSceneOwnership(requestSignal: AbortSignal) {
  const controller = new AbortController();
  let owner: { kind: 'request' | 'scene'; signal: AbortSignal } | null = { kind: 'request', signal: requestSignal };
  let prepared: { destroy(): void } | null = null;
  const cancelled = () => new DOMException('Prepared scene was cancelled.', 'AbortError');
  function dispose() {
    if (!owner) return;
    const previous = owner; owner = null;
    previous.signal.removeEventListener('abort', dispose);
    controller.abort(previous.signal.reason ?? cancelled());
    prepared?.destroy();
  }
  requestSignal.addEventListener('abort', dispose, { once: true });
  if (requestSignal.aborted) dispose();
  return {
    signal: controller.signal,
    dispose,
    own(value: { destroy(): void }) {
      if (prepared) throw new Error('A prepared scene can only be supplied once.');
      prepared = value;
      if (!owner) value.destroy();
    },
    transferTo(signal: AbortSignal) {
      if (!owner) throw cancelled();
      if (owner.kind !== 'request') throw new Error('Prepared scene already belongs to a session.');
      owner.signal.removeEventListener('abort', dispose);
      owner = { kind: 'scene', signal };
      signal.addEventListener('abort', dispose, { once: true });
      if (signal.aborted) { dispose(); throw cancelled(); }
    },
  };
}
