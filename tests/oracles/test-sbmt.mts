import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ORACLE_ROOT } from './fixture.mts';
import { restoreInputs } from './sbmt/restore.mts';

const flags=process.argv.slice(2);
if(flags.some(f=>!['--unit','--restore'].includes(f))||flags.length>1)throw new Error('Usage: pnpm test:sbmt [--unit|--restore]');
if(flags.includes('--restore'))await restoreInputs();
// node --test skips a listed file that does not exist without failing; refuse instead, so a moved test cannot drop out.
const tests=[resolve(import.meta.dirname,'sbmt/projection.test.mts')];
const missing=tests.filter(path=>!existsSync(path));
if(missing.length)throw new Error(`Listed SBMT tests do not exist:\n${missing.join('\n')}`);
const result=spawnSync(process.execPath,['--max-old-space-size=512','--test','--test-concurrency=1',...tests],
  {cwd:ORACLE_ROOT,stdio:'inherit',timeout:120_000,killSignal:'SIGKILL',env:{...process.env,SBMT_TEST_UNIT:flags.includes('--unit')?'1':'0'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
