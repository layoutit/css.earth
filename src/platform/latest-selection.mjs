export function createLatestSelection({ lifetime, onBusyChange, onFatalError }) {
  if (typeof lifetime?.wait !== "function" || typeof onBusyChange !== "function" ||
      typeof onFatalError !== "function") {
    throw new TypeError("Selection requires a lifetime, busy projection, and fatal-error handler.");
  }
  let generation = 0;
  lifetime.onDispose(() => { generation += 1; });
  return Object.freeze({ run });

  async function run({ prepare, commit, revalidate = () => true, onCurrentFailure = () => {}, discard = () => {} }) {
    if ([prepare, commit, revalidate, onCurrentFailure, discard].some(callback => typeof callback !== "function")) {
      throw new TypeError("Selection requires preparation and synchronous publication callbacks.");
    }
    if (lifetime.disposed) return false;
    const request = ++generation;
    const current = () => !lifetime.disposed && request === generation;
    const fatal = (error) => {
      if (current()) onFatalError(error);
      throw error;
    };
    try { onBusyChange(true); } catch (error) { return fatal(error); }
    while (current()) {
      let prepared, started = false, discarded = false;
      const drop = (value) => {
        if (!started || discarded) return;
        discarded = true;
        discard(value);
      };
      try {
        // Attach late disposal cleanup before awaiting logical cancellation.
        const work = Promise.resolve().then(() => {
          if (!current()) return undefined;
          started = true;
          return prepare({ isCurrent: current });
        }).then((value) => {
          if (lifetime.disposed) { drop(value); return undefined; }
          return value;
        });
        const result = await lifetime.wait(work);
        if (result.cancelled) return false;
        prepared = result.value;
      } catch (error) {
        if (!current()) return false;
        try {
          onCurrentFailure(error);
          if (current()) onBusyChange(false);
        } catch (failure) { return fatal(failure); }
        throw error;
      }
      if (!current()) { drop(prepared); return false; }
      try {
        // Nothing may await between revalidation and publication. Camera input
        // can invalidate a completed preparation during the promise handoff.
        const valid = synchronous(revalidate(prepared), "revalidation");
        if (valid === false) { drop(prepared); continue; }
        if (valid !== true) throw new TypeError("Selection revalidation must return a boolean.");
        synchronous(commit(prepared), "commit");
        if (!current()) return false;
        onBusyChange(false);
        return current();
      } catch (error) { return fatal(error); }
    }
    return false;
  }
}

function synchronous(value, label) {
  if (value && typeof value.then === "function") {
    Promise.resolve(value).catch(() => {});
    throw new TypeError(`Selection ${label} must be synchronous.`);
  }
  return value;
}
