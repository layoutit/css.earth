import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/despina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'despina',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/despina/despina-model-surface@2x.webp','/scenes/despina/despina-lighting.webp','/scenes/despina/despina-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
