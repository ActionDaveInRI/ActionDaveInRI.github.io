"""Generate the static project gallery and directory from projects.json."""
from pathlib import Path
from urllib.parse import urlsplit
import html
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://actiondaveinri.github.io/projects/'
projects = json.loads((ROOT / 'projects.json').read_text())
esc = html.escape
assert len({p['id'] for p in projects}) == len(projects), 'Duplicate project ID'


def local_url(url, version=False):
    """Keep gallery links portable, and refresh local screenshots on each release."""
    if url.startswith(BASE):
        url = url[len(BASE):]
    path = ROOT / urlsplit(url).path
    if version and not urlsplit(url).scheme and path.is_file():
        url += '?v=' + hashlib.sha256(path.read_bytes()).hexdigest()[:12]
    return esc(url)


def release_label(p):
    if p.get('gameVersion'):
        return 'v' + str(p['gameVersion'])
    if p.get('sourceVersion'):
        return 'v' + str(p['sourceVersion'])
    return p.get('buildLabel', '')


def card(p, index):
    launch = local_url(p['launch'])
    title = esc(p['title'])
    if p.get('image'):
        loading = 'eager' if index < 3 else 'lazy'
        image = f'<a class="preview" href="{launch}" aria-label="Open {title}"><img src="{local_url(p["image"], version=True)}" alt="{esc(p["imageAlt"])}" loading="{loading}" decoding="async" width="1280" height="720"></a>'
    else:
        image = '<div class="preview-note">Screenshot unavailable</div>'
    preview_note = f'<small class="preview-caption">{esc(p["previewLabel"])}</small>' if p.get('previewLabel') else ''
    versions = f'<a href="{local_url(p["versions"])}">{esc(p.get("versionsLabel", "Versions"))}</a>' if p.get('versions') else ''
    release = release_label(p)
    badge = f'<span class="release">{esc(release)}</span>' if release else ''
    access = '<span class="access">Requires sign-in</span>' if p.get('requiresLogin') else ''
    search = esc(' '.join([p['title'], p['description'], p['category'], *p.get('aliases', [])]).lower())
    return f'''<article id="{esc(p['id'])}" class="project card" data-category="{esc(p['category'])}" data-search="{search}">
      {image}{preview_note}<div class="project-body"><div class="eyebrow">{esc(p['category'])}{badge}{access}</div>
      <h3><a href="{launch}">{title}</a></h3><p>{esc(p['description'])}</p>
      <div class="actions"><a class="open" href="{launch}">Open project <span aria-hidden="true">↗</span></a>{versions}<a href="{esc(p['source'])}">{esc(p.get('sourceLabel', 'Source'))}</a></div></div>
    </article>'''


categories = list(dict.fromkeys(p['category'] for p in projects))
buttons = '<button class="filter active" data-filter="all" aria-pressed="true">All projects</button>' + ''.join(f'<button class="filter" data-filter="{esc(c)}" aria-pressed="false">{esc(c)}</button>' for c in categories)
sections = []
for key, heading, subheading in [
    ('current', 'Current games & worlds', 'Open a screenshot to play.'),
    ('experiments', 'Experiments & studies', 'Smaller simulations, visual studies, and earlier projects.'),
]:
    cards = ''.join(card(p, i) for i, p in enumerate(projects) if p.get('section', 'experiments') == key)
    if cards:
        sections.append(f'<section class="project-section" aria-labelledby="{key}-title"><div class="section-heading"><h2 id="{key}-title">{heading}</h2><p>{subheading}</p></div><div class="grid">{cards}</div></section>')

