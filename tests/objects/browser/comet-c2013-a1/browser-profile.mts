import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-c2013-a1/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c2013-a1', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-c2013-a1/comet-c2013-a1-model-surface@2x.webp','/scenes/comet-c2013-a1/comet-c2013-a1-lighting.webp','/scenes/comet-c2013-a1/comet-c2013-a1-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
