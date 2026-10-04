#!/usr/bin/env node
/** Merge compatible imports and lift introductory blocks without sorting imports. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function cleanModule(text: string, name: string): string {
  let source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const groups = new Map<string, ts.ImportDeclaration[]>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    // Side effects and namespace declarations retain their exact position and spelling.
    if (!clause || (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) || statement.attributes) continue;
    const key = `${clause.isTypeOnly}:${statement.moduleSpecifier.text}`;
    const group = groups.get(key) ?? [];
    group.push(statement); groups.set(key, group);
  }
  const edits: { start: number; end: number; replacement: string }[] = [];
  for (const imports of groups.values()) {
    if (imports.length < 2) continue;
    const first = imports[0], members: string[] = [];
    let defaultName: string | undefined;
    for (const declaration of imports) {
      const clause = declaration.importClause!;
      if (clause.name) {
        const name = clause.name.text;
        if (!defaultName) defaultName = name;
        else if (defaultName !== name) members.push(`default as ${name}`);
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) members.push(element.getText(source));
      }
    }
    const unique = [...new Set(members)];
    // TypeScript forbids a default binding plus named bindings in one import type declaration.
    if (first.importClause!.isTypeOnly && defaultName && unique.length) {
      unique.unshift(`default as ${defaultName}`); defaultName = undefined;
    }
    const bindings = [defaultName, unique.length ? `{ ${unique.join(', ')} }` : undefined].filter(Boolean).join(', ');
    const replacement = `import ${first.importClause!.isTypeOnly ? 'type ' : ''}${bindings} from ${first.moduleSpecifier.getText(source)};`;
    edits.push({ start: first.getStart(source), end: first.end, replacement });
    for (const declaration of imports.slice(1)) {
      // Keep any comments preceding the removed declaration at their original position.
      let end = declaration.end;
      if (text[end] === '\r') end++;
      if (text[end] === '\n') end++;
      edits.push({ start: declaration.getStart(source), end, replacement: '' });
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const prefix: ts.Statement[] = [];
  for (const statement of source.statements) { if (!ts.isImportDeclaration(statement)) break; prefix.push(statement); }
  if (prefix.length) {
    const first = prefix[0].getStart(source), next = source.statements[prefix.length]?.getStart(source) ?? text.length;
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
    const headers: { start: number; end: number; value: string }[] = [];
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      const start = scanner.getTokenPos(), end = scanner.getTextPos();
      if (start >= next) break;
      if (start >= prefix.at(-1)!.end && source.statements[prefix.length] && !/\n\s*\n/u.test(text.slice(end, next))) continue;
      if (token !== ts.SyntaxKind.MultiLineCommentTrivia || start <= first) continue;
      if (start !== 0 && text[start - 1] !== '\n') continue;
      const value = text.slice(start, end);
      if (/^\/\*\*?\s*(?:eslint|prettier|@ts-|@vite-)/u.test(value)) continue;
      headers.push({ start, end: text[end] === '\n' ? end + 1 : end, value });
    }
    for (const header of [...headers].reverse()) text = text.slice(0, header.start) + text.slice(header.end);
    if (headers.length) {
      const offset = text.startsWith('#!') ? text.indexOf('\n') + 1 : 0;
      text = text.slice(0, offset) + headers.map(header => header.value + '\n').join('') + text.slice(offset);
    }
  }
  return text.replace(/\s*$/u, '') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\0')
    .filter(path => /\.(?:[cm]?[jt]sx?)$/u.test(path) && !/(?:^|\/)(?:dist|prepared|generated|node_modules)\//u.test(path));
  let changed = 0;
  for (const path of files) {
    if (!existsSync(path)) continue;
    const before = readFileSync(path, 'utf8'), after = cleanModule(before, path);
    if (before !== after) { writeFileSync(path, after); changed++; }
  }
  console.log(`Module style codemod changed ${changed} files.`);
}
