import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ducrosa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ducrosa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ducrosa/ducrosa-directional-sun.webp",
      "two": "/scenes/ducrosa/ducrosa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ducrosa/ducrosa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ducrosa/ducrosa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
