import { parseHTML } from 'linkedom';
import type { ObjectResultEntry } from '../search/object-result.mts';
import { createObjectResultView, bindObjectResultView } from '../search/object-result.mts';

/** Server cards use the live search row component; the DOM writer escapes names and attributes. */
export function objectResultMarkup(row: ObjectResultEntry): string {
  const { document } = parseHTML('<html><body></body></html>');
  const view = createObjectResultView(document);
  bindObjectResultView(document, view, row, null);
  return view.anchor.outerHTML;
}
