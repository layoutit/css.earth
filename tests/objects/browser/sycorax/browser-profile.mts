import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/sycorax/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sycorax',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/sycorax/sycorax-model-surface@2x.webp','/scenes/sycorax/sycorax-lighting.webp','/scenes/sycorax/sycorax-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
