import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/pallene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pallene',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/pallene/pallene-normal-surface@2x.webp','/scenes/pallene/pallene-lighting.webp','/scenes/pallene/pallene-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
