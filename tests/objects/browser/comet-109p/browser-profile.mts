import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-109p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-109p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-109p/comet-109p-model-surface@2x.webp','/scenes/comet-109p/comet-109p-lighting.webp','/scenes/comet-109p/comet-109p-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
