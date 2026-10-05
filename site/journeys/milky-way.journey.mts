/** First determinism qualification: a cold direct load of the server-adopted volume. */
import type { Journey } from './harness/api.mts';
export const journey: Journey = { id: 'milky-way', orderings: [['/objects/milky-way/first-view.json', '/objects/milky-way/entry.json']], exercises: ['capability:directLoad', 'capability:serverAdoption'],
  async run(api) { await api.load('/milky-way/', 'direct'); } };
