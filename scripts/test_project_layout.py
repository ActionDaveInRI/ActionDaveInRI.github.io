"""Regression checks for the main portfolio and preserved project sources."""
import json
import hashlib
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from check_pages import inspect_layout, Page, local_file
from project_layout import ROOT, SITE_BASE, SITE_REPO, SOURCE_BASE, build_redirects, redirect_page

BASELINE = '8d38d42dfab8e99e70031a0a5831b5e18fc6fad5'


class LayoutTests(unittest.TestCase):
    def test_relocated_runtimes_match_current_release_provenance(self):
        for path in (ROOT/'projects').glob('*/source-provenance.json'):
            manifest = json.loads(path.read_text())
            expected = dict(manifest.get('runtime', {}))
            expected.update((entry['path'], entry['sha256']) for entry in manifest.get('runtime_files', []))
            for name, digest in expected.items():
                actual = hashlib.sha256((path.parent/name).read_bytes()).hexdigest()
                self.assertEqual(actual, digest, (path.parent.name, name))

    def test_collection_html_and_source_archives_are_retained(self):
        previous = subprocess.check_output(['git', '-C', str(ROOT), 'ls-tree', '-r', '--name-only', BASELINE], text=True).splitlines()
        for name in previous:
            if not name.startswith('projects/') or name.startswith('projects/ship-effects/'):
                continue
            if name.endswith('.html'):
                self.assertTrue((ROOT/name).is_file(), name)
            if '/source/' in name or name.endswith('.bundle'):
                original = subprocess.check_output(['git', '-C', str(ROOT), 'show', BASELINE+':'+name])
                self.assertEqual((ROOT/name).read_bytes(), original, name)

    def test_catalog_locations_and_existing_external_projects(self):
        previous = json.loads(subprocess.check_output(['git', '-C', str(ROOT), 'show', BASELINE+':projects.json'], text=True))
        current = json.loads((ROOT/'projects.json').read_text())
        by_id = {p['id']: p for p in current}
        self.assertEqual(len(by_id), len(current))
        self.assertTrue(set(by_id).issuperset(p['id'] for p in previous))
        self.assertGreaterEqual(sum(bool(p.get('image')) for p in current), 15)
        for old in previous:
            new = by_id[old['id']]
            if old['repo'] != 'spaceship':
                self.assertEqual(new, old, old['id'])
            elif old['id'] == 'ship-effects':
                self.assertEqual(new['repo'], 'spaceship')
                self.assertEqual(new['directory'], '.')
                self.assertEqual(new['launch'], SITE_BASE + 'spaceship/')
            else:
                self.assertEqual(new['repo'], SITE_REPO)
                self.assertEqual(new['directory'], old['directory'])
                self.assertEqual(new['source'], SOURCE_BASE + new['directory'])
                self.assertEqual(new['launch'], SITE_BASE + new['directory'] + '/')
                if new.get('live'):
                    self.assertEqual(new['live'], new['launch'])

    def test_same_origin_external_repositories_are_not_local_files(self):
        external = {'petri', 'spaceship', 'radio_chatter_generator'}
        for path in ('petri/classic/', 'spaceship/', 'radio_chatter_generator/versions/tts_09.html'):
            self.assertIsNone(local_file(SITE_BASE + path, 'index.html', external))
            self.assertIsNone(local_file('/' + path, 'projects/wayfarer/index.html', external))
        self.assertEqual(local_file(SITE_BASE + 'projects/wayfarer/?seed=4#start', 'index.html', external), 'projects/wayfarer/index.html')
        self.assertEqual(local_file('./assets/game.js', 'projects/wayfarer/index.html', external), 'projects/wayfarer/assets/game.js')

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
for(const c of cases){const current=new URL(c.source+c.suffix,'https://example.test/');let result;
vm.runInNewContext(c.script,{location:{search:current.search,hash:current.hash,replace:value=>result=new URL(value,current).href}});
const expected=new URL(c.destination+c.suffix,'https://example.test/').href;
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
