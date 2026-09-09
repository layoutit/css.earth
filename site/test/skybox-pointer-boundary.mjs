import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BASE_TILE } from "@layoutit/polycss";

export async function proveSkyboxPointerBoundary(page, planet, profile) {
  const initial = await cameraPose(page, planet.id);
  const bounds = await profile.bounds(page);
  const { camera: cameraPlan } = JSON.parse(await readFile(
    new URL(`../../src/planets/${planet.id}/prepared/runtime.json`, import.meta.url), "utf8"));
  const viewport = page.viewportSize();
  let sky = { x: viewport.width - 32, y: 96 };
  const results = [];
  let primaryFailure;
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
      assert.equal(await page.evaluate(({ sky, selector }) =>
        document.querySelector(selector).contains(
          document.elementFromPoint(sky.x, sky.y)),
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
      // Recheck beneath the transparent input using the actual picker's hit
      // criteria before testing a deliberately empty-sky double click.
      const clickSky = await emptySkyPoint(page, planet.id, profile.inputSelector, sky, cameraPlan);
      // Isolate surface picking from the shared, cancelable overview flight.
      await page.evaluate(() => {
        window.__skyBoundaryDeselects = 0;
        window.__skyBoundaryDeselect = event => { window.__skyBoundaryDeselects++; event.preventDefault(); };
        window.addEventListener('objectdeselect', window.__skyBoundaryDeselect, { capture: true });
      });
      try {
        await page.mouse.dblclick(clickSky.x, clickSky.y, { delay: 45 });
        assert.ok(await page.evaluate(() => window.__skyBoundaryDeselects > 0),
          `${planet.id}: empty sky must request shared deselection`);
        assert.deepEqual(await cameraPose(page, planet.id), crossed,
          `${planet.id}: canceled sky deselection must preserve the camera`);
        assert.equal((await motionStats(page, planet.id)).surfaceFlyTo.active, false,
          `${planet.id}: sky double-click must not launch a surface flight`);
      } finally {
        await page.evaluate(() => window.removeEventListener('objectdeselect', window.__skyBoundaryDeselect, { capture: true }));
      }

      await page.mouse.move(body.x, body.y);
      await page.mouse.down();
      // A prepared camera plan may opt the whole object into the screen-axis
      // tumble (Mercury's perspective dolly, `drag.model`): every press then
      // takes the screen-plane orbit mapping, the disc included.
      const bodyProjection = await page.evaluate((id) =>
        globalThis[`__${id}`].camera.stats().drag?.model === "screen-axis-tumble"
          ? "screen-plane-orbit" : "screen-space-sphere", planet.id);
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
      if (primaryFailure) primaryFailure.cleanupFailure = cleanupFailure;
      else throw cleanupFailure;
    }
  }

  function restore(state) {
    return page.evaluate(({ id, state }) =>
      window[`__${id}`].camera.setState(state), { id: planet.id, state });
  }
}

function cameraPose(page, id) {
  return page.evaluate(id => {
    const runtime = window[`__${id}`];
    if (!runtime) throw new Error(`${id}: camera runtime disappeared at ${location.pathname}; active object is ${window.__cssEarth?.activeObjectId}`);
    const state = runtime.camera.state();
    return { ...state, pose: state.pose };
  }, id);
}

async function emptySkyPoint(page, id, selector, preferred, cameraPlan) {
  const result = await page.evaluate(({ id, selector, preferred, cameraPlan, baseTile }) => {
    const input = document.querySelector(selector);
    const cameraElement = document.querySelector(".polycss-camera");
    const camera = cameraElement.getBoundingClientRect();
    const state = window[`__${id}`].camera.state();
    let radius = state.silhouetteRadius;
    if (cameraPlan.projection?.model !== "css-perspective-shared-with-sky") {
      // Scale cameras do not publish silhouetteRadius. Use the same prepared
      // body/scene dimensions and live CSS optics as camera-layout.ts; the
      // camera's viewport rectangle is not the body's painted bounds.
      const style = getComputedStyle(cameraElement);
      const stage = document.querySelector(".planet-stage").getBoundingClientRect();
      const scales = style.scale.trim().split(/\s+/u).slice(0, 2).map(Number);
      const scale = scales.length && scales.every(value => Number.isFinite(value) && value > 0)
        ? Math.min(...scales) : Math.min(camera.width / stage.width, camera.height / stage.height);
      const perspective = Number.parseFloat(style.perspective);
      const depthRadius = cameraPlan.logicalBodyDiameter * baseTile / 2;
      radius = perspective * cameraPlan.sceneScale * scale /
        Math.sqrt((perspective / depthRadius) ** 2 - 1);
    }
    if (!Number.isFinite(radius) || radius <= 0) throw new Error(`${id}: prepared body projection is invalid (${radius})`);
    const candidates = [preferred, ...[32, 72, 120, 180].flatMap(inset =>
      [96, 150, 220, innerHeight - 96].map(y => ({ x: innerWidth - inset, y })))];
    const inspected = candidates.map(point => {
      const elements = document.elementsFromPoint(point.x, point.y);
      const targets = elements.filter(element => element instanceof HTMLElement &&
        element.dataset.objectNavigate && element.style.pointerEvents === "auto" && element.ariaDisabled !== "true")
        .map(element => element.dataset.objectNavigate);
      const outsideBody = Math.hypot(point.x - camera.x - camera.width / 2,
        point.y - camera.y - camera.height / 2) > radius + 12;
      return { point, targets, onInput: input.contains(elements[0]), outsideBody };
    });
    return { selected: inspected.find(candidate => candidate.onInput && candidate.outsideBody && !candidate.targets.length)?.point,
      inspected };
  }, { id, selector, preferred, cameraPlan, baseTile: BASE_TILE });
  assert.ok(result.selected, `${id}: no verified empty sky point: ${JSON.stringify(result.inspected)}`);
  return result.selected;
}

function motionStats(page, id) {
  return page.evaluate(id => window[`__${id}`].camera.stats().dragInertia, id);
}
