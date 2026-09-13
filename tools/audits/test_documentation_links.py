"""Exercise documentation checks against small Git repositories, without assets."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

CHECKER = Path(__file__).with_name('check-documentation-links.py').resolve()


class DocumentationChecks(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='cssearth-docs-test-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.git('init', '--quiet')
        self.write('docs/README.md', '# Documentation\n\n[Guide](guide.md)\n')
        self.write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n')
        self.write('docs/images/comparison.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>')
        self.git('add', '.')
        self.git('-c', 'user.name=Documentation test', '-c', 'user.email=test@example.invalid',
                 'commit', '--quiet', '-m', 'Initial documentation')

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, check=True,
                              capture_output=True, text=True)

    def write(self, path, text):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(text)

    def check(self, *args):
        result = subprocess.run([sys.executable, str(CHECKER), *(args or ['--all'])],
                                cwd=self.root, capture_output=True, text=True)
        self.assertIn(result.returncode, (0, 1), result.stderr)
        return result.returncode, json.loads(result.stdout)

    def test_nested_guides_reference_links_and_html_images_are_allowed(self):
        self.write('docs/guide.md', '# Guide\n\n[Detailed method][method]\n\n'
                   '[method]: methods/mapping.md\n')
        self.write('docs/methods/mapping.md', '# Mapping\n\n[Back](../guide.md)\n\n'
                   '<img width="120" src="../images/comparison.svg">\n')
        self.write('tests/fixtures/sample.json', '{}')
        self.write('src/objects/example/source/reference/SOURCE.md', '# Provider notes\n')
        status, result = self.check()
        self.assertEqual(status, 0, result['errors'])
        self.assertEqual(result['documentation']['reachableGuides'], 3)
        self.assertEqual(result['documentation']['usedIllustrations'], 1)

    def test_orphan_cycles_unused_images_raw_output_and_duplicate_accounts_fail(self):
        additions = {
            'docs/orphan-a.md': '# A\n\n[B](orphan-b.md)\n',
            'docs/orphan-b.md': '# B\n\n[A](orphan-a.md)\n',
            'docs/images/unused.png': 'unused image',
            'docs/run.json': '{}',
            'docs/author.py': 'print("a tool, not a guide")',
            'docs/captures.zip': 'archive',
            'src/objects/example/SOURCE.md': '# Duplicate sources',
            'src/objects/example/EVIDENCE.md': '# Duplicate evidence',
            'src/objects/example/USAGE.md': '# Duplicate usage',
        }
        for path, content in additions.items():
            self.write(path, content)
        status, result = self.check()
        self.assertEqual(status, 1)
        self.assertEqual({error['file'] for error in result['errors']}, set(additions))

    def test_diff_mode_checks_non_markdown_additions_and_broken_anchors(self):
        self.write('docs/run.json', '{}')
        self.write('docs/guide.md', '# Guide\n\n[Missing section](README.md#missing)\n\n'
                   '![Comparison](images/comparison.svg)\n')
        status, result = self.check('--base', 'HEAD')
        self.assertEqual(status, 1)
        self.assertEqual({error['reason'] for error in result['errors']}, {
            'missing Markdown anchor',
            'docs/ accepts Markdown guides and illustrations under docs/images/; move code, fixtures and raw output to their owner',
        })

    def test_reference_and_html_targets_are_validated_in_both_modes(self):
        examples = [
            ('[Missing][ref]\n\n[ref]: missing.md', 'missing repository path'),
            ('![ref][]\n\n[ref]: missing.png', 'missing repository path'),
            ('[ref]\n\n[ref]: README.md#absent', 'missing Markdown anchor'),
            ('<img src="missing.png" width="120">', 'missing repository path'),
            ('<img src=missing.png width=120>', 'missing repository path'),
            ("<a href='README.md#absent'>Missing</a>", 'missing Markdown anchor'),
        ]
        for content, reason in examples:
            self.write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n\n' + content)
            for mode in (['--all'], ['--base', 'HEAD']):
                with self.subTest(content=content, mode=mode):
                    status, result = self.check(*mode)
                    self.assertEqual(status, 1)
                    self.assertEqual([error['reason'] for error in result['errors']], [reason])

    def test_examples_unused_references_and_external_links_are_not_local_targets(self):
        self.write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n\n'
                   '[unused]: missing.md\n\n````md\n[Example][ref]\n[ref]: missing.md\n'
                   '<img src="missing.png">\n````\n\n'
                   '[External](https://example.org/)\n<img src="//example.org/image.png">\n'
                   '<a data-href="missing.md" href="README.md#documentation">Index</a>\n'
                   '<!-- <img src="missing.png"> -->\n'
                   '[Guide][  Mixed CASE ]\n\n[mixed case]: <README.md#documentation> "Title"\n')
        status, result = self.check()
        self.assertEqual(status, 0, result['errors'])


if __name__ == '__main__':
    unittest.main()
