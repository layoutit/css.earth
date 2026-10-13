/** Read explicit inlining from the exported tsup config without executing build code. Unknown expressions fail closed. */
import ts from 'typescript';

type Match = (specifier: string) => boolean;
const never: Match = () => false;
const property = (node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined => {
  const found = node.properties.find(item => ts.isPropertyAssignment(item)
    && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name);
  return found && ts.isPropertyAssignment(found) ? found.initializer : undefined;
};
function matches(node: ts.Expression | undefined): Match | undefined {
  if (!node) return never;
  if (!ts.isArrayLiteralExpression(node)) return undefined;
  const rules: Match[] = [];
  for (const element of node.elements) {
    if (ts.isStringLiteral(element)) rules.push(value => value === element.text || value.startsWith(`${element.text}/`));
    else if (ts.isRegularExpressionLiteral(element)) {
      const end = element.text.lastIndexOf('/');
      // tsup's matcher uses RegExp.test without resetting state; g/y cannot guarantee every import is inlined.
      if (/[gy]/u.test(element.text.slice(end + 1))) return undefined;
      const pattern = new RegExp(element.text.slice(1, end), element.text.slice(end + 1));
      rules.push(value => { pattern.lastIndex = 0; return pattern.test(value); });
    } else return undefined;
  }
  return value => rules.some(rule => rule(value));
}
function object(node: ts.Expression | undefined): ts.ObjectLiteralExpression | undefined {
  if (!node) return undefined;
  if (ts.isObjectLiteralExpression(node)) return node;
  if (ts.isParenthesizedExpression(node)) return object(node.expression);
  // Conditional declaration generation (e.g. SKIP_DECLARATIONS !== '1' && {...}) still names its resolution policy.
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return object(node.right);
  return undefined;
}
export function tsupBundles(text: string): Match {
  const source = ts.createSourceFile('tsup.config.ts', text, ts.ScriptTarget.Latest, true);
  const exported = source.statements.find(ts.isExportAssignment);
  if (!exported || exported.isExportEquals) return never;
  const expression = exported.expression;
  const config = object(ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'defineConfig' ? expression.arguments[0] : expression);
  if (!config || config.properties.some(ts.isSpreadAssignment)) return never;
  const bundle = property(config, 'bundle');
  if (bundle && bundle.kind !== ts.SyntaxKind.TrueKeyword) return never;
  const inline = matches(property(config, 'noExternal')), external = matches(property(config, 'external'));
  const dts = property(config, 'dts');
  const declarations = dts === undefined || dts.kind === ts.SyntaxKind.FalseKeyword ? undefined : object(dts);
  if (declarations?.properties.some(ts.isSpreadAssignment)) return never;
  const resolve = declarations ? matches(property(declarations, 'resolve')) : never;
  if (!inline || !external || !resolve) return never;
  return value => inline(value) && !external(value) && (dts === undefined || dts.kind === ts.SyntaxKind.FalseKeyword || resolve(value));
}
