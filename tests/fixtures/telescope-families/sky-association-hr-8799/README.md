# HR 8799 with JWST: the paper this route is checked against

*A Candidate Innermost Fifth Planet in the HR 8799 System Revealed by JWST NIRISS Aperture Masking Interferometry* ([arXiv:2609.10507](https://arxiv.org/abs/2609.10507)) publishes both halves of a sky association, which makes it an oracle for `telescope associate`.

- `niriss-ami-2023.csv` is its Table 2, the measured offsets from the star for the four known planets and for the candidate fifth source, on 2023 August 3 UT.
- Its Table 3 gives the `whereistheplanet` prediction for the same date, which `telescope candidates` has to reproduce: b at (1635.41, 532.42), c at (−288.59, 909.70), d at (−606.14, −345.32) and e at (−231.65, 325.88) mas.
- Table 3 also gives the paper's verdict per planet and per axis, comparing its own error bars and leaving out the prediction errors of at most about 2 mas: b and c agree inside 1σ, and d disagrees at 1σ and 2σ in right ascension and at 1σ in declination.

One cell of that table does not follow from its own numbers. Planet e's declination is marked as outside 2σ, but 302.2 ± 13.3 against a prediction of 325.88 is 1.78σ. The test expects the arithmetic, and says so.

The orbits in the registry come from Zurlo et al. 2022, a different fit from the one the prediction tool carries, so the two are not the same numbers by construction.
