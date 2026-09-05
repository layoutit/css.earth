import assert from "node:assert/strict";
import { PLANET_SPEED_STATES } from "../src/platform/planet-feature-controls.mjs";

// Cases come from the actual package controls and browser profile. A fresh
// context per case preserves defaults and finite lazy-mount behavior.
export function runtimeAuditPoses(profile) {
  const poses = [];
  for (const { id } of profile.objectControls.lenses?.controls ?? []) {
    poses.push({ id: `lens-${id}`, async apply(page) {
      await profile.selectLens(page, id);
      assert.equal((await profile.lens(page)).id, id);
      assert.equal(await profile.visibleLens(page), id);
      return { lens: id };
    } });
  }
  for (const control of profile.objectControls.settings?.controls ?? []) {
    if (control.kind === "toggle") poses.push({ id: `toggle-${control.name}`, async apply(page) {
      const input = page.locator(`.planet-settings input[name="${control.name}"]`);
      await input.evaluate((node) => node.click());
      await page.waitForLoadState("networkidle");
      return { name: control.name, checked: await input.isChecked() };
    } });
    if (control.kind === "cycle") {
      // The actual common speed cycle has five states; sample every rate.
      for (let clicks = 1; clicks <= 5; clicks++) poses.push({
        id: `cycle-${control.name}-${clicks}`, async apply(page) {
          const button = page.locator(`.planet-settings button[name="${control.name}"]`);
          if (await button.count()) {
            for (let index = 0; index < clicks; index++) await button.evaluate((node) => node.click());
            return { name: control.name, state: await button.getAttribute("data-state") };
          }
          const input = page.locator(`.planet-settings input[name="${control.name}"][type="range"]`);
          const value = await input.evaluate((node, count) => {
            const min = Number(node.min), max = Number(node.max), step = Number(node.step);
            const states = (max - min) / step + 1;
            if (states !== 5) throw new Error("The actual prepared speed range must have five states.");
            node.value = String(min + (((Number(node.value) - min) / step + count) % states) * step);
            node.dispatchEvent(new Event("input", { bubbles: true }));
            return Number(node.value);
          }, clicks);
          const state = (control.states ?? PLANET_SPEED_STATES).find(state => state.value === value);
          assert.ok(state, "The supplied control content must declare the selected rate.");
          await page.waitForFunction(({ name, label }) =>
            document.querySelector(`.planet-settings input[name="${name}"][type="range"]`)?.dataset.state === label,
          { name: control.name, label: state.label });
          return { name: control.name, state: await input.getAttribute("data-state"), value };
        },
      });
    }
  }
  for (const mode of ["rotated", "minimum", "maximum"]) poses.push({
    id: `camera-${mode}`, async apply(page) {
      const initial = await profile.camera(page), bounds = await profile.bounds(page);
      const state = mode === "rotated" ? { ...initial, pitch: initial.pitch + 80 }
        : { ...initial, zoom: bounds[`${mode}Zoom`] };
      await profile.setCamera(page, state);
      return { mode, camera: await profile.camera(page) };
    },
  });
  for (const gesture of ["drag", "wheel"]) poses.push({
    id: `input-${gesture}-restored`, async apply(page) {
      const before = await page.evaluate((id) => ({
        camera: window[`__${id}`].camera.state(),
        matrix: getComputedStyle(document.querySelector(".polycss-scene")).transform,
      }), profile.id);
      const box = await page.locator(".polycss-camera").boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      if (gesture === "drag") {
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 50, { steps: 12 });
        await page.mouse.up();
        await page.mouse.down();
        await page.mouse.up();
      } else {
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(600);
      }
      const after = await page.evaluate((id) => ({
        camera: window[`__${id}`].camera.state(),
        matrix: getComputedStyle(document.querySelector(".polycss-scene")).transform,
      }), profile.id);
      if (gesture === "drag") assert.notEqual(before.matrix, after.matrix);
      else assert.ok(after.camera.zoom > before.camera.zoom);
      await page.evaluate(({ id, state, evidence }) => {
        window.__runtimeAuditInput = evidence;
        window[`__${id}`].camera.setState(state);
      }, { id: profile.id, state: before.camera, evidence: { gesture, before, after } });
      return { gesture, restored: before.camera };
    },
  });
  return poses;
}
