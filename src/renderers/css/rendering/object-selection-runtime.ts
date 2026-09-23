import type { ObjectControls, ObjectSelection, ObjectAction } from "../runtime/object-contract.js";
import type { SceneLifetime } from "@cssearth/engine";
import type { PreparedPresentationDefinition, PreparedPresentationPlan, PreparedView, mountPreparedPresentation } from "./prepared-presentation.js";
import type { createPreparedResidency, PreparedResidencyTicket } from "./prepared-residency.js";
export interface ObjectSelectionState {
  desired: ObjectSelection; committed: ObjectSelection | null; plan: PreparedPresentationPlan | null;
  pending: boolean; loadingMaterial: boolean; ready: boolean; error: string | null; viewRevision: number | null;
}
export interface ObjectSelectionRuntimeOptions {
  definition: PreparedPresentationDefinition & { controls: ObjectControls };
  presentation: Pick<ReturnType<typeof mountPreparedPresentation>, "publishFrame" | "commitSelection">;
  residency: ReturnType<typeof createPreparedResidency>; lifetime: SceneLifetime;
  onChange?: (state: Readonly<ObjectSelectionState>) => void;
  prepareSelection?: (selection: ObjectSelection, signal: AbortSignal) => void | Promise<void>;
  onCommit?: (selection: ObjectSelection, plan: PreparedPresentationPlan, intent: { kind: SelectionRequest['kind']; frameCamera: boolean }) => void;
  onFatalError: (error: unknown) => void; onMaterialError?: (error: unknown) => void;
  deferTextureRefinement?: boolean;
  initialLens?: string;
  initialSettings?: unknown;
}
interface SelectionRequest { selection: ObjectSelection; kind: "initial" | "selection" | "frame"; controller: AbortController; ticket: PreparedResidencyTicket | null; plan: PreparedPresentationPlan | null; previous: SelectionRequest | null; }

import { resolvePreparedPresentation } from "./prepared-presentation.js";
import { initialObjectSelection, reduceObjectSelection, requireObjectAction } from "../runtime/object-contract.js";

const sameKeys = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((key, index) => key === b[index]);

