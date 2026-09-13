import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/juliet/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'juliet',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/juliet/juliet-model-surface@2x.webp','/scenes/juliet/juliet-lighting.webp','/scenes/juliet/juliet-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
