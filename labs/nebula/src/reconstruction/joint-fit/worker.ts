import { readJointRequest } from './model';
import { prepareJointFit } from './prepare';
let source = ''; for await (const chunk of process.stdin) source += String(chunk);
const result = await prepareJointFit(process.cwd(), readJointRequest(JSON.parse(source)), new AbortController().signal,
  message => process.stdout.write(JSON.stringify({ type: 'progress', message }) + '\n'));
process.stdout.write(JSON.stringify({ type: 'complete', result }) + '\n');