export function createObjectSelectionRuntime({
  definition, presentation, residency, lifetime, initialLens, initialSettings,
  onChange = () => {}, prepareSelection, onCommit = () => {}, onFatalError, onMaterialError = () => {}, deferTextureRefinement = false,
}: ObjectSelectionRuntimeOptions) {
  const initialSelection = initialObjectSelection(definition.controls, initialLens, initialSettings);
  let desired = initialSelection, committed: ObjectSelection | null = null, committedPlan: PreparedPresentationPlan | null = null, view: PreparedView | null = null;
  let active: SelectionRequest | null = null, destroyed = false, started = false, busy = false, error: string | null = null;
  let requests = 0, passes = 0, commits = 0, framePublications = 0;
  let textureRefinement = !deferTextureRefinement;
  const live = () => !destroyed && !lifetime.disposed;
  const state = (): Readonly<ObjectSelectionState> => Object.freeze({ desired, committed, plan: committedPlan,
    pending: busy && active?.kind !== "frame", loadingMaterial: active?.kind === "frame",
    ready: committed !== null && live(), error, viewRevision: view?.revision ?? null });
  const notify = () => { if (live()) onChange(state()); };

  function resolve(selection: ObjectSelection) {
    try {
      if (!view) throw new Error("Prepared selection requires a published view.");
      return resolvePreparedPresentation(definition, { selection, view, previousPlan: committedPlan, initial: !committed || !textureRefinement });
    } catch (failure) { if (live()) onFatalError(failure); throw failure; }
  }
  function frame(nextSelection: ObjectSelection | null = committed, nextPlan: PreparedPresentationPlan | null = committedPlan) {
    if (!live() || !nextSelection || !view) return;
    residency.beginFrame();
    try {
      presentation.publishFrame({ selection: nextSelection, view, plan: nextPlan, resources: residency.resources });
      framePublications++;
    } finally { residency.endFrame(); }
  }
  function discard(request: SelectionRequest | null | undefined) {
    if (!request?.ticket) return;
    const ticket = request.ticket;
    request.ticket = null;
    residency.discard(ticket);
  }
  function planFor(request: SelectionRequest): PreparedPresentationPlan {
    if (!request.plan) throw new Error("Prepared selection request has no demand plan.");
    return request.plan;
  }
  function preparePass(request: SelectionRequest, plan: PreparedPresentationPlan) {
    passes++;
    request.plan = plan;
    // Replacement demand and cancellation enter residency together, preserving
    // shared pending keys instead of briefly dropping every old request lease.
    request.ticket = residency.request(plan, { stabilize: request.kind === "frame" });
    request.previous = null;
    return request.ticket;
  }
  function run(selection: ObjectSelection, kind: SelectionRequest["kind"], signal?: AbortSignal, frameCamera = true) {
    if (!live() || signal?.aborted) return Promise.resolve(false);
    const superseded = active;
    let previous = active;
    while (previous && !previous.ticket) previous = previous.previous;
    const request: SelectionRequest = { selection, kind, controller: new AbortController(), ticket: null, plan: null, previous };
    active = request;
    superseded?.controller.abort();
    const operationSignal = signal ? AbortSignal.any([signal, request.controller.signal]) : request.controller.signal;
    desired = selection;
    error = null;
    requests++;
    const current = () => live() && active === request;
    let cancel!: () => void;
    const cancelled = new Promise<{ cancelled: true }>(resolve => { cancel = () => resolve({ cancelled: true }); });
    const abort = () => {
      cancel();
      if (!current()) return;
      discard(request);
      discard(request.previous);
      active = null;
      desired = committed ?? initialSelection;
      busy = false;
      notify();
    };
    operationSignal.addEventListener('abort', abort, { once: true });
    const work = (async () => {
      try { busy = true; notify(); }
      catch (failure) { if (current()) onFatalError(failure); throw failure; }
      // Give rapid input one turn to replace demand before starting a decode.
      await Promise.resolve();
      let prepared = false;
      let preparation: Promise<void> | undefined;
      while (current()) {
        let ticket;
        try {
          const plan = resolve(selection);
          ticket = request.ticket && request.plan && sameKeys(plan.required, planFor(request).required) && sameKeys(plan.prewarm, planFor(request).prewarm)
            ? request.ticket : preparePass(request, plan);
          if (!prepared && kind === 'selection' && prepareSelection) {
            preparation = Promise.resolve(prepareSelection(selection, operationSignal));
            prepared = true;
          }
          // Transfer native demand before awaiting companions, preserving shared decodes across rapid input.
          const ready = preparation ? Promise.all([ticket.ready, preparation]).then(([value]) => value) : ticket.ready;
          const result = await Promise.race([lifetime.wait(ready), cancelled]);
          if (!current() || result.cancelled) { discard(request); return false; }
          if (!result.value || request.ticket !== ticket) continue;
        } catch (failure) {
          if (!current()) { discard(request); return false; }
          discard(request);
          discard(request.previous);
          desired = committed ?? initialSelection;
          active = null;
          error = failure instanceof Error ? failure.message : String(failure);
          busy = false;
          try { notify(); } catch (publicationFailure) { onFatalError(publicationFailure); throw publicationFailure; }
          throw failure;
        }
        try {
          // Re-resolve after decode. No asynchronous gap separates this lookup
          // from publication, so a camera move cannot commit an old row.
          const plan = resolve(selection);
          if (!sameKeys(plan.required, planFor(request).required) || !sameKeys(plan.prewarm, planFor(request).prewarm) ||
              plan.required.some(key => !residency.resources.has(key))) {
            preparePass(request, plan);
            continue;
          }
          request.plan = plan;
          residency.beginFrame();
          try { presentation.commitSelection({ selection, plan, view, resources: residency.resources }); }
          finally { residency.endFrame(); }
          if (!current()) { discard(request); return false; }
          residency.commit(ticket);
          request.ticket = null;
          frame(selection, plan);
          if (!current()) return false;
          onCommit(selection, plan, { kind, frameCamera });
          if (!current()) return false;
          committed = selection;
          committedPlan = plan;
          commits++;
          active = null;
          busy = false;
          notify();
          // A publication callback may immediately request a finer view. That
          // successor does not undo this successfully committed selection.
          return live();
        } catch (failure) {
          if (current()) onFatalError(failure);
          throw failure;
        }
      }
      discard(request);
      return false;
    })();
    // The binder observes user errors; frame-only failures retain the current
    // material and are reported separately from fatal partial DOM publication.
    work.catch(() => {});
    return work.then(value => live() && value).finally(() => {
      operationSignal.removeEventListener('abort', abort);
      request.controller.abort();
    });
  }
  return Object.freeze({
    start() {
      if (!live()) return Promise.resolve(false);
      if (started) throw new Error("Initial object selection may start only once.");
      if (!view) throw new Error("Initial object selection requires the shared camera publication.");
      started = true;
      return run(desired, "initial");
    },
    dispatch(action: ObjectAction, options: { signal?: AbortSignal; frameCamera?: boolean } = {}) {
      if (!live() || !committed) return Promise.resolve(false);
      const valid = requireObjectAction(definition.controls, action);
      const next = reduceObjectSelection(desired, valid);
      return run(next, "selection", options.signal, options.frameCamera);
    },
    setView(next: PreparedView) {
      if (!live()) return;
      view = next;
      try {
        const plan = committed ? resolve(committed) : null;
        const prepared = plan && committedPlan && sameKeys(plan.required, committedPlan.required) &&
          sameKeys(plan.prewarm, committedPlan.prewarm) && plan.required.every(key => residency.resources.has(key));
        frame(committed, prepared ? plan : committedPlan);
        // Pure view facts can change within the same prepared resource set.
        // Remember the plan actually published, without a decode transaction
        // or an object-local cursor for those facts.
        if (prepared && live()) committedPlan = plan;
        if (active) {
          if (active.ticket) {
            const plan = resolve(active.selection);
            if (!sameKeys(plan.required, planFor(active).required)) preparePass(active, plan);
          }
          return;
        }
        if (!committed) return;
        if (prepared) return;
        run(committed, "frame").catch(failure => { if (live()) onMaterialError(failure); });
      } catch (failure) { if (live()) onFatalError(failure); throw failure; }
    },
    refineTextures() {
      if (!live()) return;
      textureRefinement = true;
      if (view) this.setView(view);
    },
    state,
    stats: () => Object.freeze({ ...state(), requests, passes, commits, framePublications, destroyed }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active?.controller.abort();
      discard(active);
      discard(active?.previous);
      active = null;
      busy = false;
    },
  });
}
