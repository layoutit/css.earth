import { parseHTML } from 'linkedom';
import type { CatalogueRow } from '../search/catalogue-index.mts';
import { createObjectResultView, bindObjectResultView } from '../search/object-result.mts';

/** Server cards use the live search row component; the DOM writer escapes names and attributes. */
export function objectResultMarkup(row: CatalogueRow): string {
  const { document } = parseHTML('<html><body></body></html>');
  const view = createObjectResultView(document);
  bindObjectResultView(document, view, row, null);
  return view.anchor.outerHTML;
}
