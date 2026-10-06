/** Short polling with an absolute termination condition for cross-step cache restoration. */
import { stat } from 'node:fs/promises';
export async function waitForFile(path: string, budgetMs: number): Promise<void> {
  const deadline = performance.now() + budgetMs;
  while (!await stat(path).catch(() => undefined)) {
    if (performance.now() >= deadline) throw new Error('Cache restore readiness budget exhausted');
    await new Promise(accept => setTimeout(accept, 250));
  }
}
