/** Bundle internal TypeScript owners; native and third-party dependencies remain external. */
import { readFile, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, type BuildOptions, type Loader } from 'esbuild';
import ts from 'typescript';

const LOADERS: Record<string, Loader> = { '.ts': 'ts', '.mts': 'ts', '.cts': 'ts', '.tsx': 'tsx', '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'jsx' };

/** Replace only syntax: source text may also mention the expression inside strings, templates or regexes. */
function sourceUrls(text: string, path: string): string {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const replacements: { start: number; end: number }[] = [];
  const visit = (node: ts.Node) => {
    const expression = ts.isPropertyAccessExpression(node) && node.name.text === 'url' ? node.expression
      : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'url'
        ? node.expression : undefined;
    if (expression && ts.isMetaProperty(expression) && expression.keywordToken === ts.SyntaxKind.ImportKeyword) {
      replacements.push({ start: node.getStart(source), end: node.end });
    } else ts.forEachChild(node, visit);
  };
  visit(source);
  const url = JSON.stringify(pathToFileURL(path).href);
  for (const { start, end } of replacements.reverse()) text = text.slice(0, start) + url + text.slice(end);
  return text;
}

export async function buildLabModule(options: BuildOptions) {
  const inputs = Array.isArray(options.entryPoints)
    ? options.entryPoints.map(entry => typeof entry === 'string' ? entry : entry.in)
    : Object.values(options.entryPoints ?? {});
  const entries = new Set(await Promise.all(inputs.map(async entry => {
    const path = resolve(options.absWorkingDir ?? process.cwd(), entry);
    return options.preserveSymlinks ? path : realpath(path);
  })));
  return build({ ...options, plugins: [{
    name: 'nebula-workspace-source-owners',
    setup(builder) {
      builder.onResolve({ filter: /^@cssearth\// }, args => {
        // `@cssearth/bake`, `@cssearth/core`, `@cssearth/fits`, `@cssearth/spice` and `@cssearth/telescope` ship built JavaScript, not TypeScript owners. Node loads their ESM builds at
        // run time: inlining the CommonJS build `require.resolve` finds would leave `require('node:crypto')` in an ESM
        // bundle, which fails.
        if (/^@cssearth\/(?:bake|core|fits|spice|telescope)(?:\/|$)/.test(args.path)) return { path: args.path, external: true };
        const directory = args.resolveDir || options.absWorkingDir || process.cwd();
        const require = createRequire(resolve(directory, '__nebula_bundle__.cjs'));
        return { path: require.resolve(args.path) };
      });
    },
  }, {
    // Bundling rewrites every module's `import.meta.url` to the single output file, which breaks the
    // standard `import.meta.url === pathToFileURL(process.argv[1]).href` entry-point guard: a bundled
    // command-line module sees its own URL equal to the program being run and executes its argument
    // parser, throwing a usage error before the real entry does anything. Give each bundled module its
    // own source URL back, so only the true entry point still matches `process.argv[1]`.
    name: 'nebula-module-source-url',
    setup(builder) {
      builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async args => {
        if (entries.has(args.path)) return undefined;
        const text = await readFile(args.path, 'utf8');
        if (!text.includes('import')) return undefined;
        const extension = args.path.slice(args.path.lastIndexOf('.'));
        return { contents: sourceUrls(text, args.path),
          loader: LOADERS[extension] ?? 'ts', resolveDir: dirname(args.path) };
      });
    },
  }, ...(options.plugins ?? [])] });
}
