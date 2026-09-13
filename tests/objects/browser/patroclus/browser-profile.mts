import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/patroclus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'patroclus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/patroclus/patroclus-model-surface@2x.webp','/scenes/patroclus/patroclus-lighting.webp','/scenes/patroclus/patroclus-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
