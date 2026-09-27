/** Imports that dependency-cruiser cannot see: `.astro` frontmatter and client scripts.
 *
 * dependency-cruiser has no `.astro` transpiler, so without this the graph misses every import made
 * only by an Astro component (item K listed 11 such files). The scanner reads the frontmatter and each
 * bundled `<script>` with the TypeScript parser; `graph.mts` resolves each specifier with the cruise's own
 * resolver (`resolver.mts`). Only specifiers that name a repository file become edges; npm packages and
 * `astro:*` virtual modules are external.
 *
 * Computed specifiers are out of reach here and in the cruise: `import(name)`, a template literal with an expression
 * (`import(\`${directory}/x.mts\`)`) and `import(new URL('…', import.meta.url).href)` name no file until they run, so
 * they add no edge. The nebula-boundaries rule (`nebula-inbound.mts`) resolves constant ones for the lab and bake
 * boundaries, and flags the rest where they could reach those packages. */
import ts from 'typescript';

export interface AstroSpecifier { readonly specifier: string; readonly typeOnly: boolean; readonly symbols: readonly string[] }

/** The frontmatter block and every bundled script (not `is:inline`, not a non-module `type`). */
export function astroScriptBlocks(source: string): string[] {
  const blocks: string[] = [];
  const frontmatter = /^\s*---\r?\n([\s\S]*?)\r?\n---/u.exec(source);
  if (frontmatter?.[1] !== undefined) blocks.push(frontmatter[1]);
  for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gu)) {
    const attributes = match[1] ?? '', body = match[2] ?? '';
    if (/\bis:inline\b/u.test(attributes)) continue;
    const type = /\btype\s*=\s*["']([^"']*)["']/u.exec(attributes)?.[1];
    if (type !== undefined && type !== 'module') continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/u.exec(attributes)?.[1];
    blocks.push(src === undefined ? body : `import ${JSON.stringify(src)};`);
  }
  return blocks;
}

/** Static and dynamic import specifiers in one TypeScript block, with the names each one pulls in. */
export function moduleSpecifiers(text: string, fileName = 'module.ts'): AstroSpecifier[] {
  const tree = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, /x$/u.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: AstroSpecifier[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = ts.isImportDeclaration(node) ? node.importClause : undefined;
      const bindings = clause?.namedBindings ?? (ts.isExportDeclaration(node) ? node.exportClause : undefined);
      const symbols: string[] = [];
      if (clause?.name) symbols.push('default');
      if (bindings && (ts.isNamespaceImport(bindings) || ts.isNamespaceExport(bindings))) symbols.push('*');
      else if (bindings) for (const element of bindings.elements) symbols.push((element.propertyName ?? element.name).text);
      if (ts.isExportDeclaration(node) && !node.exportClause) symbols.push('*');
      const elementsTypeOnly = bindings !== undefined && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
        && bindings.elements.length > 0 && bindings.elements.every(element => element.isTypeOnly) && !clause?.name;
      const typeOnly = Boolean(clause?.isTypeOnly) || (ts.isExportDeclaration(node) && node.isTypeOnly) || elementsTypeOnly;
      found.push({ specifier: node.moduleSpecifier.text, typeOnly, symbols });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      // A quoted or a no-expression template literal (`import(\`./x.mts\`)`), as dependency-cruiser reads it in .ts files.
      found.push({ specifier: node.arguments[0].text, typeOnly: false, symbols: ['(dynamic)'] });
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      // `typeof import('…')` and `import('…').Name`: a type-level import with no import declaration.
      const qualifier = node.qualifier === undefined ? '*' : ts.isIdentifier(node.qualifier) ? node.qualifier.text : node.qualifier.getText().split('.')[0] ?? '*';
      found.push({ specifier: node.argument.literal.text, typeOnly: true, symbols: [qualifier] });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

export function astroSpecifiers(source: string, fileName: string): AstroSpecifier[] {
  return astroScriptBlocks(source).flatMap(block => moduleSpecifiers(block, `${fileName}.ts`));
}
