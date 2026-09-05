import { createLatestSelection } from "./latest-selection.mjs";
import { invokeRuntimeHook, requireObjectAction, requireObjectSelection, requireResolvedPresentation } from "./object-runtime-contract.mjs";

const sameKeys = (a, b) => a.length === b.length && a.every((key, index) => key === b[index]);

export function createObjectSelectionRuntime({
  definition, presentation, residency, lifetime,
  onChange = () => {}, onCommit = () => {}, onFatalError, onMaterialError = () => {},
}) {
  let desired = definition.initialSelection, committed = null, committedPlan = null, view = null;
  let active = null, destroyed = false, started = false, busy = false, error = null;
  let requests = 0, passes = 0, commits = 0, framePublications = 0;
  const live = () => !destroyed && !lifetime.disposed;
  const state = () => Object.freeze({ desired, committed, plan: committedPlan,
    pending: busy && active?.kind !== "frame", loadingMaterial: active?.kind === "frame",
    ready: committed !== null && live(), error, viewRevision: view?.revision ?? null });
  const notify = () => { if (live()) onChange(state()); };
  const latest = createLatestSelection({ lifetime, onFatalError,
    onBusyChange(value) { if (!live()) return; busy = value; notify(); } });

  function resolve(selection) {
    try {
      return requireResolvedPresentation(invokeRuntimeHook(definition, "resolvePresentation", [{ selection, view, previousPlan: committedPlan }]), definition);
    } catch (failure) { if (live()) onFatalError(failure); throw failure; }
  }
  function frame(nextSelection = committed, nextPlan = committedPlan) {
    if (!live() || !nextSelection || !view) return;
    residency.beginFrame();
    try {
      invokeRuntimeHook(presentation, "publishFrame", [{ selection: nextSelection, view, plan: nextPlan, resources: residency.resources }]);
      framePublications++;
    } finally { residency.endFrame(); }
  }
  function discard(request) {
    if (!request?.ticket) return;
    const ticket = request.ticket;
    request.ticket = null;
    residency.discard(ticket);
  }
  function preparePass(request, plan) {
    passes++;
    request.plan = plan;
    // Replacement demand and cancellation enter residency together, preserving
    // shared pending keys instead of briefly dropping every old request lease.
    request.ticket = residency.request(plan, { stabilize: request.kind === "frame" });
    request.previous = null;
    return request.ticket;
  }
  function run(selection, kind) {
    if (!live()) return Promise.resolve(false);
    let previous = active;
    while (previous && !previous.ticket) previous = previous.previous;
    const request = { selection, kind, ticket: null, plan: null, previous };
    active = request;
    desired = selection;
    error = null;
    requests++;
    const work = latest.run({
      async prepare({ isCurrent }) {
        while (live() && isCurrent()) {
          const plan = resolve(selection);
          const ticket = request.ticket && sameKeys(plan.required, request.plan.required) && sameKeys(plan.prewarm, request.plan.prewarm)
            ? request.ticket : preparePass(request, plan);
          const ready = await ticket.ready;
          if (!live() || !isCurrent()) { discard(request); return null; }
          // Camera input retires the old resource pass, not the user's action.
          if (!ready || request.ticket !== ticket) continue;
          const currentPlan = resolve(selection);
          if (!sameKeys(currentPlan.required, plan.required) || !sameKeys(currentPlan.prewarm, plan.prewarm)) {
            preparePass(request, currentPlan);
            continue;
          }
          request.plan = currentPlan;
          return { ticket, plan: currentPlan };
        }
        return null;
      },
      revalidate(prepared) {
        if (!live() || active !== request || !prepared) return true;
        const plan = resolve(selection);
        if (request.ticket !== prepared.ticket || !sameKeys(plan.required, prepared.plan.required) ||
            !sameKeys(plan.prewarm, prepared.plan.prewarm) || plan.required.some(key => !residency.resources.has(key))) {
          if (request.ticket === prepared.ticket) preparePass(request, plan);
          return false;
        }
        request.plan = plan;
        return true;
      },
      commit(prepared) {
        if (!live() || active !== request || !prepared) return;
        // Revalidation immediately precedes the synchronous publication. There
        // is no asynchronous gap between the final lookup and material writes.
        const plan = request.plan;
        residency.beginFrame();
        try { invokeRuntimeHook(presentation, "commitSelection", [{ selection, plan, view, resources: residency.resources }]); }
        finally { residency.endFrame(); }
        if (!live() || active !== request) return;
        residency.commit(prepared.ticket);
        frame(selection, plan);
        if (!live() || active !== request) return;
        onCommit(selection, plan);
        if (!live() || active !== request) return;
        committed = selection;
        committedPlan = plan;
        commits++;
        request.ticket = null;
        active = null;
      },
      discard(prepared) {
        if (!prepared || request.ticket === prepared.ticket) discard(request);
        else residency.discard(prepared.ticket);
      },
      onCurrentFailure(failure) {
        if (!live() || active !== request) return;
        discard(request);
        discard(request.previous);
        desired = committed ?? definition.initialSelection;
        active = null;
        error = failure.message;
      },
    });
    // The binder observes user errors; frame-only failures retain the current
    // material and are reported separately from fatal partial DOM publication.
    work.catch(() => {});
    return work.then(value => live() && value);
  }
  return Object.freeze({
    start() {
      if (!live()) return Promise.resolve(false);
      if (started) throw new Error("Initial object selection may start only once.");
      if (!view) throw new Error("Initial object selection requires the shared camera publication.");
      started = true;
      return run(desired, "initial");
    },
    dispatch(action) {
      if (!live() || !committed) return Promise.resolve(false);
      const valid = requireObjectAction(definition.controls, action);
      let next;
      try { next = requireObjectSelection(invokeRuntimeHook(definition, "reduceSelection", [desired, valid]), definition.controls); }
      catch (failure) { onFatalError(failure); throw failure; }
      return run(next, "selection");
    },
    setView(next) {
      if (!live()) return;
      view = next;
      try {
        const plan = committed ? resolve(committed) : null;
        const prepared = plan && sameKeys(plan.required, committedPlan.required) &&
          sameKeys(plan.prewarm, committedPlan.prewarm) && plan.required.every(key => residency.resources.has(key));
        frame(committed, prepared ? plan : committedPlan);
        // Pure view facts can change within the same prepared resource set.
        // Remember the plan actually published, without a decode transaction
        // or an object-local cursor for those facts.
        if (prepared && live()) committedPlan = plan;
        if (active) {
          if (active.ticket) {
            const plan = resolve(active.selection);
            if (!sameKeys(plan.required, active.plan.required)) preparePass(active, plan);
          }
          return;
        }
        if (!committed) return;
        if (prepared) return;
        run(committed, "frame").catch(failure => { if (live()) onMaterialError(failure); });
      } catch (failure) { if (live()) onFatalError(failure); throw failure; }
    },
    state,
    stats: () => Object.freeze({ ...state(), requests, passes, commits, framePublications, destroyed }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      discard(active);
      discard(active?.previous);
      active = null;
      busy = false;
    },
  });
}
