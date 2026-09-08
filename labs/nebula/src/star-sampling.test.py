#!/usr/bin/env python3
"""Targeted native-star calibration checks, no neural inference or full extraction."""
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch

import cv2
import numpy as np

spec = importlib.util.spec_from_file_location('star_sampling', Path(__file__).with_name('star-sampling.py'))
sampling = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sampling)


def scene(width=12, neighbor=None, dtype=np.uint16):
    yy, xx = np.mgrid[-160:161, -160:161].astype(float)
    alpha = width/(2*np.sqrt(2**(1/2.5)-1))
    plane = .13 + xx*.0001 + yy*.0002
    signal = .5*sampling.moffat(xx, yy, 0, 0, alpha, alpha, 0, 2.5)
    if neighbor:
        signal += .35*sampling.moffat(xx, yy, neighbor, 0, alpha, alpha, 0, 2.5)
    image = np.stack([plane+signal, plane+signal*.8, plane+signal*.6], axis=2)
    return np.rint(np.clip(image, 0, 1)*np.iinfo(dtype).max).astype(dtype), plane


def scene_with_baseline():
    image, _ = scene(width=12)
    yy, xx = np.mgrid[0:321,0:321]
    profile = np.exp(-((xx-50)**2+(yy-50)**2)/(2*1.2**2))
    profile[profile < .01] = 0
    old = np.rint(profile[:,:,None]*np.array([.3,.24,.18])*65535).astype(np.uint16)
    return (image.astype(np.uint32)+old).astype(np.uint16), old


def write_baseline(folder, source, image, stars):
    folder.mkdir()
    values = {'diffuse.png':image-stars,'stars.png':stars,'star-mask.png':np.where(np.any(stars!=0,axis=2),255,0).astype(np.uint8)}
    for name, pixels in values.items():
        if not cv2.imwrite(str(folder/name),pixels):
            raise AssertionError('Baseline fixture encoding failed.')
    receipt = dict(schema='cssearth-star-separation-receipt@1',status='inspectable-trial',source=source,sourceSha256=source['sha256'],
        verification=dict(encodedRoundTripExact=True,maximumReconstructionErrorCodeValues=0,changedPixelsOutsideMask=0),
        outputs={name:dict(sha256=sampling.sha256(folder/name),bytes=(folder/name).stat().st_size) for name in values})
    path=folder/'receipt.json'
    path.write_text(json.dumps(receipt))
    return dict(receiptPath=str(path),receiptSha256=sampling.sha256(path),outputDirectory=str(folder))


