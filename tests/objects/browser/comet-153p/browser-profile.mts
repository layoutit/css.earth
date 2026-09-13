import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-153p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-153p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-153p/comet-153p-model-surface@2x.webp','/scenes/comet-153p/comet-153p-lighting.webp','/scenes/comet-153p/comet-153p-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
