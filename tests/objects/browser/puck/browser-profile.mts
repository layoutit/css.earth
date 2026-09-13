import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/puck/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'puck',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/puck/puck-normal-surface@2x.webp','/scenes/puck/puck-lighting.webp','/scenes/puck/puck-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
