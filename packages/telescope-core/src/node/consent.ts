/** The command supplies terminal policy; archive and toolchain owners request consent before writing bytes. */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface DownloadConsent {
  readonly kind: 'download';
  readonly bytes: number | null;
  readonly archive: string;
  readonly destination: string;
  readonly cache?: string;
}

export interface ToolchainConsent {
  readonly kind: 'toolchain';
  /** Approximate installed size; dependency wheels and platform-specific binaries vary. */
  readonly bytes: number | null;
  readonly name: string;
  readonly destination: string;
  readonly packages: readonly string[];
}

export type TransferConsent = DownloadConsent | ToolchainConsent;
export type TransferConsentHandler = (info: TransferConsent) => Promise<void>;

const consent = new AsyncLocalStorage<{ handler: TransferConsentHandler; cancelled: boolean }>();

export class DownloadCancelledError extends Error {
  constructor() { super('Download cancelled.'); this.name = 'DownloadCancelledError'; }
}

/** Keep independent calls isolated, including concurrent archive work within a command. */
export function withTransferConsent<T>(handler: TransferConsentHandler, work: () => Promise<T>): Promise<T> {
  return consent.run({ handler, cancelled: false }, work);
}

export function hasTransferConsent(): boolean { return consent.getStore() !== undefined; }

/** Library consumers without a terminal policy retain their existing noninteractive behavior. */
export async function requestTransferConsent(info: TransferConsent): Promise<void> {
  assertTransferNotCancelled();
  const state = consent.getStore();
  try { await state?.handler(info); }
  catch (error) {
    if (state && error instanceof DownloadCancelledError) state.cancelled = true;
    throw error;
  }
}

/** Publication owners must refuse even when a provider caught the cancellation. */
export function assertTransferNotCancelled(): void {
  if (consent.getStore()?.cancelled) throw new DownloadCancelledError();
}
