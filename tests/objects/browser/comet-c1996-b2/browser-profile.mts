import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-c1996-b2/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c1996-b2', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-c1996-b2/comet-c1996-b2-model-surface@2x.webp','/scenes/comet-c1996-b2/comet-c1996-b2-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
