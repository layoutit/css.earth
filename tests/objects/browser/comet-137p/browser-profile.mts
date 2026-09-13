import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-137p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-137p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-137p/comet-137p-model-surface@2x.webp','/scenes/comet-137p/comet-137p-lighting.webp','/scenes/comet-137p/comet-137p-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
