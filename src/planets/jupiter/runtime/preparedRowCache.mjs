const ROW_SHARD_CACHE_MODEL = "row-shard-cache";

export function createRowShardCache(plan) {
  const transport = plan?.transport;
  if (transport?.model !== ROW_SHARD_CACHE_MODEL ||
      !Array.isArray(plan.rows) || plan.rows.length === 0 ||
      !Array.isArray(plan.presentations) || plan.presentations.length === 0 ||
      plan.presentations.some(({ rowIndex }) => !plan.rows[rowIndex]) ||
      !Number.isSafeInteger(transport.maximumRetainedRowCount) ||
      transport.maximumRetainedRowCount < 1 ||
      transport.maximumRetainedRowCount > 3 ||
      !Array.isArray(transport.initialWarmRows)) {
    throw new TypeError("Invalid prepared material row-shard plan.");
  }

  const pool = createPreparedImagePool(
    transport.maximumRetainedRowCount,
  );
  let destroyed = false;
  let preparingStartup = false;
  let active = false;
  let appliedRow = null;
  let desiredRow = null;
  let appliedFrame = null;
  let desiredFrame = null;
  let desiredRows = new Set();
  let desiredRevision = 0;
  let lastWarmedRow = null;
  let warmTask = null;
  let readyCallback = null;
  let decodeCount = 0;
  let startupDecodeCount = 0;
  let runtimeDecodeCount = 0;
  let targetReadyNotifications = 0;
  let staleWarmPasses = 0;

  return Object.freeze({
    async prepareInitial() {
      if (destroyed) return;
      preparingStartup = true;
      active = true;
      appliedRow = transport.defaultRow;
      desiredRow = transport.defaultRow;
      appliedFrame = transport.defaultFrame;
      desiredFrame = transport.defaultFrame;
      desiredRows = new Set(transport.initialWarmRows);
      try {
        await Promise.all([...desiredRows].map(async (rowIndex) => {
          if (await warmRow(rowIndex)) noteDecode();
        }));
      } finally {
        preparingStartup = false;
      }
    },
    presentation(frameIndex) {
      const prepared = plan.presentations[frameIndex];
      if (!prepared) {
        throw new RangeError(`Unprepared material frame: ${frameIndex}.`);
      }
      active = true;
      const previousFrame = desiredFrame;
      desiredFrame = frameIndex;
      updateDesiredRows(
        prepared.rowIndex,
        previousFrame === null ? 0 : Math.sign(frameIndex - previousFrame),
      );
      if (!pool.has(prepared.rowIndex)) {
        requestWarm();
        const fallbackRow = pool.nearestReady(prepared.rowIndex);
        if (fallbackRow === null) return null;
        const fallback = fallbackPresentation(frameIndex, fallbackRow);
        appliedRow = fallback.rowIndex;
        appliedFrame = fallback.frameIndex;
        return fallback;
      }
      appliedRow = prepared.rowIndex;
      appliedFrame = prepared.frameIndex;
      requestWarm();
      return prepared;
    },
    onReady(callback) {
      readyCallback = callback;
    },
    stats() {
      return Object.freeze({
        model: transport.model,
        active,
        appliedRow,
        desiredRow,
        appliedFrame,
        desiredFrame,
        requestedRows: Object.freeze([...desiredRows]),
        retainedRowCount: pool.stats().readyCount,
        pendingRowCount: pool.stats().pendingCount,
        maximumRetainedRowCount: transport.maximumRetainedRowCount,
        decodeCount,
        startupDecodeCount,
        runtimeDecodeCount,
        targetReadyNotifications,
        staleWarmPasses,
        ...pool.stats(),
      });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active = false;
      readyCallback = null;
      desiredRows.clear();
      lastWarmedRow = null;
      pool.destroy();
    },
  });

  function updateDesiredRows(rowIndex, frameDirection) {
    const previousRow = desiredRow;
    const direction = frameDirection || (
      previousRow === null ? 0 : Math.sign(rowIndex - previousRow)
    );
    const nextDesiredRows = new Set([rowIndex]);
    for (let distance = 1;
      direction !== 0 && distance < transport.maximumRetainedRowCount;
      distance += 1) {
      const predictedRow = Math.max(0, Math.min(
        plan.rows.length - 1,
        rowIndex + direction * distance,
      ));
      if (predictedRow !== rowIndex) nextDesiredRows.add(predictedRow);
    }
    if (desiredRow === rowIndex && sameKeys(desiredRows, nextDesiredRows)) return;
    desiredRow = rowIndex;
    desiredRevision += 1;
    desiredRows = nextDesiredRows;
  }

  function requestWarm() {
    if (destroyed || !active || desiredRow === null || warmTask ||
        nextWarmRow() === null) return;
    let task;
    task = runWarmPump()
      .catch((error) => console.error(error))
      .finally(() => {
        if (warmTask !== task) return;
        warmTask = null;
      });
    warmTask = task;
  }

  async function runWarmPump() {
    while (!destroyed && active && desiredRow !== null) {
      const targetRow = desiredRow;
      const revision = desiredRevision;
      const rowIndex = nextWarmRow();
      if (rowIndex === null) return;
      const target = rowIndex === targetRow;
      const warmed = await warmRow(rowIndex);
      if (!warmed) return;
      if (destroyed || !active) return;
      noteDecode();
      lastWarmedRow = rowIndex;
      if (desiredRevision !== revision || desiredRow !== targetRow) {
        staleWarmPasses += 1;
        readyCallback?.();
        return;
      }
      if (target) {
        targetReadyNotifications += 1;
        readyCallback?.();
        return;
      }
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

  function warmRow(rowIndex) {
    const protectedRows = new Set();
    if (transport.maximumRetainedRowCount >= 3) {
      if (appliedRow !== null) protectedRows.add(appliedRow);
      if (lastWarmedRow !== null) protectedRows.add(lastWarmedRow);
    } else if (lastWarmedRow !== null) {
      protectedRows.add(lastWarmedRow);
    } else if (appliedRow !== null) {
      protectedRows.add(appliedRow);
    }
    return pool.prepare(rowIndex, plan.rows[rowIndex], protectedRows);
  }

  function noteDecode() {
    decodeCount += 1;
    if (preparingStartup) startupDecodeCount += 1;
    else runtimeDecodeCount += 1;
  }

  function fallbackPresentation(frameIndex, rowIndex) {
    const framesPerRow = transport.framesPerRow ?? 1;
    const firstFrame = rowIndex * framesPerRow;
    const lastFrame = Math.min(
      plan.presentations.length - 1,
      firstFrame + framesPerRow - 1,
    );
    return plan.presentations[Math.max(firstFrame, Math.min(lastFrame, frameIndex))];
  }
}

function sameKeys(left, right) {
  return left.size === right.size && [...left].every((key) => right.has(key));
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
    nearestReady(target) {
      let nearest = null;
      let distance = Infinity;
      for (const [key, slot] of byKey) {
        if (!slot.ready) continue;
        const nextDistance = Math.abs(key - target);
        if (nextDistance < distance) {
          nearest = key;
          distance = nextDistance;
        }
      }
      return nearest;
    },
    prepare(key, asset, protectedKeys) {
      if (destroyed) return Promise.resolve(false);
      const retained = byKey.get(key);
      if (retained) return retained.pending ?? Promise.resolve(true);
      let slot = slots.find(({ key: slotKey, pending }) =>
        slotKey === null && pending === null);
      if (!slot && slots.length < capacity) {
        slot = {
          image: Object.assign(new Image(), { decoding: "sync" }),
          key: null,
          pending: null,
          ready: false,
          ticket: 0,
        };
        slots.push(slot);
      }
      if (!slot) {
        slot = slots
          .filter(({ key: slotKey, pending }) =>
            pending === null && !protectedKeys.has(slotKey))
          .sort((left, right) =>
            Math.abs(right.key - key) - Math.abs(left.key - key))[0];
      }
      if (!slot) {
        const pending = slots.map(({ pending }) => pending).filter(Boolean);
        if (pending.length > 0) {
          return Promise.race(pending).then(() =>
            pool.prepare(key, asset, protectedKeys));
        }
        return Promise.resolve(false);
      }
      if (slot.key !== null) {
        byKey.delete(slot.key);
        releaseCount += 1;
      }
      const url = asset.url ?? asset.assetUrl;
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
        throw new Error(`Prepared material image decode failed: ${url}`, {
          cause: error,
        });
      });
      slot.pending = pending;
      byKey.set(key, slot);
      return pending;
    },
    stats() {
      return Object.freeze({
        readyKeys: Object.freeze([...byKey.entries()]
          .filter(([, slot]) => slot.ready)
          .map(([key]) => key)),
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
