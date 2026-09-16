/** Structural cancellation keeps numerical code independent of Node and DOM libraries. */
export interface Cancellation { throwIfAborted(): void }
