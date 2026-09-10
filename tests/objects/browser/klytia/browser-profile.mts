import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/klytia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'klytia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/klytia/klytia-directional-sun.webp",
      "two": "/scenes/klytia/klytia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/klytia/klytia-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/klytia/klytia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
