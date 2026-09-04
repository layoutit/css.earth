import { CANONICAL_PREPARED_IMAGE_DENSITY } from
  "../../../../site/runtime-policy.mjs";

const ROW_SHARD_CACHE_MODEL = "row-shard-cache";
const ROW_SHARD_REQUEST_STABILITY_MILLISECONDS = 120;

export function createEarthRowShardCache(plan, { enabled = true } = {}) {
  const transport = plan?.transport;
  if (transport?.model !== ROW_SHARD_CACHE_MODEL ||
      !Array.isArray(plan.preparedRows) || plan.preparedRows.length === 0 ||
      !Array.isArray(plan.frames) || plan.frames.length === 0 ||
      plan.frames.some(({ rowIndex }) => !plan.preparedRows[rowIndex]) ||
      !Number.isSafeInteger(transport.maximumRetainedRowCount) ||
      transport.maximumRetainedRowCount < 1 ||
      transport.maximumRetainedRowCount > 3 ||
      !Array.isArray(transport.initialWarmRows) ||
      typeof enabled !== "boolean") {
    throw new TypeError("Invalid prepared Earth material row-shard plan.");
  }

  const selectedUrl = ({ one, two }) => two || one;
  const pool = createPreparedImagePool(
    transport.maximumRetainedRowCount,
  );
  let destroyed = false;
  let transportEnabled = enabled;
  let preparingStartup = false;
  let appliedRow = null;
  let desiredRow = transport.defaultRow;
  let desiredRows = new Set(transport.initialWarmRows);
  let desiredRevision = 0;
  let warmTask = null;
  let warmTimer = null;
  let warmTimerRevision = null;
  let readyCallback = null;
  let decodeCount = 0;
  let startupDecodeCount = 0;
  let runtimeDecodeCount = 0;
  let targetReadyNotifications = 0;
  let staleWarmPasses = 0;
  let suppressedPresentationCount = 0;

  return Object.freeze({
    async prepareInitial() {
      if (destroyed || !transportEnabled) return false;
      preparingStartup = true;
      try {
        await Promise.all([...desiredRows].map(async (rowIndex) => {
          if (await warmRow(rowIndex, rowIndex === desiredRow)) noteDecode();
        }));
        appliedRow = desiredRow;
        return true;
      } finally {
        preparingStartup = false;
      }
    },
    presentation(frameIndex) {
      const prepared = plan.frames[frameIndex];
      if (!prepared) {
        throw new RangeError(`Unprepared Earth material frame: ${frameIndex}.`);
      }
      updateDesiredRows(prepared.rowIndex);
      if (!transportEnabled) {
        suppressedPresentationCount += 1;
        return null;
      }
      if (!pool.has(prepared.rowIndex)) {
        requestWarm();
        return null;
      }
      appliedRow = prepared.rowIndex;
      requestWarm();
      return Object.freeze({
        ...prepared,
        url: selectedUrl(plan.preparedRows[prepared.rowIndex].assets),
      });
    },
    onReady(callback) {
      readyCallback = callback;
    },
    setEnabled(nextEnabled) {
      const next = Boolean(nextEnabled);
      if (destroyed || next === transportEnabled) return false;
      transportEnabled = next;
      desiredRevision += 1;
      if (transportEnabled) requestWarm();
      return true;
    },
    stats() {
      const workingSet = "two";
      return Object.freeze({
        model: transport.model,
        enabled: transportEnabled,
        selectedPreparedDensity: CANONICAL_PREPARED_IMAGE_DENSITY,
        appliedRow,
        desiredRow,
        requestedRows: Object.freeze([...desiredRows]),
        retainedRowCount: pool.stats().readyCount,
        pendingRowCount: pool.stats().pendingCount,
        maximumRetainedRowCount: transport.maximumRetainedRowCount,
        requestStabilityMilliseconds:
          ROW_SHARD_REQUEST_STABILITY_MILLISECONDS,
        decodeCount,
        startupDecodeCount,
        runtimeDecodeCount,
        targetReadyNotifications,
        staleWarmPasses,
        suppressedPresentationCount,
        initialDecodedWorkingSetBytes:
          transport.initialDecodedWorkingSetBytes[workingSet],
        maximumDecodedWorkingSetBytes:
          transport.maximumDecodedWorkingSetBytes[workingSet],
        ...pool.stats(),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      readyCallback = null;
      desiredRows.clear();
      if (warmTimer !== null) clearTimeout(warmTimer);
      warmTimer = null;
      pool.destroy();
    },
  });

  function updateDesiredRows(rowIndex) {
    if (desiredRow === rowIndex) return;
    desiredRow = rowIndex;
    desiredRevision += 1;
    desiredRows = preparedRowNeighborhood(
      rowIndex,
      plan.preparedRows.length,
      transport.maximumRetainedRowCount,
    );
  }

  function requestWarm() {
    if (destroyed || !transportEnabled || desiredRow === null || warmTask) {
      return;
    }
    if (nextWarmRow() === null) {
      if (warmTimer !== null) clearTimeout(warmTimer);
      warmTimer = null;
      warmTimerRevision = null;
      return;
    }
    if (warmTimer !== null && warmTimerRevision === desiredRevision) return;
    if (warmTimer !== null) clearTimeout(warmTimer);
    warmTimerRevision = desiredRevision;
    warmTimer = setTimeout(() => {
      warmTimer = null;
      warmTimerRevision = null;
      if (destroyed || !transportEnabled || warmTask ||
          nextWarmRow() === null) return;
      startWarmPass();
    }, ROW_SHARD_REQUEST_STABILITY_MILLISECONDS);
  }

  function startWarmPass() {
    let task;
    task = runWarmPass()
      .catch((error) => console.error(error))
      .finally(() => {
        if (warmTask !== task) return;
        warmTask = null;
        requestWarm();
      });
    warmTask = task;
  }

  async function runWarmPass() {
    if (destroyed || !transportEnabled || desiredRow === null) return;
    const targetRow = desiredRow;
    const revision = desiredRevision;
    const rowIndex = nextWarmRow();
    if (rowIndex === null) return;
    const target = rowIndex === targetRow;
    const warmed = await warmRow(rowIndex, target);
    if (!warmed || destroyed) return;
    noteDecode();
    if (!transportEnabled) return;
    if (desiredRevision !== revision || desiredRow !== targetRow) {
      staleWarmPasses += 1;
      return;
    }
    if (target) {
      targetReadyNotifications += 1;
      readyCallback?.();
    }
  }

  function nextWarmRow() {
    if (desiredRow === null) return null;
    if (!pool.has(desiredRow)) return desiredRow;
    let next = null;
    let distance = Infinity;
    for (const rowIndex of desiredRows) {
      if (pool.has(rowIndex)) continue;
      const nextDistance = Math.abs(rowIndex - desiredRow);
      if (nextDistance < distance) {
        next = rowIndex;
        distance = nextDistance;
      }
    }
    return next;
  }

  function warmRow(rowIndex, target) {
    const protectedRows = new Set();
    if (appliedRow !== null) protectedRows.add(appliedRow);
    if (!target) {
      for (const candidate of desiredRows) {
        if (pool.has(candidate)) protectedRows.add(candidate);
      }
    }
    return pool.prepare(
      rowIndex,
      selectedUrl(plan.preparedRows[rowIndex].assets),
      protectedRows,
    );
  }

  function noteDecode() {
    decodeCount += 1;
    if (preparingStartup) startupDecodeCount += 1;
    else runtimeDecodeCount += 1;
  }
}

function createPreparedImagePool(capacity) {
  const slots = [];
  const byKey = new Map();
  let destroyed = false;
  let releaseCount = 0;

  const pool = Object.freeze({
    has(key) {
      return byKey.get(key)?.ready === true;
    },
    prepare(key, url, protectedKeys) {
      if (destroyed) return Promise.resolve(false);
      const retained = byKey.get(key);
      if (retained) return retained.pending ?? Promise.resolve(true);
      let slot = slots.find(({ key: slotKey, pending }) =>
        slotKey === null && pending === null);
      if (!slot && slots.length < capacity) {
        slot = {
          image: createPreparedImage(),
          key: null,
          pending: null,
          ready: false,
          ticket: 0,
        };
        slots.push(slot);
      }
      if (!slot) {
        slot = slots.find(({ key: slotKey, pending }) =>
          pending === null && !protectedKeys.has(slotKey));
      }
      if (!slot) {
        const pending = slots.map(({ pending }) => pending).filter(Boolean);
        if (pending.length > 0) {
          return Promise.race(pending).then(() =>
            pool.prepare(key, url, protectedKeys));
        }
        return Promise.resolve(false);
      }
      if (slot.key !== null) {
        byKey.delete(slot.key);
        releaseCount += 1;
        slot.image.removeAttribute("src");
        slot.image = createPreparedImage();
      }
      const ticket = ++slot.ticket;
      slot.key = key;
      slot.ready = false;
      slot.image.src = url;
      const pending = slot.image.decode().then(() => {
        if (destroyed || slot.ticket !== ticket) return false;
        slot.pending = null;
        slot.ready = true;
        return true;
      }).catch((error) => {
        if (destroyed || slot.ticket !== ticket) return false;
        byKey.delete(key);
        slot.pending = null;
        slot.ready = false;
        slot.key = null;
        slot.image.removeAttribute("src");
        throw new Error(`Prepared Earth material image decode failed: ${url}`, {
          cause: error,
        });
      });
      slot.pending = pending;
      byKey.set(key, slot);
      return pending;
    },
    stats() {
      return Object.freeze({
        retainedImageCount: byKey.size,
        readyCount: [...byKey.values()].filter(({ ready }) => ready).length,
        pendingCount: [...byKey.values()].filter(({ pending }) => pending).length,
        imageAllocations: slots.length,
        releaseCount,
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      byKey.clear();
      for (const slot of slots) {
        slot.ticket += 1;
        slot.image.removeAttribute("src");
        slot.key = null;
        slot.pending = null;
        slot.ready = false;
      }
    },
  });
  return pool;
}

function createPreparedImage() {
  return Object.assign(new Image(), { decoding: "sync" });
}

function preparedRowNeighborhood(rowIndex, rowCount, capacity) {
  const rows = new Set([rowIndex]);
  for (let distance = 1; rows.size < capacity; distance += 1) {
    if (rowIndex - distance >= 0) rows.add(rowIndex - distance);
    if (rows.size < capacity && rowIndex + distance < rowCount) {
      rows.add(rowIndex + distance);
    }
  }
  return rows;
}
