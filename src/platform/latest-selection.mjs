export function createLatestSelection({ lifetime, onBusyChange, onFatalError }) {
  if (typeof lifetime?.wait !== "function" || typeof onBusyChange !== "function" ||
      typeof onFatalError !== "function") {
    throw new TypeError("Selection requires a lifetime, busy projection, and fatal-error handler.");
  }
  let generation = 0;
  lifetime.onDispose(() => { generation += 1; });
  return Object.freeze({ run });

  async function run({ prepare, commit, onCurrentFailure = () => {}, discard = () => {} }) {
    if (typeof prepare !== "function" || typeof commit !== "function" ||
        typeof onCurrentFailure !== "function" || typeof discard !== "function") {
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
    if (!current()) return false;
    let prepared;
    let started = false;
    let discarded = false;
    const drop = (value) => {
      if (!started || discarded) return;
      discarded = true;
      discard(value);
    };
    try {
      // Attach late disposal cleanup before awaiting the logical cancellation.
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
      const result = commit(prepared);
      if (result && typeof result.then === "function") {
        // Still observe a mistaken async callback; it must never become an
        // unhandled rejection while the fatal handler disposes the scene.
        Promise.resolve(result).catch(() => {});
        throw new TypeError("Selection commit must be synchronous.");
      }
      if (!current()) return false;
      onBusyChange(false);
      return current();
    } catch (error) { return fatal(error); }
  }
}
