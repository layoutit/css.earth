import { mock } from 'node:test';

// Router unit cases inject their own world-context owner. Application boot uses
// Vite's generated glob handling and is exercised by the browser suites.
mock.module(new URL('../application-world-context.mts', import.meta.url).href, {
  namedExports: { createApplicationWorldContext() {
    throw new Error('Router unit tests must inject the world-context owner.');
  } },
});
