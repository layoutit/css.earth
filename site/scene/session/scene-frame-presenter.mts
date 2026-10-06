import type { createApplicationWorldContext } from '../application-world-context.mts';

/** The world's code loads when the world does (`scene-router.mts`); its viewport exists from the start. */
export type WorldContextOwner = Pick<ReturnType<typeof createApplicationWorldContext>, 'mount'> & {
  createViewport(stage: HTMLElement): ReturnType<typeof import('../../world/world-viewport.mts').createWorldViewport> };
export type WorldContextMount = Awaited<ReturnType<WorldContextOwner['mount']>>;
type WorldFramePresenter = ReturnType<NonNullable<WorldContextMount['createFramePresenter']>>;
/** A detail's frame presenter. One mounted before the world commits its own frames until `attach`. */
export type SceneFramePresenter = WorldFramePresenter & { attach?(world: WorldContextMount): void };
