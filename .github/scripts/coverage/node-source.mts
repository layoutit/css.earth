/** Capture the actual Node script text through Inspector; inherited by test processes and workers. */
import { Session } from 'node:inspector';
import { threadId } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = process.env.COVERAGE_SOURCE_DIR;
const root = process.env.COVERAGE_SOURCE_ROOT;
if (destination && root) {
  mkdirSync(destination, { recursive: true });
  const session = new Session();
  session.connect();
  const sources: Record<string, string> = {};
  let sequence = 0;
  session.on('Debugger.scriptParsed', event => {
    const { url, scriptId } = event.params;
    if (!url.startsWith('file:')) return;
    const file = relative(root, fileURLToPath(url)).replaceAll('\\', '/');
    if (file.startsWith('../') || file.includes('node_modules/') || new URL(url).search) return;
    session.post('Debugger.getScriptSource', { scriptId }, (error, result) => {
      if (error || !result) return;
      const name = `${process.pid}-${threadId}-${++sequence}.js`;
      writeFileSync(resolve(destination, name), result.scriptSource);
      sources[url] = name;
      writeFileSync(resolve(destination, `${process.pid}-${threadId}.json`), JSON.stringify(sources));
    });
  });
  session.post('Debugger.enable');
}
