/** Install events carry measured bytes or step boundaries, never estimated percentages. */
import { AsyncLocalStorage } from 'node:async_hooks';

export type ToolchainStep = 'micromamba' | 'python' | 'packages' | 'check';
export type ToolchainProgress =
  | { readonly type: 'step'; readonly step: ToolchainStep; readonly status: 'waiting' | 'started' | 'finished'; readonly label?: string }
  | { readonly type: 'download'; readonly received: number; readonly total?: number }
  | { readonly type: 'installed' };
interface ProgressContext {
  readonly report?: (event: ToolchainProgress) => void;
  readonly signal: AbortSignal;
  readonly cancel?: () => void;
}
const progress = new AsyncLocalStorage<ProgressContext>();
export function withToolchainProgress<T>(context: ProgressContext, work: () => Promise<T>): Promise<T> {
  return progress.run(context, work);
}
export const toolchainInstallSignal = (): AbortSignal | undefined => progress.getStore()?.signal;
export const toolchainInstallCancel = (): (() => void) | undefined => progress.getStore()?.cancel;
export const hasToolchainProgress = (): boolean => progress.getStore()?.report !== undefined;
export function reportToolchainProgress(event: ToolchainProgress): void { progress.getStore()?.report?.(event); }
export function assertToolchainInstallActive(): void { toolchainInstallSignal()?.throwIfAborted(); }
