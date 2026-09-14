import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/comet-21p/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-21p', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-21p/comet-21p-model-surface@2x.webp','/scenes/comet-21p/comet-21p-lighting.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
