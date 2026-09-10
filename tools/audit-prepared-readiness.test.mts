import assert from "node:assert/strict";
import test from "node:test";
import { auditPreparedActivityReady } from "./audit-prepared-readiness.mts";

type Activity = {
  selection: { ready: boolean; pending: boolean; loadingMaterial: boolean; error: string | null };
  camera: { pitch: number; zoom: number };
  destinationActive: boolean;
  pages: Record<string, {
    desired: string[]; retained: { key: string; ready: boolean; published: boolean }[];
    pendingSelection: boolean; activeLoads: number; index: { activeLoads: number; errors: string[] };
    apiImages: { activeRequests: number }; errors: string[];
  }>;
};

const activity = (): Activity => ({ selection: { ready: true, pending: false, loadingMaterial: false, error: null },
  camera: { pitch: 20, zoom: 1024 }, destinationActive: false,
  pages: { layer: { desired: ["a"], retained: [{ key: "a", ready: true, published: true }],
    pendingSelection: false, activeLoads: 0, index: { activeLoads: 0, errors: [] },
    apiImages: { activeRequests: 0 }, errors: [] } } });

test("capture waits for selection, flight, directory transport, image decoding, and committed pages", () => {
  assert.equal(auditPreparedActivityReady(activity()), true);
  const changes: Array<(state: Activity) => void> = [
    state => state.selection.pending = true,
    state => state.selection.loadingMaterial = true,
    state => state.destinationActive = true,
    state => state.pages.layer.pendingSelection = true,
    state => state.pages.layer.index.activeLoads = 1,
    state => state.pages.layer.activeLoads = 1,
    state => state.pages.layer.apiImages.activeRequests = 1,
    state => state.pages.layer.retained[0].ready = false,
    state => state.pages.layer.retained[0].published = false,
    state => state.pages.layer.desired.push("replacement"),
  ];
  for (const change of changes) { const state = activity(); change(state); assert.equal(auditPreparedActivityReady(state), false); }
});

test("source errors fail readiness instead of becoming a successful settled capture", () => {
  const changes: Array<(state: Activity) => void> = [state => state.selection.error = "failed selection",
    state => state.pages.layer.errors.push("failed image"),
    state => state.pages.layer.index.errors.push("failed directory")];
  for (const change of changes) {
    const state = activity(); change(state); assert.throws(() => auditPreparedActivityReady(state), /failed|capture/);
  }
});

test("a scene without prepared page demand uses the same readiness observation", () => {
  const state = activity(); state.pages = {};
  assert.equal(auditPreparedActivityReady(state), true);
  state.selection.ready = false;
  assert.equal(auditPreparedActivityReady(state), false);
});
