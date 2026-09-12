import type { Locator, Page } from 'playwright';
import { OBJECTS } from '../objects.mts';

// The planetary scale bar was retired, so the suites navigate the way a person
// does: search for the body, then open the result. The object links are plain
// in-app anchors, and the shell keeps their selected state in sync.
export function objectName(id: string): string {
  const object = OBJECTS.find(entry => entry.id === id);
  if (!object) throw new TypeError(`Unknown object: ${id}.`);
  return object.name;
}

/** Search for the body and return its visible result link. */
export async function revealObjectLink(page: Page, id: string): Promise<Locator> {
  await page.locator('.planet-sidebar-search').fill(objectName(id));
  const link = page.locator(`.planet-object-link[data-object-id="${id}"]`).first();
  await link.waitFor({ state: 'visible' });
  return link;
}

/** Open the body through its search result, exactly as a person would, then
 * leave search so an open results panel cannot move the scene being measured. */
export async function selectObject(page: Page, id: string): Promise<void> {
  await (await revealObjectLink(page, id)).click();
  await page.locator('.planet-sidebar-search').fill('');
}
