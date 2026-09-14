import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-209p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-209p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-209p/comet-209p-model-surface@2x.webp','/scenes/comet-209p/comet-209p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
