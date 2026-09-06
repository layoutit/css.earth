import assert from "node:assert/strict";

export const AUDIT_PREPARED_READINESS_SCHEMA = "cssearth-prepared-capture-readiness@1";

// This function is serialized into the browser. It observes the common public
// runtime; it never changes a camera, page publisher, animation, or resource.
export function observeAuditPreparedActivity(id) {
  const object = window[`__${id}`], selection = object.runtime.selection();
  return {
    selection: { ready: selection.ready, pending: selection.pending,
      loadingMaterial: selection.loadingMaterial, error: selection.error },
    camera: object.camera.state(),
    destinationActive: object.camera.stats().dragInertia?.destinationFlyTo?.active ?? false,
    pages: object.runtime.pages(),
  };
}

export function auditPreparedActivityReady(activity) {
  assert.ok(activity && typeof activity === "object", "Prepared activity observation is required.");
  assert.equal(activity.selection.error, null, "Selection failed before the fixed readbacks.");
  let ready = activity.selection.ready === true && activity.selection.pending === false &&
    activity.selection.loadingMaterial === false && activity.destinationActive === false;
  assert.ok(activity.camera && Object.values(activity.camera).some(Number.isFinite), "A real camera observation is required.");
  assert.ok(activity.pages && typeof activity.pages === "object" && !Array.isArray(activity.pages), "Shared page observations are required.");
  for (const [id, page] of Object.entries(activity.pages)) {
    assert.deepEqual(page.errors, [], `Prepared layer ${id} failed before capture.`);
    assert.deepEqual(page.index.errors, [], `Prepared layer ${id} index failed before capture.`);
    assert.ok(Array.isArray(page.desired) && Array.isArray(page.retained), "Prepared page demand and residency are required.");
    ready &&= page.pendingSelection === false && page.activeLoads === 0 && page.index.activeLoads === 0 &&
      page.apiImages.activeRequests === 0 && page.desired.every(key =>
        page.retained.some(slot => slot.key === key && slot.ready === true && slot.published === true));
  }
  return ready;
}

export async function waitForAuditPreparedReadiness(page, objectId, { timeout = 120000 } = {}) {
  const started = Date.now();
  let previous = null, last = null, observations = 0;
  do {
    last = await page.evaluate(observeAuditPreparedActivity, objectId);
    observations++;
    const ready = auditPreparedActivityReady(last), serialized = JSON.stringify(last);
    if (ready && previous === serialized) return {
      schema: AUDIT_PREPARED_READINESS_SCHEMA, observations, elapsedMilliseconds: Date.now() - started, state: last,
    };
    previous = ready ? serialized : null;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForTimeout(100);
  } while (Date.now() - started < timeout);
  throw new Error(`Prepared scene did not finish its finite pending work before capture: ${JSON.stringify(last)}`);
}
