import assert from "node:assert/strict";
import type { Page } from "playwright";
import { requireRecord, requireArray, isRecord } from "../sources/source-values.mts";

export const AUDIT_PREPARED_READINESS_SCHEMA = "cssearth-prepared-capture-readiness@1";

// This function is serialized into the browser. It observes the common public
// runtime; it never changes a camera, page publisher, animation, or resource.
export function observeAuditPreparedActivity(id: string) {
  // These helpers stay inside the serialized observer. Diagnostics are an
  // external browser boundary, and every invoked member is checked first.
  function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') throw new TypeError('Prepared runtime diagnostics are missing.');
    return value as Record<string, unknown>;
  }
  function call(receiver: Record<string, unknown>, name: string): unknown {
    const method = receiver[name];
    if (typeof method !== 'function') throw new TypeError(`Prepared runtime diagnostics lack ${name}.`);
    return Reflect.apply(method, receiver, []);
  }
  const object = record(Reflect.get(window, `__${id}`)), runtime = record(object.runtime), camera = record(object.camera);
  const selection = record(call(runtime, 'selection')), stats = record(call(camera, 'stats'));
  const inertia = stats.dragInertia == null ? null : record(stats.dragInertia);
  const destination = inertia?.destinationFlyTo == null ? null : record(inertia.destinationFlyTo);
  return {
    selection: { ready: selection.ready, pending: selection.pending,
      loadingMaterial: selection.loadingMaterial, error: selection.error },
    camera: call(camera, 'state'),
    destinationActive: destination?.active ?? false,
    pages: call(runtime, 'pages'),
  };
}

export function auditPreparedActivityReady(input: unknown) {
  const activity = requireRecord(input, "Prepared activity observation");
  const selection = requireRecord(activity.selection, "Prepared selection");
  assert.ok(activity && typeof activity === "object", "Prepared activity observation is required.");
  assert.equal(selection.error, null, "Selection failed before the fixed readbacks.");
  let ready = selection.ready === true && selection.pending === false &&
    selection.loadingMaterial === false && activity.destinationActive === false;
  assert.ok(activity.camera && Object.values(requireRecord(activity.camera)).some(Number.isFinite), "A real camera observation is required.");
  assert.ok(activity.pages && typeof activity.pages === "object" && !Array.isArray(activity.pages), "Shared page observations are required.");
  for (const [id, input] of Object.entries(requireRecord(activity.pages))) {
    const page = requireRecord(input, "Prepared page activity"), index = requireRecord(page.index, "Prepared page index");
    const apiImages = requireRecord(page.apiImages, "Prepared page images");
    assert.deepEqual(page.errors, [], `Prepared layer ${id} failed before capture.`);
    assert.deepEqual(index.errors, [], `Prepared layer ${id} index failed before capture.`);
    assert.ok(Array.isArray(page.desired) && Array.isArray(page.retained), "Prepared page demand and residency are required.");
    ready &&= page.pendingSelection === false && page.activeLoads === 0 && index.activeLoads === 0 &&
      apiImages.activeRequests === 0 && requireArray(page.desired).every(key =>
        requireArray(page.retained).some(slot => isRecord(slot) && slot.key === key && slot.ready === true && slot.published === true));
  }
  return ready;
}

export async function waitForAuditPreparedReadiness(page: Page, objectId: string, { timeout = 120000 } = {}) {
  const started = Date.now();
  let previous: string | null = null, last: ReturnType<typeof observeAuditPreparedActivity> | null = null, observations = 0;
  do {
    last = await page.evaluate(observeAuditPreparedActivity, objectId);
    observations++;
    const ready = auditPreparedActivityReady(last), serialized = JSON.stringify(last);
    if (ready && previous === serialized) return {
      schema: AUDIT_PREPARED_READINESS_SCHEMA, observations, elapsedMilliseconds: Date.now() - started, state: last,
    };
    previous = ready ? serialized : null;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.waitForTimeout(100);
  } while (Date.now() - started < timeout);
  throw new Error(`Prepared scene did not finish its finite pending work before capture: ${JSON.stringify(last)}`);
}
