/** Interactive callers receive transport bytes without changing noninteractive diagnostics. */
import { AsyncLocalStorage } from 'node:async_hooks';
export interface DownloadProgress {
  readonly received: number;
  readonly total?: number;
  readonly checking?: boolean;
}
interface DownloadContext {
  readonly report: (event: DownloadProgress) => void;
  readonly signal: AbortSignal;
  readonly retainPartial: boolean;
}
const progress = new AsyncLocalStorage<DownloadContext>();
export function withDownloadProgress<T>(context: DownloadContext, work: () => Promise<T>): Promise<T> {
  return progress.run(context, work);
}
export const downloadContext = (): DownloadContext | undefined => progress.getStore();
export function reportDownloadProgress(event: DownloadProgress): void { progress.getStore()?.report(event); }
