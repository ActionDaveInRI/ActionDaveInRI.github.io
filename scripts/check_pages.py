#!/usr/bin/env python3
"""Check preserved Pages routes, catalog links and literal local dependencies.

With --base, also fetch every catalog launch (including external repositories)
and compare local HTML/runtime resources to the reviewed checkout. This is route
and dependency validation, not a substitute for interactive gameplay testing.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen

from project_layout import MARKER, SITE_BASE, SITE_REPO, SOURCE_BASE, project_directory, redirect_page, site_file

ROOT = Path(__file__).resolve().parents[1]
BASE = SITE_BASE


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.urls, self.maps, self.code = [], {}, []
        self.refresh, self.script = None, None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('src'):
            self.urls.append(attrs['src'])
        if tag in ('a', 'link') and attrs.get('href'):
            self.urls.append(attrs['href'])
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            self.refresh = attrs['content'].split('url=', 1)[1]
        if tag == 'script':
            self.script = attrs.get('type', 'text/javascript')

    def handle_data(self, data):
        if self.script == 'importmap':
            self.maps.update(json.loads(data).get('imports', {}))
        elif self.script in ('module', 'text/javascript'):
            self.code.append(data)

    def handle_endtag(self, tag):
        if tag == 'script':
            self.script = None


def local_file(url, current, external_repos=()):
    return site_file(url, current, external_repos)


def script_refs(code):
    patterns = (
        r'(?:^|[;\n])\s*(?:import|export)\s+(?:[^;\'"]*?\s+from\s*)?[\'"]([^\'"]+)[\'"]',
        r'\bimport\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)',
        r'\bfetch\s*\(\s*[\'"]([^\'"]+)[\'"]',
    )
    return [url for pattern in patterns for url in re.findall(pattern, code)]


def inspect_layout(root=ROOT):
    root = Path(root)
    catalog = json.loads((root/'projects.json').read_text())
    routes = json.loads((root/'pages-redirects.json').read_text())
    external_repos = {p['repo'] for p in catalog if p['repo'] != SITE_REPO}
    for source, destination in routes.items():
        assert (root/source).read_text() == redirect_page(source, destination), f'Stale redirect: {source}'
        assert destination not in routes, f'Redirect chain: {source}'
        assert (root/destination).is_file(), f'Missing destination: {destination}'
    seeds = {'index.html', 'versions.html', *routes, *routes.values()}
    for project in catalog:
        if project['repo'] == SITE_REPO:
            directory = project_directory(root, project)
            assert (directory/'index.html').is_file()
            assert project['source'] == SOURCE_BASE + project['directory']
        for key in ('launch', 'live', 'versions', 'image'):
            if project.get(key):
                path = local_file(project[key], 'index.html', external_repos)
                if path:
                    seeds.add(path)
    # Follow literal resources and local links, sharing each page's import map
    # with its module dependencies. Editable source trees are not web runtimes.
    checked, pending = set(), [(path, {}, path) for path in sorted(seeds)]
    while pending:
        name, maps, entry = pending.pop()
        if name in checked:
            continue
        path = root/name
        assert path.is_file(), f'Missing local Pages file: {name}'
        checked.add(name)
        urls = []
        # Source HTML is preserved build input, not a standalone web runtime.
        if '/source/' in name:
            continue
        if name.endswith('.html'):
            text = path.read_text()
            page = Page(text)
            maps, entry = page.maps, name
            urls.extend(page.urls)
            urls.extend(value for key, value in maps.items() if not key.endswith('/'))
            if page.refresh:
                urls.append(page.refresh)
            if MARKER not in text:
                for code in page.code:
                    urls.extend(script_refs(code))
                # The historical WFC loader fetches this explicit array.
                if name.endswith('nebula-weave/versions/github-split/index.html'):
                    urls.extend(f'part{i}.js' for i in range(1, 7))
        elif name.endswith(('.js', '.mjs')):
            urls.extend(script_refs(path.read_text()))
        elif name.endswith('.css'):
            urls.extend(x.strip(' \"\'') for x in re.findall(r'url\(([^)]+)\)', path.read_text()))
        for url in urls:
            current = name
            prefixes = [key for key in maps if key.endswith('/') and url.startswith(key)]
            if url in maps:
                url, current = maps[url], entry
            elif prefixes:
                prefix = max(prefixes, key=len)
                url, current = maps[prefix] + url[len(prefix):], entry
            # Ignore unresolved bare JS imports; local paths/import maps are
            # checked here, and recovered-release manifests have stricter checks.
            elif name.endswith(('.js', '.mjs')) and not url.startswith(('.', '/')) and not urlsplit(url).scheme:
                continue
            dependency = local_file(url, current, external_repos)
            if dependency:
                pending.append((dependency, maps, entry))
    return catalog, routes, checked


def check_live(base, catalog, paths, root=ROOT):
    base = base.rstrip('/') + '/'
    routes = json.loads((Path(root)/'pages-redirects.json').read_text())
    external_repos = {p['repo'] for p in catalog if p['repo'] != SITE_REPO}
    requests = {urljoin(base, path): path for path in paths}
    for path in paths:
        if path.endswith('/index.html'):
            directory = urljoin(base, path[:-len('index.html')])
            requests[directory] = path
            # Pages can serve projects.html at /projects before considering
            # projects/index.html. Accept it only when both redirects share
            # the same manifest destination; local servers may use the index.
            alternate = path[:-len('/index.html')] + '.html'
            equivalent = alternate in routes and routes[alternate] == routes.get(path)
            requests[directory.rstrip('/')] = (path, alternate) if equivalent else path
    for project in catalog:
        launch = project['launch']
        path = local_file(launch, 'index.html', external_repos)
        url = base + launch[len(BASE):] if path is not None and launch.startswith(BASE) else launch
        requests.setdefault(url, path)

    def check(item):
        url, path = item
        request = Request(url, headers={'User-Agent': 'portfolio-pages-verifier', 'Cache-Control': 'no-cache'})
        with urlopen(request, timeout=45) as response:
            assert response.status == 200, f'{url}: HTTP {response.status}'
            body = response.read()
        if path:
            candidates = path if isinstance(path, tuple) else (path,)
            assert any(body == (Path(root)/candidate).read_bytes() for candidate in candidates), f'Deployed content differs: {path}'
        return url

    results, failures = [], []
    with ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(check, item): item[0] for item in requests.items()}
        for index, future in enumerate(as_completed(futures), 1):
            try:
                results.append(future.result())
            except Exception as error:
                failures.append(f'{futures[future]}: {error}')
            if index % 50 == 0:
                print(f'Checked {index}/{len(requests)} public URLs.', flush=True)
    assert not failures, '\n'.join(failures)
    print(f'Live verification: {len(catalog)} catalog launches and {len(paths)} local routes/resources passed ({len(results)} requests).')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', help='Also verify this deployed Pages base URL')
    args = parser.parse_args()
    catalog, routes, checked = inspect_layout()
    print(f'Layout verified: {len(catalog)} gallery projects, {len(routes)} compatibility pages, {len(checked)} local routes/resources.')
    if args.base:
        check_live(args.base, catalog, checked)


if __name__ == '__main__':
    main()
