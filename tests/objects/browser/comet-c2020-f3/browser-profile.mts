import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-c2020-f3/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c2020-f3', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-c2020-f3/comet-c2020-f3-model-surface@2x.webp','/scenes/comet-c2020-f3/comet-c2020-f3-lighting.webp','/scenes/comet-c2020-f3/comet-c2020-f3-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
