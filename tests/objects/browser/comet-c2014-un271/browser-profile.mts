import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-c2014-un271/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c2014-un271', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-c2014-un271/comet-c2014-un271-model-surface@2x.webp','/scenes/comet-c2014-un271/comet-c2014-un271-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
