/** Cold system-route load: the Earth scene is mounted at its system address. */
import type { Journey } from './harness/api.mts';
export const journey: Journey = {
  id: 'earth-system', exercises: ['capability:directLoad', 'capability:runtimeMount'],
  async run(api) { await api.load('/earth-system/', 'direct'); },
};
