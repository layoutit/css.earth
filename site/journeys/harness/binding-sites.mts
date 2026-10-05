/** Port of the S0 owner/event/ordinal AST method: source line movement cannot rename a handler. */
import ts from 'typescript';
export interface ListenerWrapper { file: string; name: string; eventIndex: number }
export function parseWrappers(input: unknown): ListenerWrapper[] {
  if (!input || typeof input !== 'object' || !('wrappers' in input) || !Array.isArray(input.wrappers)) throw new Error('Expected S0 wrapper definitions');
  return input.wrappers.map((row: unknown) => {
    if (!row || typeof row !== 'object' || !('file' in row) || typeof row.file !== 'string' || !('name' in row) || typeof row.name !== 'string'
      || !('eventIndex' in row) || typeof row.eventIndex !== 'number' || !Number.isInteger(row.eventIndex) || row.eventIndex < 0) throw new Error('Invalid wrapper definition');
    return { file: row.file, name: row.name, eventIndex: row.eventIndex };
  });
}
function owner(node: ts.Node): string {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text;
    current = current.parent;
  }
  return 'module';
}
export function bindingSites(file: string, text: string, wrappers: readonly ListenerWrapper[]) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const counts = new Map<string, number>();
  const sites: { id: string; start: number; end: number; line: number; endLine: number }[] = [];
  function walk(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      let event: ts.Expression | undefined;
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'addEventListener') event = node.arguments[0];
      else {
        const name = node.expression.getText(ast), candidates = wrappers.filter(wrapper => wrapper.name === name);
        const wrapper = candidates.find(wrapper => wrapper.file === file) ?? (new Set(candidates.map(wrapper => wrapper.file)).size === 1 ? candidates[0] : undefined);
        if (wrapper) event = node.arguments[wrapper.eventIndex];
      }
      if (event) {
        const type = ts.isStringLiteralLike(event) ? event.text : `dynamic:${event.getText(ast)}`;
        const stem = `handler:${file.replace(/\.[^.]+$/u, '').replaceAll('/', ':')}:${owner(node)}:${type.replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
        const ordinal = (counts.get(stem) ?? 0) + 1; counts.set(stem, ordinal);
        sites.push({ id: `${stem}:${ordinal}`, start: node.getStart(ast), end: node.end,
          line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, endLine: ast.getLineAndCharacterOfPosition(node.end).line + 1 });
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  return { sites, offset: (line: number, column: number) => ast.getPositionOfLineAndCharacter(line - 1, column) };
}
