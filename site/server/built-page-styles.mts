import { projectRoot } from '@cssearth/core/node';
import { readCompiledPageStyles } from './compiled-page-styles.mts';

let styles: ReturnType<typeof readCompiledPageStyles> | undefined;
/** Only the prerender build aliases the development loader to this filesystem reader. */
export async function pageStyle(path: string): Promise<string> {
  const css = (await (styles ??= readCompiledPageStyles(projectRoot(import.meta.url))))[path];
  if (css === undefined) throw new Error(`Missing compiled page stylesheet: ${path}`);
  return css;
}
