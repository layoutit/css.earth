import type { Locator, Page } from 'playwright';
import { SCENE_OBJECTS } from '../objects.mts';

// The planetary scale bar was retired, so the suites navigate the way a person
// does: search for the body, then open the visible Atlas result. The retained
// catalogue rows are intentionally hidden while the filtered Atlas tree is
// presented, so selecting those rows would not exercise the rendered control.
export function objectName(id: string): string {
  const object = SCENE_OBJECTS.find(entry => entry.id === id);
  if (!object) throw new TypeError(`Unknown object: ${id}.`);
  return object.name;
}

/** Search for the body and return its visible result link. */
export async function revealObjectLink(page: Page, id: string): Promise<Locator> {
  await page.locator('.planet-sidebar-search').fill(objectName(id));
  const link = page.locator(`.planet-object-browser a[data-atlas-object="${id}"]:visible`).first();
  await link.waitFor({ state: 'visible' });
  return link;
}

/** Open the body through its search result, exactly as a person would, then
 * leave search so an open results panel cannot move the scene being measured. */
export async function selectObject(page: Page, id: string): Promise<void> {
  await (await revealObjectLink(page, id)).click();
  await page.locator('.planet-sidebar-search').fill('');
}
