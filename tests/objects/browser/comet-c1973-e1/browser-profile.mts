import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-c1973-e1/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c1973-e1', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-c1973-e1/comet-c1973-e1-model-surface@2x.webp','/scenes/comet-c1973-e1/comet-c1973-e1-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
