/** The archive clients, reducers and ledger builders are generic: which shipped bodies a ledger names or searches by name is data
 * beside that archive's programs or code (`src/archives/<archive>/`, or `tools/objects/<archive>/` until it moves), never a string or key
 * in this package's code.
 *
 * This is a heuristic scan, not a proof. It catches a shipped id written as a whole string or template segment, as any word of
 * one (paths, queries, space-separated lists, sentences), as the leading parts of a hyphenated word (a program id built on a
 * body id, `comet-1p-nnsn1121`) and as a property key, quoted or not, in any case. It does not catch a
 * name it cannot see as one id: a multi-word spelling ('WASP-43 b', 'Alpha Centauri A'), a name built from pieces, or one read
 * from anywhere but this package's code. The exemptions below are holes by design: an exact listed string (a label, a guide
 * sentence) may name its listed ids, and a listed field is exempt on its owning type. Every exemption names one module and an
 * exact site, never a word or a whole module. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { WORKSPACE } from '@cssearth/telescope/node';
// Plain node:test, not sourceTest: the scan reads only tracked code and body directory names, and an offender quoting an
// unrestored-input message ("is not restored", "not installed") must fail rather than turn the guard into a skip.

/** Ledger and program field names that are ordinary words and also a shipped id, by module, owning type and exact spelling. The
 * exemption covers only that type's member and the properties of an object literal written as that type (a `: Type` variable,
 * `satisfies Type` or `as Type`, `Omit<Type, …>` included), quoted or not; any other key with the same spelling still counts.
 * A Gemini Galilean row's `moon` is the member of the focus group it describes and is part of the published ledger; an HST
 * slit-scan program's Horizons `sun` is the illumination source it queries and is part of its program files. A TSO program's `S2`
 * is Eureka!'s Stage 2 control file. */
const FIELDS = [
  { module: 'gemini/archive-ledger.mts', owner: 'MoonRow', field: 'moon' },
  { module: 'hst/slit-scan-reduction.mts', owner: 'ScanHorizons', field: 'sun' },
  // Eureka!'s Stage 2, not the star S2 around Sgr A*.
  { module: 'jwst/reduce-tso.mts', owner: 'TsoStages', field: 'S2' },
] as const;

/** Strings that must keep a word that is also a shipped id, by module and the SHA-256 of their exact text, with the ids they may
 * name: guide and ledger sentences whose rendered pages stay byte-identical, embedded Python and shell whose `astropy.io` or
 * `echo` is a library or command, and validation labels. Any edit to one of these strings makes it an offender again, to be
 * reworded or re-listed here on review. A failure prints the hash to list. */