class NativeSampling(unittest.TestCase):
    def test_broad_star_has_no_old_width_ceiling_and_preserves_plane(self):
        image, plane = scene(width=24)
        result, internals = sampling.fit_star(image, dict(x=160, y=160))
        self.assertTrue(result['qualified'], result['metrics'])
        self.assertAlmostEqual(result['metrics']['fwhmPixels'], 24, delta=1)
        self.assertGreater(result['fit']['fittingRadiusPixels'], 48)
        model, residual = sampling.preview_model(internals, sampling.CONTROLS)
        box = result['cutout']
        expected = plane[box['y']:box['y']+box['height'], box['x']:box['x']+box['width']]
        self.assertLess(np.abs(residual[:, :, 0]/65535-expected).max(), .003)
        self.assertTrue(np.array_equal(model.astype(np.uint32)+residual, internals['patch']))

    def test_isolated_centroid_and_rgb_amplitudes(self):
        image, _ = scene(width=6)
        result, _ = sampling.fit_star(image, dict(x=159, y=161))
        self.assertTrue(result['qualified'], result['metrics'])
        self.assertAlmostEqual(result['point']['x'], 160, delta=.15)
        self.assertAlmostEqual(result['point']['y'], 160, delta=.15)
        self.assertAlmostEqual(result['channels'][0]['amplitude'], .3, delta=.02)
        self.assertEqual([r['channel'] for r in result['channels']], ['R', 'G', 'B'])

    def test_crowded_and_saturated_are_not_calibration_samples(self):
        image, _ = scene(width=6, neighbor=13)
        result, _ = sampling.fit_star(image, dict(x=160, y=160))
        self.assertIn('crowded', result['metrics']['flags'])
        self.assertFalse(result['qualified'])
        image[159:162, 159:162] = 65535
        result, _ = sampling.fit_star(image, dict(x=160, y=160))
        self.assertIn('saturated-core', result['metrics']['flags'])
        self.assertFalse(result['qualified'])

    def test_blank_and_extended_filament_not_high_confidence_stars(self):
        image = np.full((101, 101, 3), 30, np.uint8)
        result, _ = sampling.fit_star(image, dict(x=50, y=50))
        self.assertFalse(result['qualified'])
        yy, xx = np.mgrid[-50:51, -50:51]
        filament = 30+100*np.exp(-yy**2/30)
        image[:] = np.rint(filament[:, :, None])
        result, _ = sampling.fit_star(image, dict(x=50, y=50))
        self.assertFalse(result['qualified'])

    def test_controls_preserve_exact_native_accounting(self):
        for dtype in (np.uint8, np.uint16):
            image, _ = scene(dtype=dtype)
            _, internals = sampling.fit_star(image, dict(x=160, y=160))
            for controls in (dict(widthScale=3, amplitudeScale=1.5, betaOverride=1.1),
                             dict(widthScale=.5, amplitudeScale=0, betaOverride=8)):
                model, residual = sampling.preview_model(internals, controls)
                self.assertEqual(residual.dtype, dtype)
                self.assertTrue(np.array_equal(model.astype(np.uint32)+residual, internals['patch']))

    def test_calibration_uses_only_qualified_selected_samples(self):
        sample = dict(qualified=True, metrics=dict(fwhmPixels=10, beta=3))
        rejected = dict(qualified=False, metrics=dict(fwhmPixels=100, beta=7))
        result = sampling.calibration([sample, rejected], sampling.CONTROLS)
        self.assertEqual(result['qualifiedCount'], 1)
        self.assertEqual(result['fwhmMedianPixels'], 10)
        self.assertIsNone(sampling.calibration([rejected], sampling.CONTROLS)['fwhmMedianPixels'])

    def test_request_pins_and_real_png_outputs(self):
        with tempfile.TemporaryDirectory(prefix='star-sampling-', dir=Path('.local')) as directory:
            folder = Path(directory)
            image, _ = scene(dtype=np.uint8)
            source = folder/'native.png'
            self.assertTrue(cv2.imwrite(str(source), image))
            request = dict(schema='cssearth-star-sampling@1', operation='inspect',
                source=dict(path=str(source), sha256=sampling.sha256(source), nativeDimensions=[321, 321]),
                point=dict(x=160, y=160), outputDirectory=str(folder/'sample'))
            result = sampling.run(request)
            self.assertEqual(result['nativeDimensions'], [321, 321])
            self.assertTrue(result['samples'][0]['previewAccountingExact'])
            self.assertTrue((folder/'sample'/'result.json').is_file())
            restored = cv2.imread(str(folder/'sample'/result['samples'][0]['images']['source']), cv2.IMREAD_UNCHANGED)
            box = result['samples'][0]['cutout']
            self.assertTrue(np.array_equal(restored, image[box['y']:box['y']+box['height'], box['x']:box['x']+box['width']]))
            request['source']['sha256'] = '0'*64
            with self.assertRaisesRegex(ValueError, 'hash'):
                sampling.run(request)

    def test_invalid_controls_and_points_rejected(self):
        for controls in ({'widthScale': 4}, {'amplitudeScale': float('nan')}, {'betaOverride': True}, {'unrecognized': 1}):
            with self.assertRaises(ValueError):
                sampling.settings(controls=controls)
        with self.assertRaises(ValueError):
            sampling.point_value(dict(x=-1, y=5), np.zeros((10, 10, 3), np.uint8))

    def test_overview_snap_and_preview_seed_are_stable(self):
        image, _ = scene(width=10)
        seed = sampling.snap_point(image, dict(x=181, y=170))
        self.assertEqual(seed, dict(x=160, y=160))
        first, _ = sampling.fit_star(image, seed)
        replay, _ = sampling.fit_star(image, first['requestedPoint'])
        self.assertEqual(replay['point'], first['point'])
        self.assertEqual(replay['fit'], first['fit'])

    def test_catalogue_is_supplemented_with_broad_native_peaks(self):
        with tempfile.TemporaryDirectory(prefix='star-discovery-', dir=Path('.local')) as directory:
            folder = Path(directory)
            image, _ = scene(width=24)
            source = dict(path=str(folder/'source.png'), sha256='a'*64, nativeDimensions=[321, 321])
            catalogue = folder/'catalogue.json'
            catalogue.write_text(json.dumps(dict(image=source, nativePixelCentres=[], count=0)))
            points, method = sampling.catalogue_points(image, source,
                dict(path=str(catalogue), sha256=sampling.sha256(catalogue)), 100)
            self.assertIn('plus-bounded-multiscale', method)
            self.assertTrue(any(np.hypot(x-160, y-160) < 3 for x, y in points), points)

    def test_fit_cache_replays_without_fitting_for_changed_controls(self):
        with tempfile.TemporaryDirectory(prefix='star-fit-cache-', dir=Path('.local')) as directory:
            image, _ = scene()
            sample, state, hit = sampling.cached_fit(image, 'a'*64, dict(x=160., y=160.), 128, Path(directory))
            self.assertFalse(hit)
            with patch.object(sampling, 'fit_star', side_effect=AssertionError('Cache must avoid fitting')):
                replay, restored, hit = sampling.cached_fit(image, 'a'*64, sample['requestedPoint'], 128, Path(directory))
            self.assertTrue(hit)
            self.assertEqual(sample, replay)
            controls = dict(widthScale=1.7, amplitudeScale=.8, betaOverride=3)
            expected = sampling.preview_model(state, controls)
            actual = sampling.preview_model(restored, controls)
            self.assertTrue(all(np.array_equal(a, b) for a, b in zip(actual, expected)))

    def test_new_broad_reference_changes_heldout_acceptance_and_mask(self):
        narrow_image, _ = scene(width=6)
        broad_image, _ = scene(width=20)
        heldout_image, plane = scene(width=21)
        narrow, narrow_state = sampling.fit_star(narrow_image, dict(x=160, y=160))
        broad, _ = sampling.fit_star(broad_image, dict(x=160, y=160))
        broad['id'] = 'separate-broad-reference'
        heldout, state = sampling.fit_star(heldout_image, dict(x=160, y=160))
        narrow_bank = sampling.profile_bank([narrow])
        model, residual, mask, verdict = sampling.bank_preview(heldout, state, narrow_bank)
        self.assertFalse(verdict['accepted'])
        self.assertIn('outside-learned-profile-coverage', verdict['reasons'])
        self.assertFalse(mask.any())
        self.assertTrue(np.array_equal(residual, state['patch']))
        learned = sampling.profile_bank([narrow, broad])
        self.assertGreater(max(p['detectionSigmaPixels'] for p in learned), narrow_bank[0]['detectionSigmaPixels']*3)
        model, residual, mask, verdict = sampling.bank_preview(heldout, state, learned)
        self.assertTrue(verdict['accepted'], verdict)
        self.assertGreater(np.count_nonzero(mask), 4000)
        self.assertTrue(np.array_equal(model.astype(np.uint32)+residual, state['patch']))
        self.assertTrue(np.array_equal(residual[mask == 0], state['patch'][mask == 0]))
        box = heldout['cutout']
        floor = plane[box['y']:box['y']+box['height'], box['x']:box['x']+box['width']]
        self.assertGreater((residual[:, :, 0]/65535-floor).min(), -.002)
        self.assertTrue(sampling.bank_preview(narrow, narrow_state, learned)[-1]['accepted'])
        self.assertEqual(sampling.remove_with_bank(heldout_image, narrow_bank)[3]['accepted'], 0)
        self.assertEqual(sampling.remove_with_bank(heldout_image, learned)[3]['accepted'], 1)

    def test_shared_bank_rejects_filament_saturation_and_crowding(self):
        image, _ = scene(width=6)
        reference, _ = sampling.fit_star(image, dict(x=160, y=160))
        bank = sampling.profile_bank([reference])
        crowded, _ = scene(width=6, neighbor=13)
        saturated = image.copy()
        saturated[159:162, 159:162] = 65535
        yy, xx = np.mgrid[-160:161, -160:161]
        filament = np.repeat(np.rint(10000+20000*np.exp(-yy**2/20))[:, :, None], 3, axis=2).astype(np.uint16)
        for candidate in (crowded, saturated, filament):
            sample, state = sampling.fit_star(candidate, dict(x=160, y=160))
            self.assertFalse(sample['qualified'], sample['metrics'])
            self.assertEqual(sampling.profile_bank([sample]), [])
            model, residual, mask, verdict = sampling.bank_preview(sample, state, bank)
            self.assertFalse(verdict['accepted'])
            self.assertFalse(mask.any())
            self.assertTrue(np.array_equal(residual, state['patch']))

    def test_calibrated_detector_uses_bank_and_excludes_reference_positions(self):
        image, _ = scene(width=12)
        sample, _ = sampling.fit_star(image, dict(x=160, y=160))
        bank = sampling.profile_bank([sample])
        self.assertEqual(sampling.bank_candidates(image, [], []), [])
        candidates = sampling.bank_candidates(image, bank, [])
        self.assertTrue(any(np.hypot(x-160, y-160) < 3 for x, y in candidates))
        self.assertFalse(any(np.hypot(x-160, y-160) < 32 for x, y in sampling.bank_candidates(image, bank, [sample])))

    def test_apply_retains_native_grid_background_and_unaffected_pixels(self):
        image, _ = scene(width=12)
        reference, _ = sampling.fit_star(image, dict(x=160, y=160))
        bank = sampling.profile_bank([reference])
        diffuse, stars, mask, counts, rejected, matches = sampling.remove_with_bank(image, bank, limits={'tileSize':128})
        self.assertEqual(diffuse.shape, image.shape)
        self.assertEqual(diffuse.dtype, image.dtype)
        self.assertEqual(counts['accepted'], 1, rejected)
        self.assertEqual(len(matches), 1)
        self.assertTrue(np.array_equal(diffuse.astype(np.uint32)+stars, image))
        self.assertTrue(np.array_equal(diffuse[mask == 0], image[mask == 0]))
        self.assertGreater(np.count_nonzero(stars), 0)
        blank = np.full_like(image, 10000)
        diffuse, stars, mask, counts, _, _ = sampling.remove_with_bank(blank, bank)
        self.assertEqual(counts['detected'], 0)
        self.assertTrue(np.array_equal(diffuse, blank))
        self.assertFalse(mask.any())

    def test_apply_screen_never_bypasses_existing_quality_guards(self):
        image, _ = scene(width=12)
        reference, state = sampling.fit_star(image, dict(x=160, y=160))
        bank = sampling.profile_bank([reference])
        rejected_sample = {**reference, 'qualified':False, 'metrics':{**reference['metrics'],'flags':['saturated-core']}}
        with patch.object(sampling, 'fit_star', return_value=(rejected_sample,state)):
            diffuse, _, mask, counts, rejected, _ = sampling.remove_with_bank(image, bank)
        self.assertEqual(counts['verified'], 1)
        self.assertEqual(counts['accepted'], 0)
        self.assertEqual(rejected['saturated-core'], 1)
        self.assertTrue(np.array_equal(diffuse, image))
        self.assertFalse(mask.any())

    def test_apply_budget_fails_instead_of_truncating(self):
        image, _ = scene(width=12)
        reference, _ = sampling.fit_star(image, dict(x=160, y=160))
        bank = sampling.profile_bank([reference])
        yy, xx = np.mgrid[0:321, 0:321].astype(float)
        alpha = 12/(2*np.sqrt(2**(1/2.5)-1))
        extra = sampling.moffat(xx, yy, 80, 80, alpha, alpha, 0, 2.5)[:, :, None]*np.array([.3,.24,.18])
        image = np.rint(np.clip(image/65535+extra,0,1)*65535).astype(np.uint16)
        for limits, reason in (({'maximumDetections':1},'detector capacity'),({'maximumVerifications':1},'verification capacity')):
            with self.assertRaisesRegex(ValueError, reason):
                sampling.remove_with_bank(image, bank, limits=limits)

    def test_apply_cli_pinned_recipe_and_native_artifacts(self):
        with tempfile.TemporaryDirectory(prefix='star-apply-',dir=Path('.local')) as directory:
            folder = Path(directory)
            image, baseline_stars = scene_with_baseline()
            native = folder/'source.png'
            self.assertTrue(cv2.imwrite(str(native),image))
            source = dict(path=str(native),sha256=sampling.sha256(native),nativeDimensions=[321,321])
            reference, _ = sampling.fit_star(image,dict(x=160,y=160))
            points = [reference['requestedPoint']]
            recipe = dict(schema='cssearth-star-profile-bank@1',source=source,scope='native-cutout-validation',
                referencePoints=points,profileBank=sampling.profile_bank([reference]),excludedReferenceIds=[],scriptSha256=sampling.sha256(sampling.__file__))
            pin = folder/'bank-recipe.json'
            pin.write_text(json.dumps(recipe))
            request = dict(schema='cssearth-star-sampling@1',operation='apply',source=source,points=points,
                calibration=dict(recipePath=str(pin),recipeSha256=sampling.sha256(pin)),outputDirectory=str(folder/'applied'),
                baseline=write_baseline(folder/'baseline',source,image,baseline_stars))
            completed = subprocess.run([sys.executable,sampling.__file__],input=json.dumps(request),text=True,capture_output=True)
            self.assertEqual(completed.returncode,0,completed.stderr)
            self.assertEqual(json.loads(completed.stdout.splitlines()[-1])['stage'],'complete')
            result = json.loads((folder/'applied'/'result.json').read_text())
            self.assertEqual(result['appliedImage']['counts']['accepted'],1)
            self.assertTrue(result['appliedImage']['verification']['encodedRoundTripExact'])
            self.assertEqual(result['appliedImage']['verification']['baselineRestoredPixels'],0)
            self.assertEqual(result['appliedImage']['baselineReceiptSha256'],request['baseline']['receiptSha256'])
            for name, digest in result['artifactSha256'].items():
                self.assertEqual(sampling.sha256(folder/'applied'/name),digest)
            diffuse = cv2.imread(str(folder/'applied'/'diffuse.png'),cv2.IMREAD_UNCHANGED)
            stars = cv2.imread(str(folder/'applied'/'stars.png'),cv2.IMREAD_UNCHANGED)
            self.assertTrue(np.array_equal(diffuse.astype(np.uint32)+stars,image))
            self.assertTrue(np.all(stars >= baseline_stars))
            self.assertTrue(np.array_equal(diffuse[50,50],image[50,50]-baseline_stars[50,50]))
            self.assertEqual(sampling.sha256(native),source['sha256'])
            request['calibration']['recipeSha256']='0'*64
            with self.assertRaisesRegex(ValueError,'hash'):
                sampling.run(request)

    def test_steep_edge_patch_does_not_abort_with_infeasible_initializer(self):
        gradient = np.repeat(np.repeat(np.rint(np.linspace(0,255,8))[None,:,None],8,axis=0),3,axis=2).astype(np.uint8)
        result, state = sampling.fit_star(gradient,dict(x=3,y=3))
        self.assertTrue(result['fit']['initializerClamped'])
        self.assertFalse(result['qualified'])
        self.assertTrue(np.isfinite(state['parameters']).all())

    def test_apply_extends_baseline_without_restoration_or_double_subtraction(self):
        image, old = scene_with_baseline()
        reference, _ = sampling.fit_star(image,dict(x=160,y=160))
        bank = sampling.profile_bank([reference])
        _, bank_stars, _, counts, _, _ = sampling.remove_with_bank(image,bank)
        self.assertEqual(counts['accepted'],1)
        # An approved star outside the new width bank, plus overlap at the new matched star.
        baseline = np.maximum(old,bank_stars//2)
        baseline_mask = np.where(np.any(baseline!=0,axis=2),255,0).astype(np.uint8)
        before_stars, before_mask = baseline.copy(), baseline_mask.copy()
        diffuse, stars, mask, counts, _, _ = sampling.remove_with_bank(image,bank,baseline_stars=baseline,baseline_mask=baseline_mask)
        self.assertEqual(counts['extended'],1)
        self.assertTrue(np.array_equal(stars,np.maximum(baseline,bank_stars)))
        self.assertTrue(np.array_equal(diffuse.astype(np.uint32)+stars,image))
        self.assertTrue(np.array_equal(diffuse[mask==0],image[mask==0]))
        self.assertTrue(np.array_equal(diffuse[50,50],image[50,50]-old[50,50]))
        self.assertGreater(int(stars[160,160,0]),int(baseline[160,160,0]))
        self.assertTrue(np.array_equal(baseline,before_stars))
        self.assertTrue(np.array_equal(baseline_mask,before_mask))

    def test_selected_references_bypass_only_discovery_screening(self):
        image, _ = scene(width=12)
        reference,state = sampling.fit_star(image,dict(x=160,y=160))
        bank = sampling.profile_bank([reference])
        with patch.object(sampling,'screen_candidate',return_value=(False,'screen-test-veto')):
            rejected = sampling.remove_with_bank(image,bank)
            applied = sampling.remove_with_bank(image,bank,reference_points=[reference['requestedPoint']])
        self.assertEqual(rejected[3]['accepted'],0)
        self.assertEqual(applied[3]['accepted'],1)
        self.assertEqual(applied[3]['referenceVerified'],1)
        self.assertTrue(applied[5][0]['selectedReference'])
        with patch.object(sampling.ndimage,'gaussian_filter',side_effect=lambda data,*args,**kwargs:np.zeros_like(data)):
            missed_detection=sampling.remove_with_bank(image,bank,reference_points=[reference['requestedPoint']])
        self.assertEqual(missed_detection[3]['detected'],0)
        self.assertEqual(missed_detection[3]['accepted'],1)
        bad = {**reference,'qualified':False,'metrics':{**reference['metrics'],'flags':['poor-profile-fit']}}
        with patch.object(sampling,'fit_star',return_value=(bad,state)):
            denied = sampling.remove_with_bank(image,bank,reference_points=[reference['requestedPoint']])
        self.assertEqual(denied[3]['accepted'],0)
        self.assertTrue(np.array_equal(denied[0],image))

    def test_calibration_reference_images_show_actual_bank_verdict_and_mask(self):
        with tempfile.TemporaryDirectory(prefix='bank-reference-',dir=Path('.local')) as directory:
            folder=Path(directory)
            image,_=scene_with_baseline()
            image[49:52,49:52]=65535
            source=folder/'source.png'
            self.assertTrue(cv2.imwrite(str(source),image))
            request=dict(schema='cssearth-star-sampling@1',operation='preview',
                source=dict(path=str(source),sha256=sampling.sha256(source),nativeDimensions=[321,321]),
                points=[dict(x=160,y=160),dict(x=50,y=50)],outputDirectory=str(folder/'preview'))
            result=sampling.run(request)
            self.assertEqual(result['calibration']['matchedReferenceCount'],1)
            matched,rejected=result['samples']
            self.assertTrue(matched['accepted'])
            self.assertTrue(matched['contributesProfile'])
            self.assertFalse(rejected['accepted'])
            self.assertFalse(rejected['contributesProfile'])
            self.assertTrue(rejected['reasons'])
            self.assertEqual(rejected['reasons'],rejected['metrics']['flags'])
            for sample in result['samples']:
                model=cv2.imread(str(folder/'preview'/sample['images']['model']),cv2.IMREAD_UNCHANGED)
                mask=cv2.imread(str(folder/'preview'/sample['images']['mask']),cv2.IMREAD_UNCHANGED)
                self.assertFalse(np.any(model[mask==0]))
                self.assertEqual(result['artifactSha256'][sample['images']['mask']],sampling.sha256(folder/'preview'/sample['images']['mask']))
            self.assertFalse(cv2.imread(str(folder/'preview'/rejected['images']['model']),cv2.IMREAD_UNCHANGED).any())


if __name__ == '__main__':
    unittest.main()
