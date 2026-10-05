/** Cold load of the material-and-feature body behind its prepared arrival cover. */
import type { Journey } from './harness/api.mts';
export const journey: Journey = {
  id: 'dione', exercises: ['capability:directLoad', 'capability:runtimeMount'],
  async run(api) { await api.load('/dione/', 'direct'); },
};
