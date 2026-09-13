import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/suttungr/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'suttungr',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/suttungr/suttungr-model-surface@2x.webp','/scenes/suttungr/suttungr-lighting.webp','/scenes/suttungr/suttungr-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
