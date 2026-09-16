import type { Page } from 'playwright';

/** Select through the actual searchable object control, preserving its keyboard/pointer lifecycle. */
export async function chooseLabObject(page: Page, id: string): Promise<void> {
  await page.locator('#subject').fill(id);
  await page.getByRole('listbox', { name: 'Objects' }).locator(`[data-object-id="${id}"]`).click();
  await page.waitForFunction(expected => document.querySelector('#subject')?.getAttribute('data-object-id') === expected, id);
}
