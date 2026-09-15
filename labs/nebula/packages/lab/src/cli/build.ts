/** Bundle internal TypeScript owners; native and third-party dependencies remain external. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build, type BuildOptions } from 'esbuild';

export function buildLabModule(options: BuildOptions) {
  return build({ ...options, plugins: [{
    name: 'nebula-workspace-source-owners',
    setup(builder) {
      builder.onResolve({ filter: /^@cssearth\// }, args => {
        const directory = args.resolveDir || options.absWorkingDir || process.cwd();
        const require = createRequire(resolve(directory, '__nebula_bundle__.cjs'));
        return { path: require.resolve(args.path) };
      });
    },
  }, ...(options.plugins ?? [])] });
}
