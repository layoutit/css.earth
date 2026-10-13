import shellCss from '../layouts/object-shell.css?inline';
import { SHELL_STYLE_FILE } from '../contracts/object-page-contract.mts';

// The page component owns its development CSS imports and Vite HMR.
const files = import.meta.glob<string>('../../src/**/*.css', { query: '?inline', import: 'default' });
export async function pageStyle(path: string): Promise<string> {
  if (path === SHELL_STYLE_FILE) return shellCss;
  const read = files[`../../${path}`];
  if (!read) throw new Error(`Missing page stylesheet: ${path}`);
  return read();
}
