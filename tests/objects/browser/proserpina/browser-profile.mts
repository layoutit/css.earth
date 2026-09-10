import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/proserpina/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'proserpina',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/proserpina/proserpina-directional-sun.webp",
      "two": "/scenes/proserpina/proserpina-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/proserpina/proserpina-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/proserpina/proserpina-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
