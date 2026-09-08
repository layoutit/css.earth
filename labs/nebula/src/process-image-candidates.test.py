import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import cv2
import numpy as np

spec = importlib.util.spec_from_file_location('batch', Path(__file__).with_name('process-image-candidates.py'))
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)


class BatchGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.plan_path = self.directory / 'plan.json'
        self.report_path = self.directory / 'report.json'
        self.catalogue_path = self.directory / 'catalogue.json'
        self.plan = {'schema': 'cssearth-image-processing-plan@1', 'catalogue': str(self.catalogue_path),
                     'alignmentReport': {'path': str(self.report_path)}, 'selections': []}
        self.report = {'status': 'passed', 'pass': True, 'selectedIds': [], 'sources': []}
        self.catalogue = {'targets': [{'images': []}]}
        self.recipes = []
        for candidate_id in ['first', 'second']:
            image_path = self.directory / (candidate_id + '.png')
            cv2.imwrite(str(image_path), np.full((3, 4, 3), 80, np.uint8))
            source = {'path': str(image_path), 'sha256': batch.digest(image_path), 'nativeDimensions': [4, 3]}
            recipe_path = self.directory / (candidate_id + '.json')
            recipe = {'schema': 'cssearth-star-separation@1', 'source': source,
                      'outputDirectory': str(self.directory / '.local' / candidate_id)}
            self.recipes.append((recipe_path, recipe))
            gate_path = self.directory / (candidate_id + '-gate.json')
            self.write(gate_path, {'pass': True})
            self.plan['selections'].append({'id': candidate_id, 'recipe': str(recipe_path)})
            self.report['selectedIds'].append(candidate_id)
            wcs = {'fixture': candidate_id}
            self.report['sources'].append({'id': candidate_id, 'status': 'passed', 'pass': True,
                'sourcePath': str(image_path), 'sourceSha256': source['sha256'], 'sourceDimensions': [4, 3],
                'gate': {'path': str(gate_path), 'sha256': batch.digest(gate_path)},
                'geometry': {'kind': 'fixed-publisher-wcs', 'wcs': wcs}})
            self.catalogue['targets'][0]['images'].append({'id': candidate_id, 'path': str(image_path),
                                                         'sha256': source['sha256'], 'wcs': wcs})
        self.persist()

    def write(self, path, value):
        Path(path).write_text(json.dumps(value))

    def persist(self):
        for selection, (path, recipe) in zip(self.plan['selections'], self.recipes):
            self.write(path, recipe)
            selection['recipeSha256'] = batch.digest(path)
        self.write(self.report_path, self.report)
        self.plan['alignmentReport']['sha256'] = batch.digest(self.report_path)
        self.write(self.catalogue_path, self.catalogue)
        self.write(self.plan_path, self.plan)

    def test_valid_preflight_never_starts_processing_in_check_only(self):
        with patch.object(batch, 'process_recipe') as process:
            self.assertEqual(len(batch.run(self.plan_path, check_only=True)), 2)
            process.assert_not_called()

    def test_second_source_failure_prevents_first_job(self):
        Path(self.recipes[1][1]['source']['path']).write_bytes(b'altered image')
        with patch.object(batch, 'process_recipe') as process:
            with self.assertRaisesRegex(ValueError, 'Existing source SHA256'):
                batch.run(self.plan_path)
            process.assert_not_called()

    def test_active_registration_cannot_change_after_alignment(self):
        self.catalogue['targets'][0]['images'][1]['registration'] = {'imageToReferenceMatrix': [1, 0, 12]}
        self.persist()
        with self.assertRaisesRegex(ValueError, 'geometry'):
            batch.preflight(self.plan_path)

    def test_invalid_second_recipe_parameters_prevent_all_jobs(self):
        self.recipes[1][1]['parameters'] = {'maximumMaskRadius': 0}
        self.persist()
        with patch.object(batch, 'process_recipe') as process:
            with self.assertRaisesRegex(ValueError, 'Invalid positive parameter'):
                batch.run(self.plan_path)
            process.assert_not_called()

    def test_altered_report_and_underlying_gate_fail_hashes(self):
        self.report_path.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'Pinned JSON hash'):
            batch.preflight(self.plan_path)
        self.persist()
        Path(self.report['sources'][1]['gate']['path']).write_text('{}')
        with self.assertRaisesRegex(ValueError, 'Pinned JSON hash'):
            batch.preflight(self.plan_path)

    def test_unapproved_and_wrong_native_dimensions_are_rejected(self):
        self.report['sources'][1]['pass'] = False
        self.persist()
        with self.assertRaisesRegex(ValueError, 'passing alignment'):
            batch.preflight(self.plan_path)
        self.report['sources'][1]['pass'] = True
        self.recipes[1][1]['source']['nativeDimensions'] = [40, 30]
        self.persist()
        with self.assertRaisesRegex(ValueError, 'Recipe source'):
            batch.preflight(self.plan_path)

    def test_exit_zero_without_fresh_complete_evidence_is_failure(self):
        class EmptyProcess:
            stdout = []
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def wait(self): return 0
        with patch.object(batch.subprocess, 'Popen', return_value=EmptyProcess()):
            with self.assertRaisesRegex(ValueError, 'fresh positive'):
                batch.process_recipe(self.plan['selections'][0], self.recipes[0][1])

    def test_complete_line_cannot_reuse_an_old_receipt(self):
        destination = Path(self.recipes[0][1]['outputDirectory'])
        destination.mkdir(parents=True)
        self.write(destination / 'receipt.json', {'status': 'inspectable-trial'})
        class StaleProcess:
            stdout = ['{"stage":"complete"}\n']
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def wait(self): return 0
        with patch.object(batch.subprocess, 'Popen', return_value=StaleProcess()):
            with self.assertRaisesRegex(ValueError, 'fresh positive'):
                batch.process_recipe(self.plan['selections'][0], self.recipes[0][1])

    def test_real_no_star_source_completes_with_bound_zero_count_artifacts(self):
        self.plan['selections'] = self.plan['selections'][:1]
        self.persist()
        batch.run(self.plan_path)
        destination = Path(self.recipes[0][1]['outputDirectory'])
        receipt = batch.document(destination / 'receipt.json')
        self.assertEqual(receipt['detectedCount'], 0)
        self.assertEqual(receipt['acceptedCount'], 0)
        source = cv2.imread(self.recipes[0][1]['source']['path'], cv2.IMREAD_UNCHANGED)
        diffuse = cv2.imread(str(destination / 'diffuse.png'), cv2.IMREAD_UNCHANGED)
        self.assertTrue(np.array_equal(source, diffuse))


if __name__ == '__main__':
    unittest.main()
