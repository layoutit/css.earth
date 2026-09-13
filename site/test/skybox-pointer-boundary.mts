import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Page } from "playwright";
import { BASE_TILE } from "@layoutit/polycss";
import type { CameraState, ObjectBrowserProfile } from "./browser-profile-types.mts";

interface PlanetReference { readonly id: string; }
interface Point { readonly x: number; readonly y: number; }
interface CameraPlan { readonly projection?: { readonly model?: string }; readonly logicalBodyDiameter: number; readonly sceneScale: number; }
interface PoseState extends CameraState { readonly pose: unknown; readonly silhouetteRadius?: number; }
interface DragInertiaStats { readonly activeMode: string; readonly projection: string; readonly pendingPointer: boolean; readonly activeMotionCount: number; readonly surfaceFlyTo: { readonly active: boolean }; }
interface CameraRuntime { state(): PoseState; setState(state: Partial<PoseState>): void; stats(): { readonly drag?: { readonly model?: string }; readonly dragInertia: DragInertiaStats }; }
interface ObjectRuntime { readonly camera: CameraRuntime; }
interface InspectedPoint { readonly point: Point; readonly onInput: boolean; readonly outsideBody: boolean; }

declare global {
  interface Window {
    __skyBoundaryDeselects?: number;
    __skyBoundaryDeselect?: (event: Event) => void;
  }
}

