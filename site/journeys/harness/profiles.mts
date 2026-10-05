/** Browser context settings, shared by all journeys and recorded as comparison metadata. */
export interface Profile {
  lockstep?: boolean;
  engine: 'chromium' | 'webkit'; viewport: { width: number; height: number }; deviceScaleFactor: number;
  hasTouch: boolean; reducedMotion: 'reduce' | 'no-preference'; colorScheme: 'dark' | 'light';
}
const desktop: Profile = { engine: 'chromium', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
  hasTouch: false, reducedMotion: 'no-preference', colorScheme: 'dark' };
export const profiles: Record<string, Profile> = {
  'chromium-lockstep': { ...desktop, lockstep: true }, 'webkit-lockstep': { ...desktop, engine: 'webkit', lockstep: true },
  'chromium-desktop': desktop, 'webkit-desktop': { ...desktop, engine: 'webkit' },
  'chromium-reduced': { ...desktop, reducedMotion: 'reduce' },
  'mobile-touch': { ...desktop, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true },
  tablet: { ...desktop, viewport: { width: 820, height: 1094 }, deviceScaleFactor: 2, hasTouch: true },
};
