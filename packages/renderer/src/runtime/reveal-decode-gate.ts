/**
 * WebKit drops the decoded pixels of a hidden mesh's images (decodeForPaint in prepared-residency.ts). Shown at once, its
 * first frame decoded the whole surface in paint: Mars back from its marker spent 123 ms in one paint of a 177 ms iPad
 * frame (2026-09-30). The gate decodes the committed images off the main thread first, as a mount does before its first
 * connection, and lets the mesh show on the view after.
 */
export function createRevealDecodeGate({ decode, onDecoded, onError = error => console.error(error) }: {
  /** Decodes the committed images; resolves when they can paint. */
  decode(): Promise<unknown>;
  /** The decode finished: publish the view again so the mesh can show. */
  onDecoded(): void;
  onError?(error: unknown): void;
}) {
  let pending: Promise<void> | null = null, decoded = false;
  return {
    /** Whether a hidden mesh may show now. The first call starts the decode; the calls after wait for it. */
    ready() {
      if (decoded) return true;
      const current: Promise<void> = pending ??= decode().then(() => {}, onError).then(() => {
        if (pending !== current) return;
        decoded = true; onDecoded();
      });
      return false;
    },
    /** The mesh has shown, or left the geometry stage: its next reveal decodes again. */
    reset() { pending = null; decoded = false; },
  };
}
