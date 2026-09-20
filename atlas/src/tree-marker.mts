import { resolveMarkerStyle, type PreparedNavigationMarker } from '../../src/navigation/marker-presentation.mts';
import { PREPARED_NAVIGATION_MARKERS } from '../../site/prepared-navigation-markers.mjs';
import { sidebarThumbnail } from '../../site/sidebar-thumbnails.mts';
import { APP_ORIGIN, objectColors } from './objects.mts';

export interface TreeMarker {
  className: string;
  style: string;
}

const markers = PREPARED_NAVIGATION_MARKERS as Record<string, PreparedNavigationMarker | undefined>;
const colors = objectColors();
// The app's existing sidebar scale: the largest prepared marker fills 14 px.
const scale = 14 / Math.max(...Object.values(markers).map(marker => marker!.presentation.size));
const assetUrl = (origin: string, path: string): string => `${origin}${path}`;

/** Paint one prepared marker directly on its navigation link; no marker subtree is retained. */
export function treeMarker(objectId: string, origin = APP_ORIGIN): TreeMarker {
  const marker = markers[objectId];
  const color = colors.get(objectId);
  if (marker && color) {
    const presentation = resolveMarkerStyle(marker, { color, scale });
    const ring = presentation.ring;
    return {
      className: `atlas-marker atlas-marker-sprite${ring ? ' atlas-marker-ringed' : ''}`,
      style: [
        `--atlas-marker-color:${color}`,
        `--atlas-marker-size:${presentation.size}px`,
        `--atlas-marker-image:url("${assetUrl(origin, presentation.image)}")`,
        `--atlas-marker-position:${presentation.position} center`,
        `--atlas-marker-background-size:${presentation.backgroundSize}`,
        ...(ring ? [
          `--atlas-ring-width:${ring.width}px`,
          `--atlas-ring-height:${ring.height}px`,
          `--atlas-ring-color-share:${ring.colorShare}%`,
          `--atlas-ring-opacity:${ring.opacity}`,
          `--atlas-ring-angle:${ring.angle}deg`,
          `--atlas-ring-outline:${ring.outlineOpacity ? `1px solid color-mix(in srgb, ${color} ${ring.outlineOpacity}%, transparent)` : 'none'}`,
          `--atlas-ring-outline-offset:${ring.outlineOffset}px`,
        ] : []),
      ].join(';'),
    };
  }

  const thumbnail = sidebarThumbnail(objectId);
  return thumbnail
    ? { className: 'atlas-marker atlas-marker-context', style: `--atlas-marker-image:url("${assetUrl(origin, thumbnail.url2x)}")` }
    : { className: 'atlas-marker atlas-marker-catalog', style: '' };
}
