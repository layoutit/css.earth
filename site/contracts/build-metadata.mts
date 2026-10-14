export const VERSION_TOKEN = '__CSSEARTH_BUILD_VERSION__';
export const REVISION_TOKEN = '__CSSEARTH_BUILD_REVISION__';

export function incrementalBuildEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CSSEARTH_INCREMENTAL_BUILD === '1';
}

export function incrementalRenderEnabled(command: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return command === 'build' && incrementalBuildEnabled(env);
}
