import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/sylvia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sylvia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/sylvia/sylvia-directional-sun.webp",
      "two": "/scenes/sylvia/sylvia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/sylvia/sylvia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/sylvia/sylvia-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