const PROSE: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  'hst/psf-subtract.mts': {
    '8646bcc0f333d7602647557c35e15e54a1d4245fd657d0dbeaa5f25b6526f7ca': ['io'], // embedded Python: astropy.io
  },
  'hst/slit-scan-reduction.mts': {
    '05fa21e09706e69d7f4c08c00195a0572f739cf0aae6d696b59809141b7d2054': ['iau'], // IAU pole model error
    '52110340b309d27b371e2118a5391c33714c30986c43ca98c318fdbffc13c59b': ['iau'], // IAU text PCK error
    '27756f050e14a1cb1c1ee867f0eace9ea4d9fcb81b8bee089469f1ebd5fd7b17': ['sun'], // label of the listed sun field
    'b8f25eea06888a43abc51e80dcc8ce0d98b5051d7911f69e2ec3d417dc3d41a0': ['iau'], // IAU text PCK kind
  },
  // The Juno archive and spacecraft share their name with the shipped asteroid 3 Juno: the archive's own paths, PDS volume root,
  // telescope name and software name say Juno the mission, never the body.
  'programs.mts': {
    'a50128d59f482a86171394eb7a2d1824df7c5d2788c4b2cbc5600ead757d5fd9': ['juno'], // the Juno archive's name among the moved archives
  },
  'juno/archive-ledger.mts': {
    '98f745235ce9487aa372dfaa14986b354fb0dd51c87f95b29907f6ca79243846': ['juno'], // guide: generator and ledger paths
    '37538b827ce5e37bb4a50e809be2bc580d498b767f11d46ce867f907ffbd7687': ['juno'], // ledger path
  },
  'juno/archive.mts': {
    '8779ece9a511118801da540fa3fe5c241828d6b4e47f333f0d3c5e9b5efb2366': ['juno'], // PDS Juno volume root
    'a50128d59f482a86171394eb7a2d1824df7c5d2788c4b2cbc5600ead757d5fd9': ['juno'], // kernel bank name; the archive whose programs are read
  },
  'juno/measure.mts': {
    '8182e3e46af5bec6923f830ea7dde2dd8de3ada47d1f281bc71fbe7ea53689c4': ['juno'], // own path in the software digest
    '3fb4f0d862fc834c40047a55fbec0ea51727e76098a8731c12773cfdc687216f': ['juno'], // software name: the identity serialized before the archive code moved into telescope-cli
    'cf9e8f8db24f2351753dd8d80e4c4539e4050200a1d1a8938722461398795550': ['juno'], // telescope name in the run record
    'eeabb1dfd902a7cf9589c0444975cf6d854087892b7a1ea01d2cba5e2d7940ca': ['iau'], // registration evidence sentence
    'e4509b9c4276b29c88026803aebd246deed1f67bc8cebc81be89d6c42f1fcc0a': ['iau'], // IAU ellipsoid note
  },
  'jwst/archive-ledger.mts': {
    '2b4a091e57bb97d1a7edc9c1abf91ea5a805b1a29e1dd176e88d6c79c94c497a': ['wasp-43b'], // JWST mode note
    '0e704283fd4c2bbf17b75c4c86a877351b2baa2586a408743182a86403fe5e21': ['titan', 'dione', 'moon'], // JWST guide Limits section
  },
  'jwst/cubes/resolution.mts': {
    '1275407a168186eb06f2c2e01691c7e95e64f71432af826dc1573b9c352cbfd2': ['io'], // embedded Python: astropy.io
  },
  'jwst/reduce-tso.mts': {
    'c691872b67f8b477cdb190755893bc05fc43ed576c95f982e5c74ac5eb1e6151': ['s2'], // Eureka! Stage 2 control-file name prefix
  },
  'jwst/klip/reduce.mts': {
    '416de16796d0c31e2c06658650ef3f2c69405a8e715a7f7c982dbaedbc078ca9': ['io'], // embedded Python: astropy.io
  },
  'keck/archive-ledger.mts': {
    '5de35bbd375443423707ac3b0af67a9a683cab4e6038063beabe578b6061721d': ['deimos'], // Keck DEIMOS mode note
    '1f33c91a00ac4b5761214ebf355bd44ae6cc9623ed7d6380eaa65cdff2714f37': ['europa'], // Keck KAI mode note
    '30686de0921e90806621285fa12b71191a8a7007d92b802e41d47d7e6cca93cc': ['europa'], // Keck PypeIt mode note
    'dded7cf84427d4316ea0275a49bca5c58626da20adfb67eea01f4021a8a0ceda': ['europa', 'jupiter', 'moon'], // Keck guide: minor-planet numbers
  },
  'naco/archive-ledger.mts': {
    'd3a9ab20cd633d0085b52f932da8f065fec7ea5c4120dad44d39510bca202998': ['europa'], // NACO guide intro
  },
  // The Julia language's release folder, not the asteroid 89 Julia.
  'interferometry/toolchain.mts': {
    '7acbee0363ed16c1c8c7e89de22fc4395b1bf500ebced48c6dc4db65123b4666': ['julia'], // the unpacked Julia 1.12.7 release
  },
  'naco/reduce.mts': {
    '87a51fb9103ac436a51201277d7a04ee0d06bd87717a7adbe09edc55b39fbd27': ['echo'], // shell echo
  },
};

/** Every leading run of a hyphenated word's parts: a program id built on a body id (`comet-1p-nnsn1121`) names that body. */
const hyphenPrefixes = (word: string) => word.split('-').slice(1).map((_, index, rest) => word.split('-').slice(0, index + 1).join('-'))
  .filter(prefix => prefix.length > 0 && prefix !== word);
