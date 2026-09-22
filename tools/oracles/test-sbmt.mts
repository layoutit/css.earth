import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ORACLE_ROOT } from './fixture.mts';
import { restoreInputs } from './sbmt/restore.mts';

const flags=process.argv.slice(2);
if(flags.some(f=>!['--unit','--restore'].includes(f))||flags.length>1)throw new Error('Usage: pnpm test:sbmt [--unit|--restore]');
if(flags.includes('--restore'))await restoreInputs();
const result=spawnSync(process.execPath,['--max-old-space-size=512','--test','--test-concurrency=1',
  resolve(ORACLE_ROOT,'tools/contract/oracle-fixtures.test.mts'),resolve(import.meta.dirname,'sbmt/projection.test.mts')],
  {cwd:ORACLE_ROOT,stdio:'inherit',timeout:120_000,killSignal:'SIGKILL',env:{...process.env,SBMT_TEST_UNIT:flags.includes('--unit')?'1':'0'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
