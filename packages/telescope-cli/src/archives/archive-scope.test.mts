/** The archive clients, reducers and ledger builders are generic: which shipped bodies a ledger names or searches by name is data
 * beside that archive's programs in the checkout (`tools/objects/<archive>/`), never a string or key in this package's code. */
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
import { WORKSPACE } from '@cssearth/telescope/node';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();

/** Ledger field names that are ordinary words and also a shipped id, by the module and exact spelling that uses them: a Gemini
 * Galilean row's `moon` is the member of the focus group it describes, and the field name is part of the published ledger. An
 * HST slit-scan program's Horizons `sun` is the illumination source it queries, and the field name is part of its program files. */
const FIELD_NAMES = new Set(['gemini/archive-ledger.mts:moon', 'hst/slit-scan-reduction.mts:sun']);

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/gu, '');
const PROPERTY_NAMES = [ts.isPropertyAssignment, ts.isShorthandPropertyAssignment, ts.isPropertySignature, ts.isPropertyDeclaration,
  ts.isMethodDeclaration, ts.isEnumMember, ts.isGetAccessor, ts.isSetAccessor] as const;

/** Every shipped id a module's code names, in any case: as a whole string literal or template-literal segment, as a part of a
 * string with no spaces (a path, a query key), or as an identifier property key (`MERCURY:`, `{ europa }`). Comments are not
 * code, and prose (a string with spaces) is read only whole, so a guide sentence may mention a body as an example. */
function bodyMentions(file: string, text: string, bodies: ReadonlySet<string>): string[] {
  const byCompact = new Map([...bodies].map(id => [compact(id), id]));
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const lower = node.text.trim().toLowerCase();
      // A URL's host names a site (`readthedocs.io`), not a body; its path is read like any other string.
      const unhosted = lower.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#\s]*/u, '');
      const parts = /\s/u.test(lower) ? [lower] : [lower, ...unhosted.split(/[^a-z0-9_-]+/u).map(part => part.replace(/^[_-]+|[_-]+$/gu, ''))];
      for (const part of new Set(parts)) if (bodies.has(part)) found.push(`${file}: ${JSON.stringify(node.text)} names ${part}`);
    } else if (ts.isIdentifier(node) && PROPERTY_NAMES.some(is => is(node.parent)) && (node.parent as ts.NamedDeclaration).name === node) {
      const id = byCompact.get(compact(node.text));
      if (id && !FIELD_NAMES.has(`${file}:${node.text}`)) found.push(`${file}: key ${node.text} names ${id}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

test('no archive module names a shipped body; the bodies a ledger is about are data beside its programs', async () => {
  const bodies = new Set((await readdir(resolve(WORKSPACE, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
  const offenders: string[] = [];
  for (const entry of await readdir(import.meta.dirname, { recursive: true })) {
    if (!entry.endsWith('.mts') || entry.endsWith('.test.mts')) continue;
    offenders.push(...bodyMentions(entry, await readFile(resolve(import.meta.dirname, entry), 'utf8'), bodies));
  }
  assert.deepEqual(offenders, []);
});

test('the scope scan catches a body in every place code can name it, and nothing in comments or prose', () => {
  const bodies = new Set(['io', 'europa', 'mercury', 'callisto', 'ganymede', 'alpha-centauri-a', 'moon']);
  const scan = (text: string) => bodyMentions('fixture.mts', text, bodies);
  assert.equal(scan("const scope = ['io', 'EUROPA'];").length, 2, 'quoted strings in any case');
  assert.equal(scan('const table = { europa: 1 };').length, 1, 'an unquoted object key');
  assert.equal(scan('const table = { MERCURY: 199, Callisto: 504 };').length, 2, 'identifier keys in any case');
  assert.equal(scan('const europa = 1; const table = { europa };').length, 1, 'a shorthand key');
  assert.equal(scan('interface Row { readonly AlphaCentauriA: number }').length, 1, 'a key that spells a hyphenated id');
  assert.equal(scan('const name = `${prefix}Europa`; const other = `${a} GANYMEDE ${b}`;').length, 2, 'template-literal segments');
  assert.equal(scan("const path = 'src/objects/europa/prepared'; const flag = `--callisto=${x}`;").length, 2, 'a part of a string with no spaces');
  assert.equal(scan("const cite = 'https://jwst-pipeline.readthedocs.io/en/latest'; const map = 'https://example.org/europa/map.fits';").length, 1,
    'a URL host is not a name, and a body in its path is');
  assert.deepEqual(scan("// 'callisto'\n/* { europa: 1 } */ const note = 'Europa is an example here'; const row = { moon: 'x' };").length, 1,
    'comments and prose are not names; an ordinary field is one unless listed');
  assert.deepEqual(bodyMentions('gemini/archive-ledger.mts', "const row = { moon: 'x' }; const table = { MOON: '301' };", bodies),
    ['gemini/archive-ledger.mts: key MOON names moon'], 'a listed field name is exempt only in its module and exact spelling');
});