const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/gu, '');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const PROPERTY_NAMES = [ts.isPropertyAssignment, ts.isShorthandPropertyAssignment, ts.isPropertySignature, ts.isPropertyDeclaration,
  ts.isMethodDeclaration, ts.isEnumMember, ts.isGetAccessor, ts.isSetAccessor] as const;

/** Whether a type annotation refers to `owner` (`MoonRow`, `Omit<MoonRow, 'frames'>`, `readonly MoonRow[]`). */
function mentionsType(type: ts.TypeNode | undefined, owner: string): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeName.text === owner) found = true;
    ts.forEachChild(node, visit);
  };
  if (type) visit(type);
  return found;
}

/** The type a property's name belongs to, written in the code: the interface or type alias that declares it, or the annotation an
 * object literal holding it is written as. */
function isMemberOf(property: ts.Node, owner: string): boolean {
  const holder = property.parent;
  if (ts.isInterfaceDeclaration(holder)) return holder.name.text === owner;
  if (ts.isTypeLiteralNode(holder)) return ts.isTypeAliasDeclaration(holder.parent) && holder.parent.name.text === owner;
  if (!ts.isObjectLiteralExpression(holder)) return false;
  let expression: ts.Node = holder.parent;
  while (ts.isParenthesizedExpression(expression)) expression = expression.parent;
  if (ts.isSatisfiesExpression(expression) || ts.isAsExpression(expression)) return mentionsType(expression.type, owner);
  return ts.isVariableDeclaration(expression) && mentionsType(expression.type, owner);
}

/** Every shipped id a module's code names, in any case: as a whole string literal or template-literal segment, as any word of one
 * (a path, a query, a list split on spaces, a sentence), or as a property key, quoted or not (`MERCURY:`, `{ europa }`,
 * `'io':`). A URL's host is a site, not a name. Comments are not code. */
