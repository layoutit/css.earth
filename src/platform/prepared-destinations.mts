import type { SceneLifetime } from "@cssearth/engine";
import type { RetainedCubicSkyOrbit } from "../renderers/css/dist/platform/object-orbit.js";
import { isArray } from "./is-array.mts";
type DestinationCamera = Parameters<RetainedCubicSkyOrbit["flyToState"]>[0];
export interface PreparedDestination { coverage: string; camera: DestinationCamera; }
export interface PreparedDestinationPlan { catalog: { url: string; bytes: number; sha256: string; count: number }; defaultLens: string; statuses: { detail: string; overview: string }; }
export interface PreparedDestinationOptions { plan: PreparedDestinationPlan; ready: Promise<unknown>; lifetime: SceneLifetime; selectLens(id: string): Promise<boolean>; navigate(camera: DestinationCamera): unknown; reset(): unknown; }
// The runtime owns catalogue transport and lifetime; packages provide pinned data.
export function createPreparedDestinations({ plan, ready, lifetime, selectLens, navigate, reset }: PreparedDestinationOptions) {
  const controller = new AbortController();
  lifetime.onDispose(() => controller.abort());
  const assertLive = () => { if (lifetime.disposed) throw new Error("Object was unmounted."); };
  return Object.freeze({
    async load(signal?: AbortSignal) {
      assertLive();
      const response = await fetch(plan.catalog.url, { signal: signal
        ? AbortSignal.any([signal, controller.signal]) : controller.signal });
      if (!response.ok) throw new Error("City catalogue request failed.");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== plan.catalog.bytes) throw new Error("City catalogue size drifted.");
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map(value => value.toString(16).padStart(2, "0")).join("");
      assertLive();
      if (digest !== plan.catalog.sha256) throw new Error("City catalogue identity drifted.");
      const catalog: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!catalog || typeof catalog !== "object" || !("schema" in catalog) ||
        catalog.schema !== "cssearth-prepared-destinations@1" || !("places" in catalog) ||
        !isArray(catalog.places) || catalog.places.length !== plan.catalog.count) {
        throw new Error("City catalogue is incompatible.");
      }
      return catalog;
    },
    async select(place: PreparedDestination) {
      await ready; assertLive();
      if (!await selectLens(plan.defaultLens)) throw new Error("Destination selection was superseded.");
      assertLive();
      return { status: place.coverage === "detail" ? plan.statuses.detail : plan.statuses.overview,
        arrival: navigate(place.camera) };
    },
    reset() { if (!lifetime.disposed) return reset(); },
  });
}
