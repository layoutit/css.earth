import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/paaliaq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'paaliaq',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/paaliaq/paaliaq-directional-sun.webp',two:'/scenes/paaliaq/paaliaq-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/paaliaq/paaliaq-model-surface@2x.webp','/scenes/paaliaq/paaliaq-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
