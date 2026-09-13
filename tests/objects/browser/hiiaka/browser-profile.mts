import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/hiiaka/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hiiaka',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/hiiaka/hiiaka-model-surface@2x.webp','/scenes/hiiaka/hiiaka-lighting.webp','/scenes/hiiaka/hiiaka-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
