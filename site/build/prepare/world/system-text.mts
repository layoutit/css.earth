import { parseCitedText, readSystemText } from '@cssearth/objects';
import { sourceId, sourceObject } from '@cssearth/objects/sources';
import { textBlockBudgetErrors } from '../../../content/object-text.mts';

/** Prepare short, cited system introductions: each becomes its system object's description (system-packages.mts). */
export function prepareSystemIntroductions(input: unknown, hosts: readonly string[], catalogue: ReadonlySet<string>) {
  const blocks = readSystemText(input);
  for (const id of Object.keys(blocks)) if (!hosts.includes(id)) throw new TypeError(`System text names unavailable satellite host ${id}.`);
  return Object.fromEntries(hosts.map(id => {
    sourceId(id);
    const block = parseCitedText(blocks[id], `${id} system introduction`);
    const errors = textBlockBudgetErrors(id, 'introduction', block.text);
    if (errors.length) throw new TypeError(errors.map(error => `${id}: ${error.detail}`).join('\n'));
    for (const source of block.sources) if (!catalogue.has(source.catalogueId)) throw new TypeError(`${id}: unknown source ${source.catalogueId}.`);
    return [id, block.text];
  }));
}
