import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-17p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-17p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-17p/comet-17p-model-surface@2x.webp','/scenes/comet-17p/comet-17p-lighting.webp','/scenes/comet-17p/comet-17p-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
