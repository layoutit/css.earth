import type { SceneLifetime } from '@cssearth/engine';
import { sectionElements, showSection } from '@cssearth/renderer';
import type { BrowserWindow } from '../browser/browser-types.mts';

import { NARROW_LAYOUT } from '../browser/narrow-layout.mts';

/** The mobile native select forwards a choice to the same retained dataset button as desktop. */
export function bindDatasetPicker(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const change = (event: Event) => {
    if (!(event.target instanceof windowTarget.HTMLSelectElement) || !event.target.matches('[data-dataset-native-select]')) return;
    const select = event.target;
    const picker = select.closest<HTMLElement>('[data-dataset-picker]');
    // On a narrow screen the rows wait off the page (mountDatasetPickerLayout); their buttons still take the click.
    const button = (picker ? sectionElements<HTMLButtonElement>(picker, '.object-observation-control') : [])
      .find(candidate => candidate.getAttribute('value') === select.value);
    if (button && !button.disabled) button.click();
  };
  documentTarget.addEventListener('change', change);
  lifetime.onDispose(() => documentTarget.removeEventListener('change', change));
}

/** Mount only the picker layout the screen shows: the rows, or the select with its preview. The server renders both. */
export function mountDatasetPickerLayout(root: ParentNode, windowTarget: BrowserWindow) {
  // Phones and portrait tablets pick from a native select; wider screens from its rows.
  const query = windowTarget.matchMedia(NARROW_LAYOUT);
  const apply = (narrow: boolean) => {
    for (const picker of sectionElements(root, '[data-dataset-picker]')) {
      for (const display of sectionElements(picker, '.object-dataset-picker-display')) showSection(display, narrow);
      for (const rows of sectionElements(picker, '.object-observation-controls')) showSection(rows, !narrow);
    }
  };
  const change = () => apply(query.matches);
  change();
  query.addEventListener('change', change);
  return { destroy() { query.removeEventListener('change', change); } };
}
