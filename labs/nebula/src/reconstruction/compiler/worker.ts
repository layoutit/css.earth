import { readCompilerRequest } from './model';
import { compileNebula } from './compile';
let input = ''; for await (const chunk of process.stdin) input += String(chunk);
const request = readCompilerRequest(JSON.parse(input));
const result = await compileNebula(process.cwd(), request, new AbortController().signal,
  (message, fraction) => process.stdout.write(JSON.stringify({ type: 'progress', message, fraction }) + '\n'));
process.stdout.write(JSON.stringify({ type: 'complete', result }) + '\n');
