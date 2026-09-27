"""Verify the recovered game files, portable entry points and full source bundles."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import subprocess
import tempfile
from release_game import validate_runtime

ROOT = Path(__file__).resolve().parents[1]

def digest(data):
    return hashlib.sha256(data).hexdigest()

class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        assert not (tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh'), 'Game redirects instead of loading'
        if tag in ('script', 'iframe', 'img', 'source', 'audio', 'video') and attrs.get('src'):
            self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            self.urls.append(attrs['href'])

catalog = {p['id']: p for p in json.loads((ROOT/'projects.json').read_text())}
for slug in ('wayfarer', 'silt-and-signal'):
    game = ROOT/slug
    manifest = json.loads((game/'source-provenance.json').read_text())
    history = json.loads((game/'history/versions.json').read_text())
    for item in manifest['runtime_files']:
        actual = (game/item['path']).read_bytes()
        assert digest(actual) == item['sha256'], f'{slug}/{item["path"]} differs from migration manifest'
        original = actual
        if item['change']:
            assert slug == 'wayfarer' and item['path'] == 'index.html'
            original = actual.replace(b'href="./favicon.svg"', b'href="/favicon.svg"')
        assert digest(original) == item['source_sha256'], f'{slug}: unexpected gameplay edit'
    entry = (game/'index.html').read_text()
    validate_runtime({item['path']: (game/item['path']).read_bytes()
                      for item in manifest['runtime_files']})
    parser = Resources()
    parser.feed(entry)
    for url in parser.urls:
        assert not url.startswith(('/', 'http:', 'https:')), f'{slug}: non-portable runtime URL {url}'
        assert (game/url.split('?')[0].split('#')[0]).is_file(), f'{slug}: missing resource {url}'
    assert not any(x in entry for x in ('location.replace(', 'location.assign(', 'chatgpt.site')), f'{slug}: external launcher remains'
    project = catalog[slug]
    assert project['requiresLogin'] is False and project['hosting'] == 'github-pages'
    assert project['launch'] == project['live'] == f'https://actiondaveinri.github.io/spaceship/{slug}/'
    assert project['sourceCommit'] == manifest['source_commit'] == history['source_commit']
    bundle = game/'history'/history['bundle']
    assert digest(bundle.read_bytes()) == history['bundle_sha256'], f'{slug}: damaged source history'
    with tempfile.TemporaryDirectory(prefix='game-history-') as temporary:
        subprocess.run(['git', 'clone', '--quiet', str(bundle), temporary], check=True)
        def git(*args):
            return subprocess.check_output(['git', '-C', temporary, *args], text=True).strip()
        assert int(git('rev-list', '--count', 'HEAD')) == history['source_commit_count']
        assert git('rev-parse', 'HEAD') == history['source_commit']
        for version in history['versions']:
            git('cat-file', '-e', version['commit']+'^{commit}')
        for item in manifest['runtime_files']:
            source = subprocess.check_output(['git', '-C', temporary, 'show', f'{manifest["source_commit"]}:{item["source_path"]}'])
            assert digest(source) == item['source_sha256'], f'{slug}: archived source does not match deployed game'
    print(f'{slug}: {len(manifest["runtime_files"])} game files verified; {history["source_commit_count"]} source commits restored; no login redirect.')
