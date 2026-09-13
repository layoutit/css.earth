import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-162p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-162p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-162p/comet-162p-model-surface@2x.webp','/scenes/comet-162p/comet-162p-lighting.webp','/scenes/comet-162p/comet-162p-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
