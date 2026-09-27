/** The ESO archive's calibration association trees (calselector, mode Raw2Raw): the tree ESO's own processing uses for a raw
 * science frame, fetched once and kept beside the reduction. The reductions that walk these trees stay with their
 * instruments (`packages/telescope-cli/src/archives/interferometry/eso-associations.mts`). */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface AssociationFile { readonly category: string; readonly name: string }
export interface Association {
  readonly category: string;
  readonly files: readonly AssociationFile[];
  readonly children: readonly Association[];
  readonly messages: readonly string[];
}

const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([a-zA-Z_]+)="([^"]*)"/gu)]
  .map(([, name, value]) => [name!, value!.replace(/&(amp|lt|gt|quot|apos);/gu, (_, entity: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]!)]));

/** The calselector's XML (mode Raw2Raw) as a tree. */
export function parseAssociationTree(xml: string): Association {
  interface Building { category: string; files: AssociationFile[]; children: Association[]; messages: string[] }
  const stack: Building[] = [];
  let root: Association | undefined;
  for (const [tag] of xml.matchAll(/<\/?(?:association|file|message)\b[^>]*>/gu)) {
    if (tag.startsWith('</association')) {
      const done = stack.pop();
      if (!done) throw new TypeError('The association tree closes an association it never opened.');
      if (stack.length) stack.at(-1)!.children.push(done); else root = done;
    } else if (tag.startsWith('<association')) {
      const { category } = attributes(tag);
      if (!category) throw new TypeError('An association has no category.');
      const node: Building = { category, files: [], children: [], messages: [] };
      if (tag.endsWith('/>')) { if (stack.length) stack.at(-1)!.children.push(node); else root = node; } else stack.push(node);
    } else if (tag.startsWith('<file')) {
      const { category, name } = attributes(tag);
      if (!category || !name || !stack.length) throw new TypeError('A file in the association tree has no category, name or association.');
      stack.at(-1)!.files.push({ category, name });
    } else if (tag.startsWith('<message') && stack.length) stack.at(-1)!.messages.push(attributes(tag).text ?? '');
  }
  if (!root || stack.length) throw new TypeError('The association tree is incomplete.');
  return root;
}

const exists = (path: string) => access(path).then(() => true, () => false);

/** The association tree of a raw science frame, kept beside the reduction and read from there when present. */
export async function associationTree(dpId: string, directory: string) {
  const path = resolve(directory, `${dpId}.associations.xml`);
  if (!await exists(path)) {
    const response = await fetch(`https://archive.eso.org/calselector/v1/associations?dp_id=${encodeURIComponent(dpId)}&mode=Raw2Raw`);
    if (!response.ok) throw new Error(`${dpId}: the ESO calselector answered ${response.status}.`);
    await mkdir(directory, { recursive: true });
    await writeFile(path, await response.text());
  }
  return parseAssociationTree(await readFile(path, 'utf8'));
}
