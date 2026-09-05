import assert from "node:assert/strict";

// Exercise real package controls and the shared decode/publication boundary.
export async function checkDirectionalAtmosphere(page, { id, phaseKey, rollKey }) {
  const original = await page.evaluate(id => {
    const api = window[`__${id}`], view = api.view();
    return { view: { controlPitch: view.controlPitch, controlYaw: view.controlYaw, zoom: view.zoom },
      shadows: document.querySelector('input[name="shadows"]').checked };
  }, id);
  const states = [];
  for (const [controlPitch, controlYaw, zoom] of [[34.23, -105, 1.1], [34.23, -15, .7],
    [34.23, 75, 1.3], [-55, 35, .9], [65, 155, 1.1]]) {
    await page.evaluate(({ id, view }) => window[`__${id}`].setView(view), { id, view: { controlPitch, controlYaw, zoom } });
    const pair = [];
    for (const shadows of [true, false]) {
      await page.locator('input[name="shadows"]').evaluate((input, shadows) => {
        if (input.checked !== shadows) input.click();
      }, shadows);
      await page.waitForFunction(id => {
        const state = window[`__${id}`].runtime.selection();
        return !state.pending && !state.loadingMaterial;
      }, id);
      const state = await page.evaluate(id => {
        const api = window[`__${id}`];
        return { material: api.material.state(), stable: api.assertStableDomIdentity(),
          pools: api.runtime.resources().pools.filter(pool => ["lighting", "atmosphere"].includes(pool.id)) };
      }, id);
      assert.equal(state.stable, true);
      for (const pool of state.pools) assert.ok(pool.nativeSlots <= 3);
      pair.push({ phase: Number(state.material[phaseKey]), roll: state.material[rollKey] });
    }
    assert.ok(Number.isFinite(pair[0].phase) && Number.isFinite(pair[0].roll));
    assert.deepEqual(pair[0], pair[1], `${id}: ground shadows must not freeze or rotate the atmosphere`);
    states.push({ controlPitch, controlYaw, zoom, ...pair[0] });
  }
  assert.ok(new Set(states.map(state => state.phase)).size >= 3);
  await page.evaluate(({ id, original }) => {
    window[`__${id}`].setView(original.view);
    const input = document.querySelector('input[name="shadows"]');
    if (input.checked !== original.shadows) input.click();
  }, { id, original });
  await page.waitForFunction(id => {
    const state = window[`__${id}`].runtime.selection(); return !state.pending && !state.loadingMaterial;
  }, id);
  return states;
}
