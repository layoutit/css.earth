import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/auravictrix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'auravictrix',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/auravictrix/auravictrix-directional-sun.webp",
      "two": "/scenes/auravictrix/auravictrix-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/auravictrix/auravictrix-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/auravictrix/auravictrix-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
