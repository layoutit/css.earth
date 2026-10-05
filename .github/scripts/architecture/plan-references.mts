/** Inventory literal move references and depth-sensitive reads; dated records stay separate from live pointers. */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { byText, isTestPath } from './zones.mts';
export interface Reference { old: string; file: string; line: number; form: string; classification: string; scope: 'live' | 'history' | 'plan'; text: string }
function classify(file: string, line: string): string {
  if (file.endsWith('AGENTS.md') || file.endsWith('CLAUDE.md')) return 'AGENTS.md contract text';
  if (file.endsWith('.py')) return 'Python script';
  if (file.includes('ci-areas')) return 'CI routing';
  if (file.startsWith('.github/workflows/')) return 'workflow';
  if (/tsconfig|eslint|package\.json/u.test(file)) return 'tsconfig/eslint/package.json';
  if (/import\s*\([^'"`]/u.test(line)) return 'computed import';
  if (/\b(?:import|export)\b.*['"]/u.test(line)) return 'source import';
  if (file.endsWith('.md')) return /\]\(/u.test(line) ? 'docs link' : 'docs code-span';
  return 'generator/producer literal';
}
/** A literal scan includes untracked draft files, unlike plain git grep; ignores binary evidence. */
export function references(root: string, moves: Readonly<Record<string, unknown>>, only?: readonly string[]) {
  const paths = [...new Set([...Object.keys(moves), ...(Object.keys(moves).some(path => path.startsWith('site/test/')) ? ['site/test/'] : [])])], occurrences: Reference[] = [], relativeReads: { file: string; destination: string; line: number; text: string }[] = [];
  const patterns = [...new Set(paths.flatMap(old => {
    if (old.endsWith('/')) return [old, './test/'];
    const base = old.slice(old.lastIndexOf('/') + 1), without = old.replace(/\.(?:[cm]?[jt]s|astro|json|css)$/u, '');
    const stem = base.replace(/\.(?:[cm]?[jt]s|astro|json|css)$/u, '');
    return [old, without, old.slice(5), base, ...["'", '"', '`'].map(quote => `/${stem}${quote}`)];
  }))];
  const grep = only ? { status: 1, stdout: '', stderr: '', error: undefined } : spawnSync('git', ['grep', '-I', '-l', '-F', '-f', '-', '--'], { cwd: root, encoding: 'utf8', input: `${patterns.join('\n')}\n`, maxBuffer: 64 * 1024 * 1024 });
  if (grep.error) throw grep.error;
  if (grep.status !== 0 && grep.status !== 1) throw new Error(`git grep failed: ${grep.stderr}`);
  const untracked = only ? [] : execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const selected = only ?? [...new Set([...grep.stdout.split('\n').filter(Boolean), ...untracked, ...paths.filter(path => !path.endsWith('/') && isTestPath(path))])].sort();
  for (const file of selected) {
    if (!existsSync(resolve(root, file))) continue;
    if (file === '.github/site-refactor.json' || file.startsWith('docs/site-architecture/') || /^\.github\/scripts\/architecture\/(?:site-architecture|projection|plan-proofs|plan-references|import-declarations)(?:\.test)?\.mts$/u.test(file)) continue; // The inventory cannot inventory its own serialization.
    const bytes = readFileSync(resolve(root, file)); if (bytes.includes(0)) continue;
    const content = bytes.toString('utf8');
    const candidates = paths.filter(old => {
      if (old.endsWith('/')) return content.includes(old) || content.includes(old.slice(5));
      const base = old.slice(old.lastIndexOf('/') + 1), stem = base.replace(/\.(?:[cm]?[jt]s|astro|json|css)$/u, '');
      return content.includes(old) || content.includes(old.replace(/\.(?:[cm]?[jt]s|astro|json|css)$/u, '')) || content.includes(old.slice(5)) || content.includes(base)
        || ["'", '"', '`'].some(quote => content.includes(`/${stem}${quote}`));
    });
    if (!candidates.length && !(isTestPath(file) && typeof moves[file] === 'string')) continue;
    const lines = content.split('\n');
    const scope = file === '.github/site-refactor.json' || file.startsWith('docs/site-architecture') || /^\.github\/scripts\/architecture\/(?:site-architecture|projection|plan-proofs|plan-references|import-declarations)(?:\.test)?\.mts$/u.test(file) ? 'plan'
      : /(?:^untangle\/|\/history\/|\/archive\/|\/done\/|(?:^|\/)(?:reports|records)\/)/u.test(file) ? 'history' : 'live';
    let generated = false;
    for (const [index, line] of lines.entries()) {
      if (file === 'docs/site-architecture.md' && line.startsWith('<!-- generated:')) generated = true;
      if (generated) { if (line.startsWith('<!-- /generated:')) generated = false; continue; }
      if (isTestPath(file) && typeof moves[file] === 'string' && dirname(file) !== dirname(String(moves[file])) && /(?:\.\.\/)+(?:packages|src|site|\.github)\//u.test(line))
        relativeReads.push({ file, destination: String(moves[file]), line: index + 1, text: line.trim() });
      const relativeTargets = new Set((line.includes('./') ? [...line.matchAll(/['"`]([^'"`\n]+)['"`]/gu)].filter(match => match[1]!.startsWith('.')).map(match => posix.normalize(posix.join(dirname(file), match[1]!.replace(/[?#].*$/u, '')))) : []));
      for (const old of candidates) {
        const without = old.replace(/\.(?:[cm]?[jt]s|astro|json|css)$/u, '');
        const folderRelative = old.slice(5);
        const literal = line.includes(old) ? 'full path' : without !== old && line.includes(without) ? 'without extension' : old.startsWith('site/test/') && !old.endsWith('/') && line.includes(folderRelative) ? 'folder-relative' : undefined;
        const relative = relativeTargets.has(old) || relativeTargets.has(without) || (old.endsWith('/') && [...relativeTargets].some(target => target.startsWith(old)));
        if (literal || relative) occurrences.push({ old, file, line: index + 1, form: relative ? 'resolved relative string' : literal ?? 'unknown literal', classification: classify(file, line), scope, text: line.trim() });
      }
    }
  }
  occurrences.sort((a, b) => byText(a.file, b.file) || a.line - b.line || byText(a.old, b.old));
  return { paths: paths.map(old => ({ old, destination: moves[old] ?? null, occurrences: occurrences.filter(item => item.old === old).length })), occurrences, relativeReads };
}
/** Old-path gates exclude the plan and dated records, but fail on any remaining live literal. */
export function liveReferences(inventory: ReturnType<typeof references>, old: readonly string[]) {
  return inventory.occurrences.filter(item => item.scope === 'live' && old.includes(item.old));
}

/** Stable, reviewable inventory: no source line numbers or snippets are committed. */
export function compactReferences(inventory: ReturnType<typeof references>) {
  const unique = new Map<string, { file: string; classification: string; scope: string }>();
  for (const { file, classification, scope } of inventory.occurrences) {
    const entry = { file, classification, scope }; unique.set(JSON.stringify(entry), entry);
  }
  return { occurrences: [...unique.values()], relativeReads: [...new Map(inventory.relativeReads.map(({ file, destination }) => [file, { file, destination }])).values()] };
}

/** Partial moves must review covering folder/glob references; the retired-folder gate fails them at retirement. */
export function coveringReferences(inventory: ReturnType<typeof references>, old: readonly string[]) {
  return inventory.occurrences.filter(item => item.scope === 'live' && item.old.endsWith('/') && !old.includes(item.old) && old.some(path => path.startsWith(item.old)));
}
