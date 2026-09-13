import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/anthe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'anthe',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/anthe/anthe-model-surface@2x.webp','/scenes/anthe/anthe-lighting.webp','/scenes/anthe/anthe-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
