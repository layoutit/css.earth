import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/rosalinde/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'rosalinde',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/rosalinde/rosalinde-directional-sun.webp",
      "two": "/scenes/rosalinde/rosalinde-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/rosalinde/rosalinde-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/rosalinde/rosalinde-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
