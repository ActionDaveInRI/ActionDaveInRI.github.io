#!/usr/bin/env python3
"""Verify the restored demo, legacy routes, and optionally deployed destinations."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from compatibility import BASE, BASELINE, ORIGIN, ROOT, RUNTIME_SHA256, read_routes, redirect_page


def baseline_routes(root=ROOT):
    def git(*args):
        return subprocess.check_output(['git', '-C', str(root), *args])
    original = json.loads(git('show', BASELINE + ':pages-redirects.json'))
    paths = git('ls-tree', '-r', '--name-only', BASELINE).decode().splitlines()
    expected = {}
    for path in paths:
        if not path.endswith('.html') or path == 'index.html':
            continue
        destination = original.get(path, path)
        if destination == 'projects/ship-effects/index.html':
            target = 'spaceship/'
        elif destination == 'index.html':
            target = ''
        elif destination == 'projects/star-cluster/source/public/demo/index.html':
            target = 'projects/star-cluster/'
        else:
            target = destination[:-len('index.html')] if destination.endswith('/index.html') else destination
        expected[path] = ORIGIN + '/' + target
    return expected


def inspect_layout(root=ROOT):
    root = Path(root)
    routes = read_routes(root)
    expected = baseline_routes(root)
    assert len(expected) == 62, 'Unexpected baseline HTML inventory'
    for source, destination in expected.items():
        assert routes.get(source) == destination, f'Lost or changed legacy route: {source}'
    for source, destination in routes.items():
        assert (root / source).read_text() == redirect_page(source, destination), f'Stale redirect: {source}'
    assert hashlib.sha256((root / 'index.html').read_bytes()).hexdigest() == RUNTIME_SHA256, 'Original Spaceship runtime changed'
    assert (root / '.nojekyll').is_file(), 'Pages must serve this static tree directly'
    actual_html = {p.relative_to(root).as_posix() for p in root.rglob('*.html') if '.git' not in p.parts}
    assert actual_html == {'index.html', *routes}, 'Unmanaged HTML runtime remains in the compatibility tree'
    for folder in root.iterdir():
        if folder.is_dir() and folder.name not in ('.git', 'scripts'):
            assert all(p.suffix == '.html' for p in folder.rglob('*') if p.is_file()), f'Collected project sources remain in {folder.name}'
    return routes


def source_requests(base, routes):
    base = base.rstrip('/') + '/'
    requests = {base: 'index.html', urljoin(base, 'index.html'): 'index.html'}
    for path in routes:
        requests[urljoin(base, path)] = path
        if path.endswith('/index.html'):
            directory = urljoin(base, path[:-len('index.html')])
            requests[directory] = path
            alternate = path[:-len('/index.html')] + '.html'
            # GitHub Pages may prefer projects.html for slashless /projects.
            candidates = (path, alternate) if alternate in routes and routes[alternate] == routes[path] else path
            requests[directory.rstrip('/')] = candidates
    return requests


def check_live(base, routes, root=ROOT):
    requests = source_requests(base, routes)
    for destination in routes.values():
        requests.setdefault(destination, None)

    def check(item):
        url, expected = item
        request = Request(url, headers={'User-Agent': 'spaceship-compatibility-verifier', 'Cache-Control': 'no-cache'})
        with urlopen(request, timeout=45) as response:
            assert response.status == 200, f'HTTP {response.status}'
            body = response.read()
        if expected:
            candidates = expected if isinstance(expected, tuple) else (expected,)
            assert any(body == (Path(root) / p).read_bytes() for p in candidates), 'Deployed compatibility/demo content differs'
        else:
            # Canonical target bytes are checked in the account-site repository.
            assert body.strip(), 'Empty canonical destination'
            assert b"There isn't a GitHub Pages site here" not in body, 'GitHub Pages site missing'
        return url

    failures = []
    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = {pool.submit(check, item): item[0] for item in requests.items()}
        for count, future in enumerate(as_completed(futures), 1):
            try:
                future.result()
            except Exception as error:
                failures.append(f'{futures[future]}: {error}')
            if count % 40 == 0:
                print(f'Checked {count}/{len(requests)} live addresses.', flush=True)
    assert not failures, '\n'.join(failures)
    print(f'Live verification passed: {len(routes)} legacy HTML paths, directory/slashless variants, original demo, and {len(set(routes.values()))} canonical targets ({len(requests)} requests).')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', help=f'Also verify deployed legacy site, normally {BASE}')
    args = parser.parse_args()
    routes = inspect_layout()
    print(f'Local verification passed: {len(routes)} compatibility pages and byte-identical original Spaceship demo.')
    if args.base:
        check_live(args.base, routes)


if __name__ == '__main__':
    main()
