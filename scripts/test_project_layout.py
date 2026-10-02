"""Regression checks against the complete pre-migration public HTML inventory."""
import json
import hashlib
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from check_pages import inspect_layout, Page, local_file
from project_layout import ROOT, build_redirects, redirect_page

BASELINE = 'ae6080f14efc656708b5cf1d667de8de810cc86a'


class LayoutTests(unittest.TestCase):
    def test_relocated_runtimes_match_current_release_provenance(self):
        for path in (ROOT/'projects').glob('*/source-provenance.json'):
            manifest = json.loads(path.read_text())
            expected = dict(manifest.get('runtime', {}))
            expected.update((entry['path'], entry['sha256']) for entry in manifest.get('runtime_files', []))
            for name, digest in expected.items():
                actual = hashlib.sha256((path.parent/name).read_bytes()).hexdigest()
                self.assertEqual(actual, digest, (path.parent.name, name))

    def test_all_previous_html_entry_points_are_preserved(self):
        previous = subprocess.check_output(['git', '-C', str(ROOT), 'ls-tree', '-r', '--name-only', BASELINE], text=True).splitlines()
        routes = json.loads((ROOT/'pages-redirects.json').read_text())
        for path in previous:
            if not path.endswith('.html'):
                continue
            self.assertTrue((ROOT/path).is_file(), path)
            if '/' in path or path in ('projects.html', 'spaceship_001.html'):
                self.assertIn(path, routes)

    def test_existing_catalog_urls_and_external_locations_are_preserved(self):
        previous = json.loads(subprocess.check_output(['git', '-C', str(ROOT), 'show', BASELINE+':projects.json'], text=True))
        current = json.loads((ROOT/'projects.json').read_text())
        by_id = {p['id']: p for p in current}
        self.assertEqual(len(by_id), len(current))
        for old in previous:
            self.assertIn(old['id'], by_id)
            new = by_id[old['id']]
            for key in ('launch', 'live', 'versions'):
                if old.get(key):
                    self.assertEqual(new.get(key), old[key], (old['id'], key))
            if old['repo'] != 'spaceship':
                for key in ('repo', 'directory', 'source'):
                    self.assertEqual(new[key], old[key], (old['id'], key))

    def test_each_redirect_preserves_query_and_fragment_in_browser_javascript(self):
        routes = json.loads((ROOT/'pages-redirects.json').read_text())
        cases = []
        for source, destination in routes.items():
            text = (ROOT/source).read_text()
            page = Page(text)
            self.assertEqual(local_file(page.refresh, source), destination)
            script = re.search(r'<script>(.*?)</script>', text, re.S).group(1)
            for suffix in ('', '?seed=123&mode=test#landing-site'):
                cases.append(dict(source=source, destination=destination, suffix=suffix, script=script))
        code = '''const vm=require('node:vm');const cases=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
for(const c of cases){const current=new URL(c.source+c.suffix,'https://example.test/spaceship/');let result;
vm.runInNewContext(c.script,{location:{search:current.search,hash:current.hash,replace:value=>result=new URL(value,current).href}});
const expected=new URL(c.destination+c.suffix,'https://example.test/spaceship/').href;
if(result!==expected)throw Error(c.source+': '+result+' != '+expected);}'''
        subprocess.run(['node', '-e', code], input=json.dumps(cases), text=True, check=True)

    def test_layout_resources_exist(self):
        catalog, routes, paths = inspect_layout()
        self.assertGreaterEqual(len(catalog), 22)
        self.assertGreater(len(paths), len(routes))

    def test_generator_is_repeatable_and_refuses_unmanaged_pages(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root/'projects/game').mkdir(parents=True)
            (root/'projects/game/index.html').write_text('Game runtime')
            routes = {'game/index.html': 'projects/game/index.html'}
            (root/'pages-redirects.json').write_text(json.dumps(routes))
            build_redirects(root)
            first = (root/'game/index.html').read_bytes()
            build_redirects(root)
            self.assertEqual((root/'game/index.html').read_bytes(), first)
            (root/'game/index.html').write_text('Unmanaged game')
            with self.assertRaisesRegex(ValueError, 'unmanaged'):
                build_redirects(root)
            self.assertEqual((root/'game/index.html').read_text(), 'Unmanaged game')


if __name__ == '__main__':
    unittest.main()