page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Games & experiments · David</title><meta name="description" content="Play David's browser games and experiments: First Light, Wayfarer, Silt + Signal, and more. Screenshots, current builds, and preserved project histories.">
<link rel="stylesheet" href="gallery.css"><link rel="canonical" href="https://actiondaveinri.github.io/projects/"></head>
<body><a class="skip" href="#projects">Skip to projects</a><div class="shell">
<header><div class="topline"><a class="brand" href="./">DAVID / EXPERIMENTS</a><nav aria-label="Site"><a href="versions.html">Project directory</a><a href="https://github.com/ActionDaveInRI">GitHub <span aria-hidden="true">↗</span></a></nav></div>
<div class="intro"><div><h1>Games & experiments</h1><p class="lede">Spaceflight, living systems, and worlds worth exploring.</p></div><p class="shelf-count"><strong>PROJECT_COUNT</strong> projects</p></div>
<div class="tools"><div class="filters" role="group" aria-label="Filter projects">''' + buttons + '''</div><label class="search"><span class="sr-only">Find a project</span><input type="search" placeholder="Find a project…" id="search" autocomplete="off"></label></div>
</header><main id="projects"><p id="result-count" class="result-count" aria-live="polite">PROJECT_COUNT projects</p>''' + ''.join(sections) + '''
<p id="empty" hidden>No projects match. Try another name or choose All projects.</p></main>
<footer><p>Works in progress, with a home for every project.</p><a href="https://github.com/ActionDaveInRI/projects/blob/main/PROJECTS.md">Source directory ↗</a></footer></div>
<script>
const search=document.querySelector('#search'),buttons=[...document.querySelectorAll('.filter')],cards=[...document.querySelectorAll('.project')];let category='all';
function filter(){const q=search.value.trim().toLowerCase();let count=0;for(const card of cards){const show=(category==='all'||card.dataset.category===category)&&card.dataset.search.includes(q);card.hidden=!show;if(show)count++;}document.querySelector('#result-count').textContent=`${count} ${count===1?'project':'projects'}`;document.querySelector('#empty').hidden=count!==0;for(const section of document.querySelectorAll('.project-section'))section.hidden=![...section.querySelectorAll('.project')].some(c=>!c.hidden);}
search.addEventListener('input',filter);buttons.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;buttons.forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});filter();}));
</script></body></html>'''
page = page.replace('PROJECT_COUNT', str(len(projects)))
style_version = hashlib.sha256((ROOT / 'gallery.css').read_bytes()).hexdigest()[:12]
page = page.replace('href="gallery.css"', f'href="gallery.css?v={style_version}"')
(ROOT / 'index.html').write_text(page)

lines = ['# Project directory', '', '[Open the screenshot gallery](' + BASE + ')', '', 'The repository root is the gallery. Each game has its own folder; projects already in dedicated repositories keep their existing homes and URLs.', '', '| Project | Current build | Location |', '|---|---|---|']
for p in projects:
    location = p['repo'] + ('/' + p['directory'] if p['directory'] != '.' else '/')
    lines.append(f'| [{p["title"]}]({p["launch"]}) | {release_label(p) or "Current preserved build"} | [{location}]({p["source"]}) |')
lines += ['', '## History and release notes', '', 'Inkstar remains in the [Inkdrift archive](inkdrift/archive/). Nebula Weave remains at [nebula-weave/](nebula-weave/) as requested, outside the main gallery. Older launch URLs still work.', '', 'Recovered Sites releases include source provenance in their own folders. Publishing here is deliberate; Sites development does not automatically replace these releases. The original Sites projects and access settings are preserved. Browser saves stay at their original website address unless a game provides an export/import feature.', '', 'First Light v0.10.2 is in [first-light/](first-light/), including editable source and tests. Use its Export save / Import save feature to move progress between hosts.', '', f'{sum(bool(p.get("image")) for p in projects)} of {len(projects)} gallery projects have real screenshots.', '', 'See [gallery verification](GALLERY-QA.md) and [release instructions](RELEASING.md).', '']
(ROOT / 'PROJECTS.md').write_text('\n'.join(lines))

items = []
for p in projects:
    history = f' · <a href="{local_url(p["versions"])}">{esc(p.get("versionsLabel", "Versions"))}</a>' if p.get('versions') else ''
    items.append(f'<li><a href="{local_url(p["launch"])}">{esc(p["title"])}</a> <small>{esc(release_label(p))}</small>{history}</li>')
(ROOT / 'versions.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project directory · David</title><link rel="stylesheet" href="gallery.css?v=''' + style_version + '''"></head><body><main class="shell directory"><a href="./">← Screenshot gallery</a><h1>Project directory</h1><p>Current builds and their preserved histories.</p><ul>''' + ''.join(items) + '''</ul><h2>Additional archives</h2><p><a href="nebula-weave/">Nebula Weave</a> · <a href="inkdrift/archive/">Inkstar / early Inkdrift</a></p></main></body></html>''')
print(f'Built gallery: {len(projects)} projects, {sum(bool(p.get("image")) for p in projects)} screenshots.')
