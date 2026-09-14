import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/eumelos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eumelos',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eumelos/eumelos-directional-sun.webp",
      "two": "/scenes/eumelos/eumelos-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eumelos/eumelos-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eumelos/eumelos-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
