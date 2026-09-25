import { describe, expect, it } from 'vitest'
import { asteroidElements, asteroidPositionKm } from './asteroids.js'
import { ASTEROID_FIXTURES } from './__fixtures__/horizons.asteroids.js'
import { SMALL_BODY_IDS } from './bodies.js'

describe('asteroid positions against JPL Horizons', () => {
  it('reproduces the fitted epoch in ICRF kilometers', () => {
    for (const id of SMALL_BODY_IDS) {
      const epoch = asteroidElements(id).epochJdTt
      const row = ASTEROID_FIXTURES[id].rows.find(row => row.jd === epoch)!
      const actual = asteroidPositionKm(id, epoch)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(0.001)
    }
  })
  it('bounds the measured propagation error at the two independent nearby dates', () => {
    // Thirty days either side of the epoch. These source-fitted conics are
    // a fixed-date display ephemeris, not long-term perturbation theories.
    // The added main-belt fits measure 1926 km (Ida), 807 km (Gaspra),
    // and 214 km (Mathilde) at the independent endpoints; the fitted epoch
    // remains within 2 mm. These are measured short-term propagation limits.
    // New fits measured 266, 3796, 225 and 3093 km respectively for
    // Pallas, Hygiea, Juno and Psyche at the two independent endpoints.
    // The six radar additions measure endpoint maxima of 1944.06, 175.07,
    // 243.37, 132.46, 707.11 and 307.55 km respectively for Geographos,
    // Bacchus, Mithra, Nereus, Golevka and YORP. Bounds round upward with
    // a small regression margin; they do not establish accuracy between dates.
    // The 49 size-calibrated additions use ceil(measured endpoint maximum * 1.05) km:
    // a 5% regression margin plus less than 1 km upward rounding. These two
    // dates do not establish intervening-date accuracy. Exact errors and fixture
    // hashes are recorded in output/asteroids-wikipedia/orbit-errors.json.
    // The distant-world batch measures 519–549 km at epoch ±30 days;
    // Independent vectors: https://github.com/layoutit/cssEarth/blob/5ccf1eafa396d7cbe91e62b28fe81db8c0626a35/docs/distant-worlds/orbit-errors.json
    const maximumErrorKm = {"ixion": 547, "huya": 542, "asteroid-2003-vs2": 583, "asteroid-2002-tc302": 567, "asteroid-2002-tx300": 564, "deedee": 562, oumuamua: 600, sedna: 600, gonggong: 600, orcus: 600, salacia: 600, varuna: 600, varda: 600, mani: 600, achlys: 600,
      vesta: 300, eros: 200, itokawa: 400, bennu: 200, ryugu: 200, ida: 2000, gaspra: 850, mathilde: 230, lutetia: 200, steins: 220, didymos: 140, kleopatra: 250, toutatis: 340, pallas: 285, hygiea: 4000, juno: 240, psyche: 3300,
      interamnia: 300, davida: 550, sylvia: 6300, eunomia: 350, euphrosyne: 350, bamberga: 150, fortuna: 350, themis: 300, amphitrite: 250, egeria: 250, elektra: 2350, iris: 450, hebe: 1450, eugenia: 2450, daphne: 350, eleonora: 300, nemesis: 250, kalliope: 700, nemausa: 250, parthenope: 400, melpomene: 200, julia: 900, victoria: 2000, urania: 750,
      'flora': 200, 'europa-52': 2300, 'metis-9': 250, 'camilla': 3900, 'thisbe': 450, 'doris': 300, 'hermione': 300, 'diotima': 2000, 'herculina': 350, 'nausikaa': 250, 'astraea': 300, 'irene': 250, 'nysa': 450, 'sappho': 1700,
      'betulia': 390, 'castalia': 160, 'asteroid-1998-wt24': 530, 'asteroid-1994-cc': 330,
      'fides': 260, 'penelope': 1500, 'alphonsina': 1920, 'angelina': 320, 'ganymed': 1320, 'moshup': 230,
      'cybele': 400, 'aurora': 3150, 'palma': 350, 'thule': 350, 'hektor': 550, 'hekate': 250, 'phaethon': 400, 'harmonia': 950, 'panopaea': 200, 'desdemona-666': 1400, 'asteroid-1950-da': 350, 'apophis': 200, 'donaldjohanson': 250,
      geographos: 2000, bacchus: 190, mithra: 260, nereus: 145, golevka: 750, yorp: 330,
      'asteroid-1996-hw1': 845, 'asteroid-2008-ev5': 230, 'ra-shalom': 265, 'asteroid-1992-sk': 495, 'asteroid-1998-ml14': 1020, 'asteroid-2002-ce26': 360,
      massalia: 243, proserpina: 218, polyhymnia: 2233, leukothea: 278, virginia: 1154, echo: 244, maja: 233,
      dike: 314, juewa: 265, bertha: 250, lucia: 1354, brucia: 231, badenia: 1801, ducrosa: 626,
      gyptis: 1115, petrina: 1503, veritas: 260, gryphia: 306, selinur: 602, achilles: 432, musa: 1682,
      auravictrix: 251, transvaalia: 241, moskva: 2173, kressmannia: 103, parysatis: 271, rosalinde: 259, susi: 222,
      hidalgo: 467, zachia: 3018, piazzia: 327, tulipa: 251, reinmuthia: 263, china: 309, crimea: 751,
      rusthawelia: 328, schorria: 272, silvretta: 263, virtanen: 568, 'mr-spock': 1297, educatio: 320, hopi: 2074,
      schaber: 2811, iau: 267, 'united-nations': 2239, tartaglia: 281, raup: 144, 'asteroid-2001-qw16': 2946, 'asteroid-1999-fr33': 236, patroclus: 8332, polymele: 416, leucus: 453, orus: 600, eurybates: 413,
      // New main-belt additions: ceil(measured endpoint maximum * 1.15) km.
      'thetis': 1718, 'thalia': 302, 'phocaea': 2066, 'euterpe': 675, 'bellona': 284, 'pomona': 1937, 'circe': 1123, 'atalante': 353, 'leda-38': 290, 'laetitia': 1391, 'isis': 3051, 'ariadne': 2078, 'hestia': 277, 'aglaja': 866, 'pales': 384, 'kalypso': 398, 'alexandra': 1216, 'pandora-55': 294, 'melete': 2378, 'elpis': 508, 'erato': 350, 'ausonia': 484, 'asia': 559, 'leto': 3209, 'hesperia': 288, 'niobe': 317, 'feronia': 300, 'klytia': 1860, 'galatea-74': 2252, 'freia': 798, 'eurynome': 266, 'alkmene': 598, 'beatrix': 358, 'klio': 2521, 'io-85': 1596, 'semele': 1339, 'aegina': 791, 'minerva': 235, 'arethusa': 306, 'klotho': 303, 'ianthe': 1049,
      // Expansion: ceil(measured independent endpoint maximum * 1.15) km.
      'hera': 616, 'klymene': 2579, 'artemis': 481, 'dione-106': 279, 'felicitas': 357, 'lydia': 550, 'iphigenia': 338, 'thyra': 610, 'lomia': 287, 'peitho': 240, 'althaea': 251, 'lachesis': 371, 'gerda': 346, 'brunhild': 282, 'alkeste': 302, 'liberatrix': 235, 'velleda': 1156, 'johanna': 274, 'antigone': 370, 'cyrene': 2973, 'sophrosyne': 1667, 'hertha': 214, 'meliboea': 4307, 'siwa': 401, 'vibilia': 268, 'lucina': 1744, 'protogeneia': 332, 'gallia': 293, 'medusa': 288, 'nuwa': 4248, 'abundantia': 1433, 'scylla': 272, 'xanthippe': 383, 'dejanira': 262, 'aemilia': 309, 'una': 271, 'athor': 453, 'laurentia': 407, 'erigone': 268, 'eva': 223, 'loreley': 315, 'rhodope': 262, 'urda': 312, 'sibylla': 597, 'baucis': 625, 'ino': 276, 'phaedra': 237, 'dejopeja': 300, 'lamberta': 2033, 'menippe': 323, 'kolga': 289, 'ambrosia': 333, 'eurykleia': 278, 'byblis': 249, 'kallisto': 231, 'hersilia': 1567, 'hedda': 236, 'dido': 4336, 'isabella': 276, 'medea': 314, 'lilaea': 763, 'aschera': 497, 'oenone': 2639, 'eudora': 232, 'stephania': 541, 'eos': 327, 'henrietta': 256, 'weringia': 510, 'philosophia': 262, 'athamantis': 377, 'vindobona': 238, 'asterope': 263, 'coelestina': 247, 'hypatia': 325, 'vanadis': 291, 'kriemhild': 1514, 'vera': 3131, 'asporina': 1497, 'eukrate': 331, 'ilse': 1261, 'bettina': 1031, 'clementina': 561, 'augusta': 183, 'silesia': 324, 'tyche': 243, 'huberta': 300, 'dresda': 328, 'libussa': 245, 'anna': 711, 'anahita': 303, 'penthesilea': 292, 'antonia': 2286, 'philagoria': 283, 'sapientia': 600, 'adelheid': 300, 'emma': 2307, 'iclea': 298, 'bavaria': 2321, 'clarissa': 725, 'unitas': 150,
      // Expansion: ceil(measured independent endpoint maximum * 1.15) km.
      'annefrank': 394, 'braille': 668,
      // TNO additions: ceil(measured independent endpoint maximum * 1.15) km; https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/trans-neptunian/orbit-errors.json.
      arrokoth: 600, quaoar: 602, gkunhomdima: 631,
      // Bounds retained from the merged Centaur and original population checks.
      'chariklo': 538, 'bienor': 944, 'diomedes': 426, 'ajax': 973, 'ilioneus': 561, 'pyrrhus': 530, 'eumelos': 573, 'lycomedes': 958, 'demodokus': 1682, 'menelaus': 1054, 'agenor': 607, 'mentor': 1444, 'ivar': 375, 'toro': 194, 'cerberus': 341, 'tantalus': 217, 'aethra': 343, 'lyyli': 764, 'hela': 4172, 'kemi': 353, 'taurinensis': 189,
      // SN263: ceil(maximum independently measured 30-day endpoint error * 1.05).
      'asteroid-2001-sn263': 250,
      // Dinkinesh: ceil(991.491 km independent endpoint maximum * 1.05).
      // Retained samples and measured errors: src/objects/dinkinesh/evidence/galileo-lucy/orbit-errors.json.
      dinkinesh: 1042,
      // 3I/ATLAS: ceil(964.450 km independent endpoint maximum * 1.15); two-body path without its fitted non-gravitational acceleration.
      'comet-3i': 1110,
      // 2I/Borisov: ceil(527.705 km independent endpoint maximum * 1.15).
      'comet-2i': 607,
      // Adeona, added with its VLT/SPHERE photograph: ceil(1124.257 km independent endpoint maximum * 1.15).
      adeona: 1293,
      // Centaurs and Kuiper belt objects added 2026-09-21: ceil(independent endpoint maximum * 1.15).
      albion: 620, amycus: 576, asbolus: 661, aya: 626, chiron: 621, crantor: 556, damocles: 518, echeclus: 904, elatus: 574, goibniu: 606, hylonome: 581, nessus: 579, okyrhoe: 954, pelion: 692, pholus: 592, ritona: 596, thereus: 614, uni: 624,
      // Notable DAMIT asteroids added 2026-09-21: ceil(independent endpoint maximum * 1.15).
      apollo: 631, koronis: 2059, karin: 276, datura: 183, hungaria: 505,
      // Nonconvex DAMIT asteroids added 2026-09-25: ceil(independent endpoint maximum * 1.15).
      aspasia: 233, papagena: 2527, ara: 244, aquitania: 243, carlova: 297, siegena: 2807, aurelia: 327, 'asteroid-1999-jv6': 210, nyx: 1152, eger: 592 }
    for (const id of SMALL_BODY_IDS) for (const row of [ASTEROID_FIXTURES[id].rows[0], ASTEROID_FIXTURES[id].rows[2]]) {
      const actual = asteroidPositionKm(id, row.jd)
      expect(Math.hypot(...actual.map((v, i) => v - row.position[i]!))).toBeLessThan(maximumErrorKm[id])
    }
  })
})
