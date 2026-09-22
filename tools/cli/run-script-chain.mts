/**
 * Run a package.json script chain without spawning pnpm for every alias. `predev` was eight `pnpm` calls, several
 * nesting more; each spawn cost about 0.75 s, half of a warm start. This expands `pnpm <script>` tokens from
 * package.json itself, so the chains stay defined in one place, and runs each `node …` step directly, timing it.
 *
 *   node tools/run-script-chain.mts <script-name>
 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord, requireString } from '../sources/source-values.mts';

export interface ChainStep { readonly script: string; readonly command: string }

/** The `&&`-separated commands of a script, with every `pnpm <name>` alias expanded in place, depth first. */
export function expandScriptChain(scripts: Readonly<Record<string, string>>, name: string, seen: readonly string[] = []): ChainStep[] {
  const script = scripts[name];
  if (script === undefined) throw new TypeError(`Unknown script: ${name}.`);
  if (seen.includes(name)) throw new TypeError(`Script chain loops: ${[...seen, name].join(' -> ')}.`);
  const steps: ChainStep[] = [];
  for (const command of script.split('&&').map(part => part.trim()).filter(Boolean)) {
    const alias = /^pnpm (?:-s )?([a-z][a-z0-9:-]*)$/u.exec(command);
    if (alias) steps.push(...expandScriptChain(scripts, alias[1], [...seen, name]));
    else steps.push({ script: name, command });
  }
  return steps;
}

export async function runScriptChain(name: string, root = process.cwd()) {
  const scripts = requireRecord(requireRecord(JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))).scripts);
  const steps = expandScriptChain(Object.fromEntries(Object.entries(scripts).map(([key, value]) => [key, requireString(value)])), name);
  const started = performance.now();
  for (const step of steps) {
    const at = performance.now();
    const code = await new Promise<number>((done, fail) => {
      const child = spawn(step.command, { cwd: root, stdio: 'inherit', shell: true });
      child.on('error', fail); child.on('exit', code => done(code ?? 1));
    });
    const seconds = ((performance.now() - at) / 1000).toFixed(1);
    if (code !== 0) throw new Error(`${name}: step failed after ${seconds}s (${step.script}): ${step.command}`);
    console.log(`[${name}] ${seconds}s ${step.command}`);
  }
  console.log(`[${name}] ${steps.length} steps in ${((performance.now() - started) / 1000).toFixed(1)}s`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || rest.length) throw new TypeError('Usage: run-script-chain <script-name>');
  await runScriptChain(name);
}
