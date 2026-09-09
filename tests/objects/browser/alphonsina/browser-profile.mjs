import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/alphonsina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'alphonsina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/alphonsina/alphonsina-directional-sun.webp",
      "two": "/scenes/alphonsina/alphonsina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/alphonsina/alphonsina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/alphonsina/alphonsina-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
