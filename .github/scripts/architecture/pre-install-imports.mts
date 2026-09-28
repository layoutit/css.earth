/** The `pre-install-imports` repository rule: a script a workflow job runs with `node` before the job installs
 * dependencies imports only Node built-ins (`node:` specifiers) and repository files that job's checkout keeps, and so
 * does everything those files import. Such a job has no `node_modules`, and a sparse one holds only what its
 * `sparse-checkout` list names: any other import fails with ERR_MODULE_NOT_FOUND in CI alone, never on a full local checkout.
 * A job's install is the first `pnpm install` (`pnpm i`), `npm ci` or `npm install` command in its steps' `run` text, comments aside;
 * the commands before it, in that step too, run before install, and a job without one runs every step before install.
 * Sparse lists are read in non-cone mode, as every workflow here declares them. */
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { parse } from 'yaml';
import { isRecord } from '@cssearth/core';
import { importedSpecifiers } from './declared-dependencies.mts';

const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/u;
const SCRIPT = /\.[cm]?[jt]s$/u;
/** An install command where a command starts: a line, or after `;`, `&&`, `||`, `|` or `(`; not an argument such as `echo "pnpm install"`. */
const INSTALL = /(?:^|[;&|(])[ \t]*(?:pnpm[ \t]+(?:install|i)|npm[ \t]+(?:ci|install|i))(?![\w-])/mu;
/** One `node …` command inside a step's shell text, up to the end of that command. */
const NODE_COMMAND = /(?<![\w./-])node\s[^\n;&|)]*/gu;
/** A repository path (or glob) to a script, quoted or bare. */
const SCRIPT_TOKEN = /(?<=^|[\s"'=])([\w.*@/-]+\.[cm]?[jt]s)(?=$|[\s"'])/gu;

/** One script a job runs before its install, with the job's sparse-checkout patterns (`null`: the whole tree). */
export interface PreInstallScript {
  readonly workflow: string; readonly job: string; readonly script: string; readonly sparse: readonly string[] | null;
}

/** A gitignore-style non-cone pattern as a matcher of a repository path. */
function patternMatcher(pattern: string): RegExp {
  const anchored = pattern.startsWith('/') || pattern.slice(0, -1).includes('/');
  const body = pattern.replace(/^\//u, '').replace(/\/$/u, '');
  let source = '';
  for (let at = 0; at < body.length; at++) {
    const char = body[at]!;
    if (char === '*' && body[at + 1] === '*') {
      // `**/` matches no directory or several; a trailing `**` matches everything below.
      if (body[at + 2] === '/') { source += '(?:.*/)?'; at += 2; } else { source += '.*'; at += 1; }
    } else if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else source += char.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
  }
  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${source}$`, 'u');
}

/** Whether a sparse checkout with `patterns` keeps `path`: the last pattern that matches the path or one of its parent
 * directories decides, and a `!` pattern leaves it out. */
export function sparseKeeps(patterns: readonly string[], path: string): boolean {
  const parts = path.split('/'), candidates = parts.map((_, at) => parts.slice(0, at + 1).join('/'));
  let kept = false;
  for (const line of patterns) {
    const negated = line.startsWith('!'), matcher = patternMatcher(negated ? line.slice(1) : line);
    if (candidates.some(candidate => matcher.test(candidate))) kept = !negated;
  }
  return kept;
}

/** Shell text without its comments: a `#` that starts a word, outside quotes, to the end of its line. */
export function withoutComments(text: string): string {
  return text.split('\n').map(line => {
    let quote = '';
    for (let at = 0; at < line.length; at++) {
      const char = line[at]!;
      if (quote) { if (char === quote) quote = ''; else if (char === '\\' && quote === '"') at++; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '\\') at++;
      else if (char === '#' && (at === 0 || /\s/u.test(line[at - 1]!))) return line.slice(0, at);
    }
    return line;
  }).join('\n');
}

const globMatcher = (glob: string) => patternMatcher(`/${glob}`);

/** The scripts each job of `workflow` (its YAML `text`) runs before its install, globs expanded against `tracked`.
 * A named path that is not tracked is returned as is, so the rule reports it. */
export function preInstallScripts(workflow: string, text: string, tracked: readonly string[]): PreInstallScript[] {
  const document: unknown = parse(text, { merge: true });
  const jobs = isRecord(document) && isRecord(document.jobs) ? document.jobs : {};
  const found: PreInstallScript[] = [];
  for (const [job, definition] of Object.entries(jobs)) {
    const steps = isRecord(definition) && Array.isArray(definition.steps) ? definition.steps.filter(isRecord) : [];
    let sparse: string[] | null = null;
    let installed = false;
    for (const step of steps) {
      if (installed) break;
      if (typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@') && isRecord(step.with)
        && typeof step.with['sparse-checkout'] === 'string') {
        sparse = step.with['sparse-checkout'].split('\n').map(line => line.trim()).filter(Boolean);
      }
      // Shell comments name no command, and only the text before the install command runs without dependencies.
      let run = typeof step.run === 'string' ? withoutComments(step.run.replace(/\\\n/gu, ' ')) : '';
      const install = INSTALL.exec(run);
      if (install) { run = run.slice(0, install.index); installed = true; }
      for (const command of run.match(NODE_COMMAND) ?? []) {
        for (const [, token] of command.matchAll(SCRIPT_TOKEN)) {
          const path = token!.replace(/^\.\//u, '');
          const scripts = path.includes('*') ? tracked.filter(file => globMatcher(path).test(file)) : [path];
          for (const script of scripts) found.push({ workflow, job, script, sparse });
        }
      }
    }
  }
  return found;
}

/** Findings for `scripts`: every import in their closure that is not a `node:` built-in or a repository file the job's
 * checkout keeps. `read` returns a tracked file's text. */
export function preInstallFindings(scripts: readonly PreInstallScript[], tracked: ReadonlySet<string>, read: (path: string) => string): string[] {
  const findings = new Set<string>();
  for (const { workflow, job, script, sparse } of scripts) {
    const where = `${workflow} ${job}: ${script}`;
    const kept = (path: string) => sparse === null || sparseKeeps(sparse, path);
    if (!tracked.has(script)) { findings.add(`${where} is run before install but is not a tracked file`); continue; }
    if (!kept(script)) { findings.add(`${where} is run before install but the job's sparse checkout leaves it out`); continue; }
    const queue = [script], seen = new Set(queue);
    for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
      const via = file === script ? '' : ` (via ${file})`;
      for (const specifier of importedSpecifiers(read(file), file)) {
        if (specifier.startsWith('node:')) continue;
        if (!specifier.startsWith('.')) {
          findings.add(`${where}${via} imports ${specifier}; before install a script may import only node: built-ins and repository files`);
          continue;
        }
        const target = posix.normalize(posix.join(posix.dirname(file), specifier));
        if (!tracked.has(target)) findings.add(`${where}${via} imports ${specifier}, which is not a tracked file`);
        else if (!kept(target)) findings.add(`${where}${via} imports ${target}, which the job's sparse checkout leaves out`);
        else if (SCRIPT.test(target) && !seen.has(target)) { seen.add(target); queue.push(target); }
      }
    }
  }
  return [...findings].sort();
}

/** The rule's check over the checkout at `root`, whose tracked and new files are `files`. */
export function checkPreInstallImports(root: string, files: readonly string[]): string[] {
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
  const present = files.filter(path => existsSync(resolve(root, path)));
  const scripts = present.filter(path => WORKFLOW.test(path)).flatMap(path => preInstallScripts(path, read(path), present));
  return preInstallFindings(scripts, new Set(present), read);
}
