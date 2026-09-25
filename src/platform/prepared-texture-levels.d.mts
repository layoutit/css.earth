import type { PreparedVariant } from '../renderers/css/rendering/prepared-presentation.js';
import type { PreparedTexturePlacements } from '../renderers/css/rendering/prepared-texture-levels.js';
export function requireTextureLevels(value: unknown, variants: readonly PreparedVariant[], resources: ReadonlySet<string>): void;
export function requireTexturePlacements(value: unknown, accepts: (name: string) => boolean): asserts value is PreparedTexturePlacements;
