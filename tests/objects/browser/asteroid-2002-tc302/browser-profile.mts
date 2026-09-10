import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/asteroid-2002-tc302/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'asteroid-2002-tc302',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/asteroid-2002-tc302/asteroid-2002-tc302-directional-sun.webp',two:'/scenes/asteroid-2002-tc302/asteroid-2002-tc302-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/asteroid-2002-tc302/asteroid-2002-tc302-model-surface@2x.webp','/scenes/asteroid-2002-tc302/asteroid-2002-tc302-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