export async function proveSkyboxPointerBoundary(page: Page, planet: PlanetReference, profile: ObjectBrowserProfile) {
  const initial = await cameraPose(page, planet.id);
  const bounds = await profile.bounds(page);
  const cameraPlan = parseCameraPlan(JSON.parse(await readFile(
    new URL(`../../src/objects/${planet.id}/prepared/runtime.json`, import.meta.url), "utf8")), planet.id);
  const viewport = page.viewportSize();
  assert.ok(viewport, `${planet.id}: test viewport must be configured`);
  let sky = { x: viewport.width - 32, y: 96 };
  const results = [];
  let primaryFailure: unknown;
  try {
    for (const zoom of new Set([
      initial.zoom,
      Math.max(bounds.minimumZoom, initial.zoom * 0.65),
    ])) {
      await restore({ ...initial, zoom });
      sky = await emptySkyPoint(page, planet.id, profile.inputSelector, sky, cameraPlan);
      const cameraBounds = await page.locator(".polycss-camera").boundingBox();
      assert.ok(cameraBounds, `${planet.id}: camera must be visible`);
      const body = {
        x: cameraBounds.x + cameraBounds.width / 2,
        y: cameraBounds.y + cameraBounds.height / 2,
      };
      assert.equal(await page.evaluate(({ sky, selector }: { readonly sky: Point; readonly selector: string }): boolean => {
        const input = document.querySelector(selector);
        return input?.contains(document.elementFromPoint(sky.x, sky.y)) ?? false;
      },
      { sky, selector: profile.inputSelector }), true,
      `${planet.id}: sky gesture must reach the actual input surface`);
      const before = await cameraPose(page, planet.id);
      await page.mouse.move(sky.x, sky.y);
      await page.mouse.down();
      assert.equal((await motionStats(page, planet.id)).pendingPointer, true,
        `${planet.id}: sky press must own an orbit drag`);
      assert.equal((await motionStats(page, planet.id)).projection, "screen-plane-orbit");
      assert.deepEqual(await cameraPose(page, planet.id), before,
        `${planet.id}: a stationary sky press must not rotate`);
      await page.mouse.move(sky.x - 40, sky.y + 20, { steps: 4 });
      const skyDragged = await cameraPose(page, planet.id);
      assert.notDeepEqual(skyDragged.pose, before.pose,
        `${planet.id}: dragging empty sky must orbit the camera`);
      await page.mouse.move(body.x, body.y, { steps: 4 });
      const crossed = await cameraPose(page, planet.id);
      assert.notDeepEqual(crossed.pose, skyDragged.pose,
        `${planet.id}: a sky orbit continues onto the planet`);
      assert.equal((await motionStats(page, planet.id)).activeMode, "drag");
      assert.equal((await motionStats(page, planet.id)).projection, "screen-plane-orbit",
        `${planet.id}: crossing the limb cannot switch the gesture mapping`);
      await page.waitForTimeout(150);
      await page.mouse.up();
      assert.deepEqual(await cameraPose(page, planet.id), crossed,
        `${planet.id}: a paused sky drag must retain its release pose`);
      assert.equal((await motionStats(page, planet.id)).activeMotionCount, 0,
        `${planet.id}: a paused sky release must not launch inertia`);
      await page.mouse.move(sky.x, sky.y);
      assert.deepEqual(await cameraPose(page, planet.id), crossed,
        `${planet.id}: released sky input must not turn hover into drag`);
      // Navigation markers rotate across the sky during the preceding drag.
      // Recheck the retained picker's hover result before testing a
      // deliberately empty-sky double click.
      const clickSky = await emptySkyPoint(page, planet.id, profile.inputSelector, sky, cameraPlan);
      // Empty sky must neither deselect the body nor start a surface flight.
      await page.evaluate(() => {
        window.__skyBoundaryDeselects = 0;
        window.__skyBoundaryDeselect = (event: Event) => { window.__skyBoundaryDeselects = (window.__skyBoundaryDeselects ?? 0) + 1; event.preventDefault(); };
        window.addEventListener('objectdeselect', window.__skyBoundaryDeselect, { capture: true });
      });
      try {
        await page.mouse.dblclick(clickSky.x, clickSky.y, { delay: 45 });
        assert.equal(await page.evaluate(() => window.__skyBoundaryDeselects ?? 0), 0,
          `${planet.id}: empty sky must not request deselection`);
        assert.deepEqual(await cameraPose(page, planet.id), crossed,
          `${planet.id}: empty sky must preserve the camera`);
        assert.equal((await motionStats(page, planet.id)).surfaceFlyTo.active, false,
          `${planet.id}: sky double-click must not launch a surface flight`);
      } finally {
        await page.evaluate(() => {
          if (window.__skyBoundaryDeselect) window.removeEventListener('objectdeselect', window.__skyBoundaryDeselect, { capture: true });
        });
      }

      await page.mouse.move(body.x, body.y);
      await page.mouse.down();
      // A prepared camera plan may opt the whole object into the screen-axis
      // tumble (Mercury's perspective dolly, `drag.model`): every press then
      // takes the screen-plane orbit mapping, the disc included.
      const bodyProjection = await page.evaluate((id: string): string => {
        const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
        if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
        return runtime.camera.stats().drag?.model === "screen-axis-tumble"
          ? "screen-plane-orbit" : "screen-space-sphere";
      }, planet.id);
      assert.equal((await motionStats(page, planet.id)).projection, bodyProjection);
      const beforeBodyDrag = await cameraPose(page, planet.id);
      await page.mouse.move(body.x + 1, body.y + 1);
      const tinyDrag = await cameraPose(page, planet.id);
      assert.notDeepEqual(tinyDrag.pose, beforeBodyDrag.pose,
        `${planet.id}: a one-pixel planet drag must still respond immediately`);
      await page.mouse.move(sky.x, sky.y);
      assert.notDeepEqual((await cameraPose(page, planet.id)).pose, tinyDrag.pose,
        `${planet.id}: a captured planet drag must continue outside the disc`);
      assert.equal((await motionStats(page, planet.id)).activeMode, "drag",
        `${planet.id}: leaving the disc must preserve drag ownership`);
      assert.equal((await motionStats(page, planet.id)).projection, bodyProjection,
        `${planet.id}: planet-start drags retain their mapping outside the disc`);
      await page.mouse.up();
      assert.equal((await motionStats(page, planet.id)).pendingPointer, false,
        `${planet.id}: releasing outside must clear pointer ownership`);
      results.push({ zoom, sky, clickSky, body, passed: true });
    }
    assert.equal(await profile.stable(page), true,
      `${planet.id}: pointer boundary checks must preserve retained nodes`);
    return results;
  } catch (error) {
    primaryFailure = error;
    throw error;
  } finally {
    try {
      await page.mouse.up();
      await restore(initial);
    } catch (cleanupFailure) {
      // Preserve the first assertion/gesture failure if navigation or teardown
      // removed its runtime; a restoration failure must not replace its stack.
      if (primaryFailure instanceof Error) (primaryFailure as Error & { cleanupFailure?: unknown }).cleanupFailure = cleanupFailure;
      else throw cleanupFailure;
    }
  }

  function restore(state: Partial<PoseState>): Promise<void> {
    return page.evaluate(({ id, state }: { readonly id: string; readonly state: Partial<PoseState> }) => {
      const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
      if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
      runtime.camera.setState(state);
    }, { id: planet.id, state });
  }
}

function cameraPose(page: Page, id: string): Promise<PoseState> {
  return page.evaluate((id: string): PoseState => {
    const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
    if (!runtime) throw new Error(`${id}: camera runtime disappeared at ${location.pathname}`);
    const state = runtime.camera.state();
    // Projected silhouette diagnostics can settle by subpixel amounts without
    // changing the camera. This check owns the released pose and zoom.
    return { pose: state.pose, pitch: state.pitch, zoom: state.zoom,
      controlPitch: state.controlPitch, controlYaw: state.controlYaw };
  }, id);
}

