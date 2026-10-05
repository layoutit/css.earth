/** Optional real-response scheduler: forward concurrently, release in observed issue order. */
import { setTimeout as delay } from 'node:timers/promises';
import type { Page, Route, APIResponse } from 'playwright';
interface Entry { route: Route; response: Promise<APIResponse>; }
export async function installLockstep(page: Page) {
  const queue: Entry[] = [];
  let running = false, failure: unknown;
  async function pump() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const entry = queue[0]; if (!entry) throw new Error('Missing queued response');
        const response = await entry.response;
        await entry.route.fulfill({ response });
        queue.shift();
        // A held request cannot be globally network-idle. Between releases, wait for a quiet task window;
        // the main barrier owns readiness, frame stepping and complete IO/worker/image quiescence.
        await delay(10);
      }
    } catch (error) { failure = error; }
    finally { running = false; }
  }
  await page.context().route('**/*', async route => {
    const response = route.fetch({ maxRedirects: 0, timeout: 30000 });
    // Observe rejections immediately while an earlier response is still being released.
    void response.catch(error => { failure = error; });
    queue.push({ route, response }); void pump();
  });
  return { check() { if (failure) throw failure; }, pending() { return queue.length; } };
}
