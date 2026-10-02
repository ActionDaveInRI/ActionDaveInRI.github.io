"""Behavioral coverage for the legacy address handoff."""
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

from compatibility import BASE, ROOT, build_redirects, read_routes, redirect_page
from check_pages import inspect_layout, source_requests


class CompatibilityTests(unittest.TestCase):
    def test_complete_baseline_and_original_runtime(self):
        self.assertEqual(len(inspect_layout()), 62)

    def test_redirects_keep_queries_and_fragments(self):
        cases = []
        for source, destination in read_routes().items():
            script = re.search(r'<script>(.*?)</script>', (ROOT / source).read_text(), re.S).group(1)
            for suffix in ('', '?seed=123&mode=test#landing-site', '?name=a%2Fb&flag=%26#view%20one'):
                cases.append(dict(source=source, destination=destination, suffix=suffix, script=script))
        javascript = '''const vm=require('node:vm');
const cases=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
for(const c of cases){
 const current=new URL(c.source+c.suffix,'https://actiondaveinri.github.io/spaceship/');let result;
 vm.runInNewContext(c.script,{location:{search:current.search,hash:current.hash,replace:value=>result=new URL(value,current).href}});
 if(result!==c.destination+c.suffix)throw Error(c.source+': '+result);
}'''
        subprocess.run(['node', '-e', javascript], input=json.dumps(cases), text=True, check=True)

    def test_every_directory_has_explicit_and_slashless_checks(self):
        routes = read_routes()
        requests = source_requests(BASE, routes)
        for path in routes:
            self.assertIn(BASE + path, requests)
            if path.endswith('/index.html'):
                directory = BASE + path[:-len('index.html')]
                self.assertIn(directory, requests)
                self.assertIn(directory.rstrip('/'), requests)

    def test_generator_is_repeatable_and_protects_unmanaged_pages(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'pages-redirects.json').write_text(json.dumps({'game/index.html': 'https://actiondaveinri.github.io/projects/game/'}))
            build_redirects(root)
            page = root / 'game/index.html'
            first = page.read_bytes()
            build_redirects(root)
            self.assertEqual(page.read_bytes(), first)
            page.write_text('A real game')
            with self.assertRaisesRegex(ValueError, 'unmanaged'):
                build_redirects(root)
            self.assertEqual(page.read_text(), 'A real game')

    def test_destinations_cannot_loop_to_old_collected_paths(self):
        for source, destination in [('index.html', 'https://actiondaveinri.github.io/'),
                                    ('../index.html', 'https://actiondaveinri.github.io/'),
                                    ('game/index.html', BASE + 'game/'),
                                    ('game/index.html', 'https://example.com/'),
                                    ('game/index.html', 'https://actiondaveinri.github.io/projects/../spaceship/')]:
            with self.subTest(source=source, destination=destination), self.assertRaises(ValueError):
                redirect_page(source, destination)


if __name__ == '__main__':
    unittest.main()
