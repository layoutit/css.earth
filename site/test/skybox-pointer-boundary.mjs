import assert from "node:assert/strict";

export async function proveSkyboxPointerBoundary(page, planet, profile) {
  const initial = await cameraPose(page, planet.id);
  const bounds = await profile.bounds(page);
  const viewport = page.viewportSize();
  const sky = { x: viewport.width - 32, y: 96 };
  const results = [];
  try {
    for (const zoom of new Set([
      initial.zoom,
      Math.max(bounds.minimumZoom, initial.zoom * 0.65),
    ])) {
      await restore({ ...initial, zoom });
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
      await page.mouse.dblclick(sky.x, sky.y, { delay: 45 });
      assert.deepEqual(await cameraPose(page, planet.id), crossed,
        `${planet.id}: sky double-click must remain inert`);
      assert.equal((await motionStats(page, planet.id)).surfaceFlyTo.active, false,
        `${planet.id}: sky double-click must not launch fly-to`);

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
      results.push({ zoom, sky, body, passed: true });
    }
    assert.equal(await profile.stable(page), true,
      `${planet.id}: pointer boundary checks must preserve retained nodes`);
    return results;
  } finally {
    await page.mouse.up();
    await restore(initial);
  }

  function restore(state) {
    return page.evaluate(({ id, state }) =>
      window[`__${id}`].camera.setState(state), { id: planet.id, state });
  }
}

function cameraPose(page, id) {
  return page.evaluate(id => {
    const state = window[`__${id}`].camera.state();
    return { ...state, pose: state.pose };
  }, id);
}

function motionStats(page, id) {
  return page.evaluate(id => window[`__${id}`].camera.stats().dragInertia, id);
}
