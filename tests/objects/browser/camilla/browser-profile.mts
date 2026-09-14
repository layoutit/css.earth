import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/camilla/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'camilla',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/camilla/camilla-directional-sun.webp",
      "two": "/scenes/camilla/camilla-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/camilla/camilla-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/camilla/camilla-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
