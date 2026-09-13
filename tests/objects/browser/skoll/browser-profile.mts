import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/skoll/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'skoll',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/skoll/skoll-model-surface@2x.webp','/scenes/skoll/skoll-lighting.webp','/scenes/skoll/skoll-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
