import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/feronia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'feronia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/feronia/feronia-directional-sun.webp",
      "two": "/scenes/feronia/feronia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/feronia/feronia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/feronia/feronia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
