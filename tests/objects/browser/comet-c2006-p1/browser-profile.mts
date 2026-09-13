import { createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/comet-c2006-p1/prepared/controls.json' with { type: 'json' };
export const browserProfile = createObjectBrowserProfile({ id:'comet-c2006-p1', controls:objectControls,
 audit:{
  canonicalPreparedAssets:['/scenes/comet-c2006-p1/comet-c2006-p1-model-surface@2x.webp','/scenes/comet-c2006-p1/comet-c2006-p1-lighting.webp','/scenes/comet-c2006-p1/comet-c2006-p1-directional-sun@2x.webp'],
  retained:{lensIds:['model'],speedClicks:0,allowedMountSelectors:[]},
 },
});
