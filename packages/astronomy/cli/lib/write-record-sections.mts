import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import ts from 'typescript';
import { objectValue, numberValue } from './generator-records.mts';

/** Read generated numeric literals without executing source text. */
export function literalRecords(source: string, symbol: string) {
  const ast = ts.createSourceFile('records.ts', source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.flatMap(statement => ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [])
    .find(declaration => declaration.name.getText(ast) === symbol);
  if (!declaration?.initializer) throw new Error(`Missing generated ${symbol} declaration.`);
  const literal = (node: ts.Expression): unknown => {
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression);
    if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
      if (!ts.isPropertyAssignment(property) || !('text' in property.name)) throw new TypeError('Expected a literal record property.');
      return [property.name.text, literal(property.initializer)];
    }));
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isStringLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -numberValue(literal(node.operand));
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    throw new TypeError(`Expected a numeric source record, got ${node.getText(ast)}.`);
  };
  return objectValue(literal(declaration.initializer));
}

const dataRoot = new URL('../../data/', import.meta.url);
const bodyRoot = new URL('bodies/', dataRoot), fixtureRoot = new URL('fixtures/', dataRoot);
const formatted = (id: string, value: unknown) => `  ${JSON.stringify(id)}: ${JSON.stringify(value, null, 2).replaceAll('\n', '\n  ')},`;

export function readRecordSections(_destination: URL, symbol: string) {
  const directory = symbol === 'SATELLITE_ELEMENTS' ? bodyRoot : fixtureRoot;
  const records = new Map<string, string>();
  for (const file of readdirSync(directory).sort()) {
    if (!file.endsWith('.json')) continue;
    const record = objectValue(JSON.parse(readFileSync(new URL(file, directory), 'utf8')));
    const id = file.slice(0, -5), value = symbol === 'SATELLITE_ELEMENTS' ? record.satellite : record;
    if (value) records.set(id, formatted(id, value));
  }
  return records;
}

/** Acquisition updates individual retained records; builds assemble the exports. */
export function writeRecordSections(_destination: URL, source: string, kind: 'satellites' | 'horizons') {
  const records = literalRecords(source, kind === 'satellites' ? 'SATELLITE_ELEMENTS' : 'HORIZONS');
  for (const [id, value] of Object.entries(records)) {
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(id)) throw new TypeError('Invalid source record identity.');
    const file = new URL(`${id}.json`, kind === 'satellites' ? bodyRoot : fixtureRoot);
    let previous: string | undefined;
    try { previous = readFileSync(file, 'utf8'); }
    catch (error) { if (kind === 'satellites' || !(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
    const record: unknown = kind === 'satellites' ? { ...objectValue(JSON.parse(previous ?? 'null')), satellite: value } : value;
    const text: string = JSON.stringify(record, null, 2) + '\n';
    if (text !== previous) writeFileSync(file, text);
  }
}
