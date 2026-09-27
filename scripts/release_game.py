#!/usr/bin/env python3
"""Stage an explicit Sites source revision as a local, reviewable Pages release.

Dry-run is the default. This script never edits the source repository, accesses
the network, commits, pushes, or publishes. See RELEASING.md for browser checks
and the separate publication step.
"""
import argparse
import copy
from datetime import date
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
import tempfile
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {'wayfarer': 'public/game', 'silt-and-signal': 'dist'}
RESERVED = {'README.md', 'about.html', 'source-provenance.json', 'history',
            'preview.jpg', 'preview.webp', 'preview.png'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True)
    if result.returncode:
        raise ValueError(result.stderr.decode(errors='replace').strip())
    return result.stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode()


def safe_path(name):
    p = PurePosixPath(name)
    require(name and not p.is_absolute() and str(p) == name and
            all(x not in ('.', '..') and not x.startswith('.') for x in p.parts)
            and '\\' not in name, f'Unsafe runtime path: {name}')
    require(p.parts[0] not in RESERVED and name != 'vendor/LICENSE',
            f'Reserved gallery path in runtime manifest/source: {name}')
    return name


def target(root, name):
    p = root / name
    require(p.is_relative_to(root), f'Path escapes game directory: {name}')
    for part in (p, *p.parents):
        if part == root.parent:
            break
        require(not part.is_symlink(), f'Symlink destination is unsafe: {p}')
        if part != p:
            require(not part.exists() or part.is_dir(), f'Destination parent is a file: {part}')
    return p


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls, self.maps, self.inline = [], {}, []
        self.script_type = None

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        require(not (tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh'),
                'Runtime HTML still redirects')
        if tag in ('script', 'iframe', 'img', 'source', 'audio', 'video') and attrs.get('src'):
            self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            self.urls.append(attrs['href'])
        if tag == 'script':
            self.script_type = attrs.get('type', 'text/javascript')

    def handle_data(self, data):
        if self.script_type == 'importmap':
            self.maps.update(json.loads(data).get('imports', {}))
        elif self.script_type in ('module', 'text/javascript'):
            self.inline.append(data)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.script_type = None


def validate_runtime(files):
    """Check literal HTML/CSS/ES-module dependencies, including import maps.

    This intentionally is not a JS sandbox or a complete dynamic-URL analyzer.
    Browser/network review is still required before publication.
    """
    require('index.html' in files, 'Missing index.html')
    maps = {}
    refs = []
    scripts = []
    for name, data in files.items():
        if name.endswith('.html'):
            parser = Resources()
            parser.feed(data.decode())
            maps.update(parser.maps)
            refs.extend((name, url, False) for url in parser.urls)
            refs.extend((name, url, False) for url in parser.maps.values())
            scripts.extend((name, text) for text in parser.inline)
        elif name.endswith(('.js', '.mjs')):
            scripts.append((name, data.decode()))
        elif name.endswith('.css'):
            refs.extend((name, x.strip(' \"\''), False) for x in
                        re.findall(r'url\(([^)]+)\)', data.decode()))
            refs.extend((name, x, False) for x in
                        re.findall(r'@import\s+[\'"]([^\'"]+)[\'"]', data.decode()))
    for name, code in scripts:
        # Current games use literal ES imports. Multiline import lists are valid.
        patterns = (r'(?:^|[;\n])\s*(?:import|export)\s+(?:[^;\'"]*?\s+from\s*)?[\'"]([^\'"]+)[\'"]',
                    r'\bimport\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)')
        for pattern in patterns:
            refs.extend((name, x, True) for x in re.findall(pattern, code))
    for name, url, module in refs:
        if url.startswith(('data:', 'blob:', '#')):
            continue
        if module and not url.startswith(('.', '/')) and not urlsplit(url).scheme:
            require(url in maps, f'{name}: unresolved bare module {url}')
            url, name = maps[url], 'index.html'
        parsed = urlsplit(url)
        require(not parsed.scheme and not parsed.netloc and not url.startswith('/'),
                f'{name}: external or root-relative dependency {url}')
        path = posixpath.normpath(posixpath.join(posixpath.dirname(name), unquote(parsed.path)))
        require(not path.startswith('../') and path in files,
                f'{name}: missing local dependency {url}')


def export_source(source, commit, game):
    prefix = SOURCES[game]
    paths = [prefix] + (['public/favicon.svg'] if game == 'wayfarer' else [])
    tree = git(source, 'ls-tree', '-r', '-z', commit, '--', *paths)
    files, entries = {}, []
    for record in tree.split(b'\0'):
        if not record:
            continue
        metadata, raw_path = record.split(b'\t', 1)
        mode, kind, oid = metadata.decode().split()
        source_path = raw_path.decode()
        require(kind == 'blob' and mode in ('100644', '100755'),
                f'Only regular tracked files can be exported: {source_path}')
        name = source_path[len(prefix)+1:] if source_path.startswith(prefix+'/') else 'favicon.svg'
        safe_path(name)
        require(name not in files, f'Duplicate runtime destination: {name}')
        original = git(source, 'cat-file', 'blob', oid)
        deployed, change = original, None
        if game == 'wayfarer' and name == 'index.html':
            deployed = original.replace(b'href="/favicon.svg"', b'href="./favicon.svg"')
            if deployed != original:
                change = 'Made favicon URL relative for subdirectory hosting.'
        files[name] = deployed
        entries.append(dict(path=name, source_path=source_path,
                            source_sha256=digest(original), sha256=digest(deployed), change=change))
    validate_runtime(files)
    return files, entries


def plan_release(gallery, source, game, commit, version, temporary):
    gallery, source = Path(gallery).resolve(), Path(source).resolve()
    require(re.fullmatch(r'[0-9a-f]{40}', commit) is not None,
            '--commit must be the exact 40-character lowercase source commit SHA')
    require(version > 0, 'Sites version must be positive')
    require(git(source, 'rev-parse', commit+'^{commit}').decode().strip() == commit,
            'Source commit not found')
    require(not git(source, 'status', '--porcelain'),
            'Source working tree is dirty; commit/recover the intended source first')
    game_dir = gallery/game
    manifest_path = target(game_dir, 'source-provenance.json')
    history_path = target(game_dir, 'history/versions.json')
    manifest = json.loads(manifest_path.read_text())
    history = json.loads(history_path.read_text())
    catalog_path = target(gallery, 'projects.json')
    catalog = json.loads(catalog_path.read_text())
    projects = [p for p in catalog if p['id'] == game]
    require(len(projects) == 1, f'Expected one {game} catalog entry')
    project = projects[0]
    require(project['sourceCommit'] == history['source_commit'] == manifest['source_commit']
            and project['sourceVersion'] == history['latest_version'] == manifest['sites_version'],
            'Existing catalog, history and provenance disagree')
    require(history['bundle'] == 'source-history.bundle', 'Unexpected source bundle filename')
    bundle_path = target(game_dir, 'history/source-history.bundle')
    require(digest(bundle_path.read_bytes()) == history['bundle_sha256'], 'Existing source bundle hash mismatch')
    require(version >= history['latest_version'], 'Refusing to silently downgrade the public Sites version')
    for old in history['versions']:
        require(old['version'] != version or old['commit'] == commit,
                f'Sites version {version} is already mapped to another commit')
        git(source, 'merge-base', '--is-ancestor', old['commit'], commit)
    git(source, 'merge-base', '--is-ancestor', history['source_commit'], commit)
    files, entries = export_source(source, commit, game)
    old_paths = set()
    for item in manifest['runtime_files']:
        name = safe_path(item['path'])
        require(name not in old_paths, f'Duplicate previous runtime path: {name}')
        old_paths.add(name)
        p = target(game_dir, name)
        require(p.is_file() and digest(p.read_bytes()) == item['sha256'],
                f'Existing runtime was edited or is missing: {name}')
    for name in files:
        p = target(game_dir, name)
        require(not p.exists() or name in old_paths,
                f'Runtime would overwrite an unmanaged file: {name}')
    same = commit == manifest['source_commit'] and version == manifest['sites_version']
    if same:
        require(old_paths == set(files) and all((game_dir/k).read_bytes() == v for k, v in files.items()),
                'Current release differs from the selected source revision')
        return {}, [], {'game': game, 'source_commit': commit, 'sites_version': version,
                        'runtime_files': len(files), 'status': 'Already current; no changes.'}
    require(version > history['latest_version'], 'A changed commit needs a new verified Sites version')
    # Fetch only through the local filesystem into a disposable bare repository.
    # The source has no ref, worktree, config, or object mutations.
    bare = Path(temporary)/'source.git'
    git(temporary, 'init', '--bare', '--quiet', str(bare))
    git(bare, 'fetch', '--quiet', '--no-tags', str(source), commit)
    git(bare, 'update-ref', 'refs/heads/release', commit)
    git(bare, 'symbolic-ref', 'HEAD', 'refs/heads/release')
    bundle = Path(temporary)/'source-history.bundle'
    git(bare, 'bundle', 'create', str(bundle), 'HEAD', 'refs/heads/release')
    git(bare, 'bundle', 'verify', str(bundle))
    count = int(git(bare, 'rev-list', '--count', 'HEAD'))
    for old in history['versions']:
        git(bare, 'cat-file', '-e', old['commit']+'^{commit}')
    updated = copy.deepcopy(manifest)
    updated.update(sites_version=version, source_commit=commit, runtime_files=entries,
                   released_on=date.today().isoformat())
    history.update(latest_version=version, source_commit=commit, source_commit_count=count,
                   bundle_sha256=digest(bundle.read_bytes()))
    if not any(v['version'] == version for v in history['versions']):
        history['versions'].insert(0, dict(version=version, commit=commit,
            date=git(source, 'show', '-s', '--format=%aI', commit).decode().strip(),
            subject=git(source, 'show', '-s', '--format=%s', commit).decode().strip()))
    project.update(sourceVersion=version, sourceCommit=commit)
    project['note'] = (f'Complete standalone Sites v{version} game released from commit {commit}. '
                       'Runs directly on GitHub Pages without sign-in or external game assets. '
                       f'All {count} source commits are preserved in history/source-history.bundle. '
                       'Existing Sites saves stay at the original origin.')
    writes = {target(game_dir, k): v for k, v in files.items()}
    writes.update({manifest_path: encoded(updated), history_path: encoded(history),
                   bundle_path: bundle.read_bytes(), catalog_path: encoded(catalog)})
    writes = {p: data for p, data in writes.items() if not p.exists() or p.read_bytes() != data}
    deletes = [target(game_dir, name) for name in sorted(old_paths-set(files))]
    return writes, deletes, dict(game=game, source_commit=commit, sites_version=version,
                                source_commits=count, runtime_files=len(files),
                                files_to_write=len(writes), obsolete_runtime_files=len(deletes),
                                status='Prepared locally; browser validation and publication remain separate.')


def apply_plan(writes, deletes):
    # Preflight is complete before the first gallery write. Roll back on ordinary
    # I/O failure; per-file replacement is atomic. A process kill is not a transaction.
    old = {p: p.read_bytes() if p.exists() else None for p in set(writes)|set(deletes)}
    try:
        for p, data in writes.items():
            p.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=p.parent, delete=False) as out:
                staged = Path(out.name)
                out.write(data)
            try:
                os.replace(staged, p)
            finally:
                staged.unlink(missing_ok=True)
        for p in deletes:
            p.unlink()
    except Exception:
        for p, data in old.items():
            if data is None:
                p.unlink(missing_ok=True)
            else:
                p.write_bytes(data)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', choices=SOURCES, required=True)
    parser.add_argument('--source', type=Path, required=True, help='Local authoritative source Git repository')
    parser.add_argument('--commit', required=True, help='Exact full source commit SHA; verify against Sites version listing')
    parser.add_argument('--sites-version', type=int, required=True, help='Verified Sites version number for that commit')
    parser.add_argument('--apply', action='store_true', help='Write local gallery files; never publishes')
    parser.add_argument('--gallery', type=Path, default=ROOT, help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    try:
        with tempfile.TemporaryDirectory(prefix='game-release-') as temporary:
            writes, deletes, report = plan_release(args.gallery, args.source, args.game,
                                                    args.commit, args.sites_version, temporary)
            if args.apply:
                apply_plan(writes, deletes)
            report['mode'] = 'apply' if args.apply else 'dry-run (nothing changed)'
            print(json.dumps(report, indent=2))
            if writes:
                print('Before publishing: update the game README/about/history page and root README/QA '
                      f'to Sites v{args.sites_version} and {report["source_commits"]} source commits; '
                      'review screenshot currency, run scripts/build_gallery.py and '
                      'scripts/check_standalone.py, then test gameplay/graphics/controls/audio '
                      'at the Pages project path in a signed-out browser. Commit/push separately.')
        return 0
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as error:
        print(f'Release refused: {error}')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
