#!/usr/bin/env python3
"""Release safety tests using disposable source and gallery repositories."""
import contextlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import release_game as release


def snapshot(path):
    return {str(p.relative_to(path)): p.read_bytes() for p in path.rglob('*') if p.is_file()}


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.gallery = self.root/'source', self.root/'gallery'
        self.source.mkdir()
        self.gallery.mkdir()
        release.git(self.source, 'init', '--quiet')
        release.git(self.source, 'config', 'user.name', 'Release Test')
        release.git(self.source, 'config', 'user.email', 'test@example.invalid')
        runtime = self.source/'dist'
        runtime.mkdir()
        (runtime/'index.html').write_text('<script type="module" src="./game.js"></script>')
        (runtime/'game.js').write_text("import {value} from './old.js';\nconsole.log(value);\n")
        (runtime/'old.js').write_text('export const value=1;\n')
        self.first = self.commit('First version')
        self.game = self.gallery/'silt-and-signal'
        (self.game/'history').mkdir(parents=True)
        files, entries = release.export_source(self.source, self.first, 'silt-and-signal')
        for name, data in files.items():
            (self.game/name).write_bytes(data)
        (self.game/'README.md').write_text('Keep this documentation.')
        (self.game/'preview.jpg').write_bytes(b'Keep this screenshot.')
        bundle = self.game/'history/source-history.bundle'
        release.git(self.source, 'bundle', 'create', str(bundle), '--all')
        self.manifest = dict(title='Silt + Signal', sites_version=1, source_commit=self.first,
                             source_directory='dist', original_site='https://example.invalid',
                             recovered_on='2026-09-27', runtime_files=entries)
        self.history = dict(title='Silt + Signal', latest_version=1, source_commit=self.first,
                            source_commit_count=1, bundle='source-history.bundle',
                            bundle_sha256=release.digest(bundle.read_bytes()),
                            versions=[dict(version=1, commit=self.first, date='old', subject='First version')])
        (self.game/'source-provenance.json').write_bytes(release.encoded(self.manifest))
        (self.game/'history/versions.json').write_bytes(release.encoded(self.history))
        (self.gallery/'projects.json').write_bytes(release.encoded([dict(
            id='silt-and-signal', sourceVersion=1, sourceCommit=self.first, note='old',
            launch='https://custom.example/games/silt/', live='https://custom.example/games/silt/')]))

    def commit(self, message):
        release.git(self.source, 'add', '.')
        release.git(self.source, 'commit', '--quiet', '-m', message)
        return release.git(self.source, 'rev-parse', 'HEAD').decode().strip()

    def next_version(self):
        (self.source/'dist/old.js').unlink()
        (self.source/'dist/new.js').write_text('export const value=2;\n')
        (self.source/'dist/game.js').write_text("import {value} from './new.js';\nconsole.log(value);\n")
        return self.commit('Next version')

    def run_release(self, commit, version, apply=False):
        args = ['--game', 'silt-and-signal', '--source', str(self.source), '--commit', commit,
                '--sites-version', str(version), '--gallery', str(self.gallery)]
        if apply:
            args.append('--apply')
        with contextlib.redirect_stdout(io.StringIO()) as output:
            result = release.main(args)
        return result, output.getvalue()

    def test_same_revision_dry_run_and_apply_are_noops(self):
        before, source = snapshot(self.gallery), snapshot(self.source)
        for apply in (False, True):
            code, output = self.run_release(self.first, 1, apply)
            self.assertEqual(code, 0, output)
            self.assertIn('Already current', output)
            self.assertEqual(snapshot(self.gallery), before)
            self.assertEqual(snapshot(self.source), source)

    def test_next_release_dry_run_then_apply_preserves_history_and_prunes_owned_file(self):
        second = self.next_version()
        before, source = snapshot(self.gallery), snapshot(self.source)
        code, output = self.run_release(second, 2)
        self.assertEqual(code, 0, output)
        self.assertEqual(snapshot(self.gallery), before)
        self.assertEqual(snapshot(self.source), source)
        code, output = self.run_release(second, 2, True)
        self.assertEqual(code, 0, output)
        self.assertFalse((self.game/'old.js').exists())
        self.assertEqual((self.game/'new.js').read_bytes(), (self.source/'dist/new.js').read_bytes())
        for name in ('README.md', 'preview.jpg'):
            self.assertEqual((self.game/name).read_bytes(), before['silt-and-signal/'+name])
        history = json.loads((self.game/'history/versions.json').read_text())
        self.assertEqual(history['versions'][1:], self.history['versions'])
        restored = self.root/'restored'
        subprocess.run(['git', 'clone', '--quiet', str(self.game/'history/source-history.bundle'),
                        str(restored)], check=True)
        self.assertEqual(release.git(restored, 'rev-parse', 'HEAD').decode().strip(), second)
        self.assertEqual(int(release.git(restored, 'rev-list', '--count', 'HEAD')), 2)
        release.git(restored, 'cat-file', '-e', self.first+'^{commit}')
        self.assertEqual(snapshot(self.source), source)
        catalog = json.loads((self.gallery/'projects.json').read_text())[0]
        self.assertEqual(catalog['launch'], 'https://custom.example/games/silt/')
        self.assertEqual(catalog['sourceCommit'], second)

    def test_missing_dependency_fails_before_any_gallery_mutation(self):
        (self.source/'dist/game.js').write_text("import './missing.js';\n")
        second = self.commit('Broken dependency')
        before = snapshot(self.gallery)
        code, output = self.run_release(second, 2, True)
        self.assertEqual(code, 1)
        self.assertIn('missing local dependency', output)
        self.assertEqual(snapshot(self.gallery), before)

    def test_unmanaged_file_collision_fails_before_mutation(self):
        second = self.next_version()
        (self.game/'new.js').write_text('User work, not release-owned.')
        before = snapshot(self.gallery)
        code, output = self.run_release(second, 2, True)
        self.assertEqual(code, 1)
        self.assertIn('unmanaged file', output)
        self.assertEqual(snapshot(self.gallery), before)

    def test_reserved_source_path_is_rejected(self):
        (self.source/'dist/README.md').write_text('Would overwrite gallery documentation.')
        second = self.commit('Reserved path')
        before = snapshot(self.gallery)
        code, output = self.run_release(second, 2, True)
        self.assertEqual(code, 1)
        self.assertIn('Reserved gallery path', output)
        self.assertEqual(snapshot(self.gallery), before)

    def test_dirty_source_and_conflicting_version_are_rejected(self):
        second = self.next_version()
        before = snapshot(self.gallery)
        code, output = self.run_release(second, 1, True)
        self.assertEqual(code, 1)
        self.assertIn('already mapped', output)
        (self.source/'dist/game.js').write_text('Uncommitted change.')
        code, output = self.run_release(second, 2, True)
        self.assertEqual(code, 1)
        self.assertIn('dirty', output)
        self.assertEqual(snapshot(self.gallery), before)

    def test_nested_importmap_dependency_validation(self):
        files = {'index.html': b'<script type="importmap">{"imports":{"three":"./vendor/three.js"}}</script><script type="module" src="./game.js"></script>',
                 'game.js': b"import * as THREE from 'three';", 'vendor/three.js': b"export * from './core.js';",
                 'vendor/core.js': b'export const value=1;'}
        release.validate_runtime(files)
        del files['vendor/core.js']
        with self.assertRaisesRegex(ValueError, 'missing local dependency'):
            release.validate_runtime(files)


if __name__ == '__main__':
    unittest.main()
