import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/orus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'orus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/orus/orus-model-surface@2x.webp','/scenes/orus/orus-lighting.webp','/scenes/orus/orus-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
