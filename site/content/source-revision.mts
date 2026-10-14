import { execFileSync } from 'node:child_process';

export function sourceRevision(root: string, env: NodeJS.ProcessEnv = process.env): string {
  const revision = env.COMMIT_REF || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Source documentation needs the build commit.');
  return revision;
}
