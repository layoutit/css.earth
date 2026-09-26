import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser/browser-types.mts';

/** The mobile native select forwards a choice to the same retained dataset button as desktop. */
export function bindDatasetPicker(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const change = (event: Event) => {
    if (!(event.target instanceof windowTarget.HTMLSelectElement) || !event.target.matches('[data-lens-native-select]')) return;
    const select = event.target;
    const picker = select.closest<HTMLElement>('[data-lens-picker]');
    const button = [...(picker?.querySelectorAll<HTMLButtonElement>('.object-observation-control') ?? [])]
      .find(candidate => candidate.getAttribute('value') === select.value);
    if (button && !button.disabled) button.click();
  };
  documentTarget.addEventListener('change', change);
  lifetime.onDispose(() => documentTarget.removeEventListener('change', change));
}
