import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';

const absoluteCache = (value: string | undefined): string | undefined => value && isAbsolute(value) ? value : undefined;

/** Resolve user-owned state independently of package location and working directory. */
export function telescopeUserRoot(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, home = homedir()): string {
  const override = env.CSSEARTH_TELESCOPE_HOME;
  if (override !== undefined) {
    if (!override.trim()) throw new TypeError('CSSEARTH_TELESCOPE_HOME requires a path.');
    return resolve(override);
  }
  const cache = platform === 'darwin' ? resolve(home, 'Library/Caches')
    : platform === 'win32' ? absoluteCache(env.LOCALAPPDATA) || resolve(home, 'AppData/Local')
    : absoluteCache(env.XDG_CACHE_HOME) || resolve(home, '.cache');
  return resolve(cache, 'cssearth-telescope');
}
