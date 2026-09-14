import type { CompilerBakeProgress } from '../compiler/bake';

/** Each baker phase restarts its own counter; reserve ordered ranges within the bank. */
export function sampledBakeProgress(progress: CompilerBakeProgress): number {
  const fraction = Math.max(0, Math.min(1, progress.total > 0 ? progress.completed / progress.total : 0));
  switch (progress.phase) {
    case 'volume': return .6 * fraction;
    case 'texture': return .6 + .3 * fraction;
    case 'compile': return .9 + .1 * fraction;
  }
}
