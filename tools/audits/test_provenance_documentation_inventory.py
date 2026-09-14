"""Inventory committed and staged body records without executing registry code."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

INVENTORY = Path(__file__).with_name('provenance-documentation-inventory.py').resolve()


class ProvenanceInventory(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='cssearth-inventory-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.git('init', '--quiet')
        self.write('site/objects.mts', "import body from '../src/objects/example/object.json';\n")
        self.write('src/objects/example/object.json', {'id': 'example', 'properties': {}})
        self.write('src/objects/example/source/manifest.json', {'inputs': [], 'documents': []})
        self.write('src/objects/example/README.md', '# Example\n')
        self.commit()

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, check=True,
                              capture_output=True, text=True)

    def write(self, path, value):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(value if isinstance(value, str) else json.dumps(value))

    def commit(self):
        self.git('add', '.')
        self.git('-c', 'user.name=Inventory test', '-c', 'user.email=test@example.invalid',
                 'commit', '--quiet', '-m', 'Fixture snapshot')

    def run_inventory(self, *args):
        report = self.root / 'inventory.json'
        result = subprocess.run([sys.executable, str(INVENTORY), '--repo', str(self.root),
                                 '--ref', 'HEAD', '--output', str(report), *args],
                                capture_output=True, text=True)
        return result, json.loads(report.read_text()) if result.returncode == 0 else None

    def test_legacy_imports_report_actual_missing_records(self):
        result, report = self.run_inventory()
        self.assertEqual(result.returncode, 0, result.stderr)
        snapshot = report['snapshots'][0]
        self.assertEqual(snapshot['registeredBodies'], 1)
        self.assertEqual(snapshot['bodyEntryPoints']['README.md'], 1)
        self.assertEqual(snapshot['missingRequiredFilesByRegisteredBody']['NOTICE.md'], ['example'])

    def test_catalogue_reads_selected_snapshot_and_excludes_unregistered_folders(self):
        self.write('site/objects.mts', "import { OBJECT_DESCRIPTORS } from './prepared-object-catalog.mts';\nthrow Error('Never execute');\n")
        self.write('src/objects/example/object.json', {'id': 'example', 'properties': {'catalog': {}}})
        self.write('src/objects/unregistered/object.json', {'id': 'unregistered', 'properties': {}})
        self.commit()
        (self.root / 'src/objects/example/README.md').unlink()
        self.git('add', '-u')
        # Dirty working bytes must not change either Git snapshot.
        self.write('src/objects/example/object.json', 'not JSON')
        result, report = self.run_inventory('--ref', 'HEAD^', '--index')
        self.assertEqual(result.returncode, 0, result.stderr)
        current, legacy, staged = report['snapshots']
        self.assertEqual(current['registryBasis'], 'descriptor properties.catalog')
        self.assertEqual(legacy['registryBasis'], 'legacy static descriptor imports')
        self.assertEqual([s['registeredBodies'] for s in report['snapshots']], [1, 1, 1])
        self.assertEqual(current['bodyEntryPoints']['README.md'], 1)
        self.assertEqual(staged['missingRequiredFilesByRegisteredBody']['README.md'], ['example'])
        self.assertTrue(report['indexUnchangedDuringRead'])

    def test_empty_or_mismatched_catalogue_cannot_report_success(self):
        self.write('site/objects.mts', "import { OBJECT_DESCRIPTORS } from './prepared-object-catalog.mts';\n")
        self.commit()
        result, _ = self.run_inventory()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('No registered bodies found', result.stderr)
        self.write('src/objects/example/object.json', {'id': 'different', 'properties': {'catalog': {}}})
        self.commit()
        result, _ = self.run_inventory()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Invalid catalogue identity', result.stderr)

    def test_duplicate_html_counts_separate_working_bytes_from_unique_blobs(self):
        page = '<html>Source paper</html>'
        for name in ('first.html', 'second.HTM'):
            self.write('src/objects/example/source/reference/' + name, page)
        self.commit()
        result, report = self.run_inventory()
        self.assertEqual(result.returncode, 0, result.stderr)
        html = report['snapshots'][0]['sourceHtml']
        self.assertEqual(html['files'], 2)
        self.assertEqual(html['bytes'], len(page.encode()) * 2)
        self.assertEqual(html['uniqueBlobs'], 1)
        self.assertEqual(html['uniqueBlobBytes'], len(page.encode()))
        self.assertEqual(html['duplicateWorkingBytes'], len(page.encode()))


if __name__ == '__main__':
    unittest.main()
