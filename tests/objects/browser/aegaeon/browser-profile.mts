import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/aegaeon/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aegaeon',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/aegaeon/aegaeon-model-surface@2x.webp','/scenes/aegaeon/aegaeon-lighting.webp','/scenes/aegaeon/aegaeon-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
