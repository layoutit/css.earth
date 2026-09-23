import { createSceneLifetime, type SceneLifetime } from '@cssearth/engine';
import type { NavigationOptions } from './navigation-history.mts';
import type { createNavigationTiming } from './navigation-timing.mts';

type RunningPhase = 'preparing' | 'flying' | 'committing';
type Outcome = 'finished' | 'interrupted' | 'cancelled' | 'failed';
export interface NavigationRequest {
  readonly id: string;
  readonly cancelledFlight: boolean;
  readonly signal: AbortSignal;
  readonly lifetime: Pick<SceneLifetime, 'wait'>;
  readonly phase: RunningPhase | Outcome;
  readonly options: NavigationOptions;
  readonly timing: ReturnType<typeof createNavigationTiming>;
  url: string;
  own(cleanup: () => void): void;
}
type RequestOptions = Pick<NavigationRequest, 'id' | 'cancelledFlight' | 'url' | 'options' | 'timing'>;
export type NavigationLifecycle = ReturnType<typeof createNavigationLifecycle>;

/** One authority for in-flight work. A settled request can never publish or dispose its successor. */
export function createNavigationLifecycle({ onCancel, onError }: {
  onCancel(request: NavigationRequest): void;
  onError(error: unknown): void;
}) {
  let current: { request: NavigationRequest; controller: AbortController; lifetime: SceneLifetime; setPhase(phase: RunningPhase | Outcome): void } | null = null;
  const owns = (request: NavigationRequest) => current?.request === request;
  function finish(request: NavigationRequest, outcome: Outcome): boolean {
    if (!current || current.request !== request) return false;
    const owner = current;
    // Invalidate before abort listeners, cleanup callbacks or cancelled waits can run.
    current = null;
    owner.setPhase(outcome);
    request.timing.mark(outcome === 'interrupted' ? 'cancelled' : outcome);
    if (outcome === 'cancelled' || outcome === 'failed') owner.controller.abort();
    for (const error of owner.lifetime.destroy()) onError(error);
    return true;
  }
  function cancel() {
    const request = current?.request;
    if (request && finish(request, 'cancelled')) onCancel(request);
  }
  return Object.freeze({
    get current() { return current?.request ?? null; },
    owns, finish, cancel,
    begin(options: RequestOptions): NavigationRequest {
      cancel();
      const controller = new AbortController(), lifetime = createSceneLifetime();
      let phase: RunningPhase | Outcome = 'preparing';
      const request: NavigationRequest = {
        ...options, signal: controller.signal, lifetime,
        get phase() { return phase; },
        own(cleanup) { for (const error of lifetime.onDispose(cleanup)) onError(error); },
      };
      current = { request, controller, lifetime, setPhase(next) { phase = next; } };
      return request;
    },
    advance(request: NavigationRequest, phase: RunningPhase): boolean {
      if (!current || current.request !== request) return false;
      if (phase === request.phase) return true;
      if (phase === 'preparing' || request.phase === 'committing') {
        throw new Error(`Invalid navigation transition: ${request.phase} → ${phase}`);
      }
      current.setPhase(phase);
      return true;
    },
    // Saved history entries can be installed before their camera finishes flying.
    // Both that early publication and the final arrival must still own the request.
    commit(request: NavigationRequest, publish: () => void): boolean {
      if (!owns(request)) return false;
      publish();
      return owns(request);
    },
  });
}
