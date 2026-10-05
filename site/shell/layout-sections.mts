import { sectionElements, showSection } from '@cssearth/renderer';
import { NARROW_LAYOUT } from './narrow-layout.mts';
import type { BrowserWindow } from './browser/browser-types.mts';

/** Wide layouts show the view footer (readout and sources); phones and portrait tablets hide it and show the sheet's own
 * sources link instead. Only the one the layout shows is mounted; the server renders both for a page without JavaScript. */
export function mountLayoutSections(documentTarget: Document, windowTarget: BrowserWindow, signal: AbortSignal) {
  const layout = windowTarget.matchMedia(NARROW_LAYOUT);
  const apply = () => {
    const narrow = layout.matches;
    for (const footer of sectionElements(documentTarget, '.object-footer')) showSection(footer, !narrow);
    for (const sources of sectionElements(documentTarget, '.object-sheet-sources')) showSection(sources, narrow);
  };
  apply();
  layout.addEventListener('change', apply, { signal });
}