async function emptySkyPoint(page: Page, id: string, selector: string, preferred: Point, cameraPlan: CameraPlan): Promise<Point> {
  const result = await page.evaluate(({ id, selector, preferred, cameraPlan, baseTile }: { readonly id: string; readonly selector: string; readonly preferred: Point; readonly cameraPlan: CameraPlan; readonly baseTile: number }): { readonly inspected: readonly InspectedPoint[] } => {
    const input = document.querySelector(selector);
    const cameraElement = document.querySelector(".polycss-camera");
    if (!input || !cameraElement) throw new Error(`${id}: missing input or camera element`);
    const camera = cameraElement.getBoundingClientRect();
    const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
    if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
    const state = runtime.camera.state();
    let radius = state.silhouetteRadius;
    if (cameraPlan.projection?.model !== "css-perspective-shared-with-sky") {
      // Scale cameras do not publish silhouetteRadius. Use the same prepared
      // body/scene dimensions and live CSS optics as camera-layout.ts; the
      // camera's viewport rectangle is not the body's painted bounds.
      const style = getComputedStyle(cameraElement);
      const stageElement = document.querySelector(".planet-stage");
      if (!stageElement) throw new Error(`${id}: missing planet stage`);
      const stage = stageElement.getBoundingClientRect();
      const scales = style.scale.trim().split(/\s+/u).slice(0, 2).map(Number);
      const scale = scales.length && scales.every(value => Number.isFinite(value) && value > 0)
        ? Math.min(...scales) : Math.min(camera.width / stage.width, camera.height / stage.height);
      const perspective = Number.parseFloat(style.perspective);
      const depthRadius = cameraPlan.logicalBodyDiameter * baseTile / 2;
      radius = perspective * cameraPlan.sceneScale * scale /
        Math.sqrt((perspective / depthRadius) ** 2 - 1);
    }
    const paintedRadius = radius;
    if (typeof paintedRadius !== "number" || !Number.isFinite(paintedRadius) || paintedRadius <= 0) throw new Error(`${id}: prepared body projection is invalid (${paintedRadius})`);
    const candidates = [preferred, ...[32, 72, 120, 180].flatMap(inset =>
      [96, 150, 220, innerHeight - 96].map(y => ({ x: innerWidth - inset, y })))];
    const inspected = candidates.map(point => {
      const elements = document.elementsFromPoint(point.x, point.y);
      const outsideBody = Math.hypot(point.x - camera.x - camera.width / 2,
        point.y - camera.y - camera.height / 2) > paintedRadius + 12;
      return { point, onInput: input.contains(elements[0] ?? null), outsideBody };
    });
    return { inspected };
  }, { id, selector, preferred, cameraPlan, baseTile: BASE_TILE });
  // World targets use the retained screen-picking registry, not DOM hit boxes.
  // Exercise its real hover path so this also works against a production build.
  for (const candidate of result.inspected) {
    if (!candidate.onInput || !candidate.outsideBody) continue;
    await page.mouse.move(candidate.point.x, candidate.point.y);
    const targets = await page.evaluate(() => new Promise<string[]>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(
        [...document.querySelectorAll('.planet-stage [data-object-hovered="true"][data-object-navigate]')]
          .map(element => element instanceof HTMLElement ? element.dataset.objectNavigate : undefined)
          .filter((target): target is string => typeof target === "string"),
      )))));
    if (!targets.length) return candidate.point;
  }
  assert.fail(`${id}: no verified empty sky point: ${JSON.stringify(result.inspected)}`);
}

function motionStats(page: Page, id: string): Promise<DragInertiaStats> {
  return page.evaluate((id: string): DragInertiaStats => {
    const runtime = Reflect.get(window, `__${id}`) as ObjectRuntime | undefined;
    if (!runtime) throw new Error(`${id}: camera runtime is unavailable`);
    return runtime.camera.stats().dragInertia;
  }, id);
}

function parseCameraPlan(value: unknown, id: string): CameraPlan {
  if (typeof value !== "object" || value === null) throw new Error(`${id}: runtime.json must be an object`);
  const camera = (value as { readonly camera?: unknown }).camera;
  if (typeof camera !== "object" || camera === null) throw new Error(`${id}: runtime.json must contain camera`);
  const plan = camera as { readonly logicalBodyDiameter?: unknown; readonly sceneScale?: unknown; readonly projection?: unknown };
  if (typeof plan.logicalBodyDiameter !== "number" || !Number.isFinite(plan.logicalBodyDiameter) || plan.logicalBodyDiameter <= 0 ||
      typeof plan.sceneScale !== "number" || !Number.isFinite(plan.sceneScale) || plan.sceneScale <= 0) {
    throw new Error(`${id}: runtime.json camera dimensions must be positive finite numbers`);
  }
  const projection = plan.projection;
  if (projection !== undefined && (typeof projection !== "object" || projection === null ||
      (projection as { readonly model?: unknown }).model !== undefined && typeof (projection as { readonly model?: unknown }).model !== "string")) {
    throw new Error(`${id}: runtime.json camera projection must be an object with an optional string model`);
  }
  return { logicalBodyDiameter: plan.logicalBodyDiameter, sceneScale: plan.sceneScale,
    projection: projection as CameraPlan["projection"] };
}