function bodyMentions(file: string, text: string, bodies: ReadonlySet<string>): string[] {
  const byCompact = new Map([...bodies].map(id => [compact(id), id]));
  const exemptField = (name: ts.Node, spelling: string) => PROPERTY_NAMES.some(is => is(name.parent)) && (name.parent as ts.NamedDeclaration).name === name
    && FIELDS.some(entry => entry.module === file && entry.field === spelling && isMemberOf(name.parent, entry.owner));
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const lower = node.text.trim().toLowerCase();
      const unhosted = lower.replace(/\b[a-z][a-z0-9+.-]*:\/\/[^/?#\s]*/gu, ' ');
      const words = [lower, ...unhosted.split(/[^a-z0-9_-]+/u).map(part => part.replace(/^[_-]+|[_-]+$/gu, ''))];
      const named = [...new Set(words.flatMap(word => [word, ...hyphenPrefixes(word)]).filter(word => bodies.has(word)))];
      const allowed = PROSE[file]?.[sha256(node.text)] ?? [];
      const keyExempt = ts.isStringLiteral(node) && exemptField(node, node.text);
      for (const id of named) if (!allowed.includes(id) && !keyExempt) found.push(`${file}: ${JSON.stringify(node.text)} (${sha256(node.text)}) names ${id}`);
    } else if (ts.isIdentifier(node) && PROPERTY_NAMES.some(is => is(node.parent)) && (node.parent as ts.NamedDeclaration).name === node) {
      const id = byCompact.get(compact(node.text));
      if (id && !exemptField(node, node.text)) found.push(`${file}: key ${node.text} names ${id}`);
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

test('the scope scan catches a body in every place code can name it, and nothing in comments', () => {
  const bodies = new Set(['io', 'europa', 'mercury', 'callisto', 'ganymede', 'alpha-centauri-a', 'moon']);
  const scan = (text: string, file = 'fixture.mts') => bodyMentions(file, text, bodies);
  assert.equal(scan("const scope = ['io', 'EUROPA'];").length, 2, 'quoted strings in any case');
  assert.equal(scan('const table = { europa: 1 };').length, 1, 'an unquoted object key');
  assert.equal(scan("const table = { 'Europa': 1, \"io\": 2 };").length, 2, 'a quoted object key');
  assert.equal(scan('const table = { MERCURY: 199, Callisto: 504 };').length, 2, 'identifier keys in any case');
  assert.equal(scan('const europa = 1; const table = { europa };').length, 1, 'a shorthand key');
  assert.equal(scan('interface Row { readonly AlphaCentauriA: number }').length, 1, 'a key that spells a hyphenated id');
  assert.equal(scan('const name = `${prefix}Europa`; const other = `${a} GANYMEDE ${b}`;').length, 2, 'template-literal segments');
  assert.equal(scan("const path = 'src/objects/europa/prepared'; const flag = `--callisto=${x}`;").length, 2, 'a part of a string with no spaces');
  assert.equal(scan("const cite = 'https://jwst-pipeline.readthedocs.io/en/latest'; const map = 'https://example.org/europa/map.fits';").length, 1,
    'a URL host is not a name, and a body in its path is');
  assert.equal(scan("const adql = \"SELECT * FROM ivoa.obscore WHERE target_name='europa'\";").length, 1, 'a word of an ADQL string');
  assert.equal(scan('const query = `SELECT obs_id FROM caom2.Observation WHERE target_name = ${quote} AND o.instrument_name LIKE \'%\' OR target_name = \'Ganymede\'`;').length, 1,
    'a word of a template query');
  assert.equal(scan("const targets = 'io europa ganymede'.split(' ');").length, 3, 'each word of a space-separated list');
  assert.equal(scan("const program = 'europa-1250'; const pair = 'alpha-centauri-a-b1';").length, 2, 'a program id built on a body id');
  assert.equal(scan("const model = 'ionosphere-model'; const kind = 'moonlight-io2';").length, 0, 'a body id is a whole hyphen-separated part, not any substring');
  assert.equal(scan("const note = 'Europa is an example here';").length, 1, 'a sentence is read word by word');
  assert.equal(scan("// 'callisto'\n/* { europa: 1 } */ const row = { moon: 'x' };").length, 1, 'comments are not names; an ordinary field is one');
});

test('an exemption covers only the listed field of its owning type, or the exact listed string', () => {
  const bodies = new Set(['moon', 'europa', 'sun']);
  const scan = (file: string, text: string) => bodyMentions(file, text, bodies);
  const gemini = 'gemini/archive-ledger.mts';
  assert.deepEqual(scan(gemini, [
    'interface MoonRow { readonly moon: string; readonly "moon2": string }', "type Other = { moon: string };",
    "const a: MoonRow = { moon: 'x' }; const b = { 'moon': 'y' } satisfies Omit<MoonRow, 'frames'>; const c = ({ moon } as MoonRow);",
    "const table = { moon: '301' }; const quoted = { 'moon': '301' }; const loose: Record<string, string> = { moon: 'x' };",
    "const value = { id: 'moon' } satisfies MoonRow; const upper: MoonRow = { MOON: 'x' };",
  ].join('\n')), [
    `${gemini}: key moon names moon`, `${gemini}: key moon names moon`, `${gemini}: "moon" (${createHash('sha256').update('moon').digest('hex')}) names moon`,
    `${gemini}: key moon names moon`, `${gemini}: "moon" (${createHash('sha256').update('moon').digest('hex')}) names moon`, `${gemini}: key MOON names moon`,
  ], 'the MoonRow member and MoonRow-typed literals only; another type, an untyped table, a value and another spelling still count');
  assert.equal(scan('keck/other.mts', 'interface MoonRow { readonly moon: string }').length, 1, 'only in the listed module');
  assert.equal(scan('hst/slit-scan-reduction.mts', "requireString(row.sun, 'sun'); requireString(row.sun, 'Sun');").length, 1,
    'a listed string is exempt byte for byte, and only that string');
  assert.equal(scan('keck/archive-ledger.mts', "const s = 'carrying the same number, so 52 Europa is not Jupiter\\'s moon.';").length, 0,
    'a listed sentence may name its listed ids');
  assert.equal(scan('keck/archive-ledger.mts', "const s = 'carrying the same number, so 52 Europa is not Jupiter\\'s moon!';").length, 2,
    'an edited sentence is an offender again');
});
