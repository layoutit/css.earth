import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-55p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-55p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-55p/comet-55p-model-surface@2x.webp','/scenes/comet-55p/comet-55p-lighting.webp','/scenes/comet-55p/comet-55p-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
