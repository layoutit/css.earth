/** Reduced-motion proof on a prepared variable star with a native opacity light curve. */
import type { Journey } from './harness/api.mts';
export const journey: Journey = {
  id: 'cv-mon-light-curves', exercises: ['capability:directLoad', 'capability:reducedMotion'],
  async run(api) {
    await api.load('/cv-mon/', 'direct');
    const present = await api.page.evaluate(() => document.getAnimations().some(animation => animation.id === 'cv-mon-light-curve'));
    if (!present) throw new Error('CV Mon light curve was not mounted; this is not a reduced-motion proof');
    await api.playback('light-curve-permission');
  },
};
