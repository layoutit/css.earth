import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runToolchainProcessAsync, hasToolchainProgress } from '@cssearth/telescope-core/node';
import { main, type CliServices } from '../../cli.mts';

const directory = process.argv[2]!, mode = process.argv[3];
const entry = fileURLToPath(import.meta.url);
if (mode === 'helper' || mode === 'installer') {
  const stopped = resolve(directory, `${mode}-stopped`);
  process.on('SIGTERM', () => {
    setTimeout(() => { void writeFile(stopped, 'stopped').then(() => process.exit(0)); }, mode === 'helper' ? 100 : 75);
  });
  if (mode === 'helper') process.stdout.write('ready');
  else spawn(process.execPath, [entry, directory, 'helper'], { stdio: 'inherit' });
  setInterval(() => {}, 1000);
} else {
  const unused = async (): Promise<never> => { throw new Error('Unexpected service'); };
  const api: CliServices = {
    saveExploration: async () => {
      if (hasToolchainProgress()) throw new Error('Unexpected progress reporter');
      await runToolchainProcessAsync(process.execPath, [entry, directory, 'installer'], {
        output: text => { process.stderr.write(text); },
      });
      throw new Error('Installer was not cancelled');
    },
    getSession: unused, importLocalArtifact: unused, listArtifactOutputs: unused, exportOutput: unused,
    projectOutput: unused, exportSphere: unused, exportSpatialObject: unused, executeFamilyOperation: unused,
    familyCoverageLedger: () => [],
  };
  process.exitCode = await main(['explore', 'star', ...(mode === 'json' ? ['--json'] : [])], directory, undefined, undefined, api);
}
