"""Build the static gallery from projects.json. Python standard library only."""
from pathlib import Path
import html, json, hashlib

ROOT = Path(__file__).resolve().parents[1]
projects = json.loads((ROOT/'projects.json').read_text())
esc = html.escape

def card(p):
    image = f'<a class="preview" href="{esc(p["launch"])}" aria-label="Open {esc(p["title"])}"><img src="{esc(p["image"])}" alt="{esc(p["imageAlt"])}" loading="lazy" width="960" height="640"></a>' if p['image'] else ''
    if not image and p.get('featured'):
        image = f'<a class="preview preview-pending" href="{esc(p["launch"])}" aria-label="Open {esc(p["title"])}"><span>{esc(p["title"])}</span><small>Gameplay preview pending</small></a>'
    versions = f'<a href="{esc(p["versions"])}">{esc(p.get("versionsLabel", "Versions"))}</a>' if p.get('versions') else ''
    status = '' if p['image'] else '<span class="pending">Screenshot pending</span>'
    access = f'<span class="pending">{esc(p["accessLabel"])}</span>' if p.get('accessLabel') else ''
    cls = 'project card' if p['image'] or p.get('featured') else 'project compact'
    search = esc((p['title']+' '+p['description']+' '+p['category']+' '+' '.join(p.get('aliases',[]))).lower())
    return f'''<article class="{cls}" data-category="{esc(p['category'])}" data-search="{search}">
      {image}<div class="project-body"><div class="eyebrow">{esc(p['category'])}{status}{access}</div>
      <h3><a href="{esc(p['launch'])}">{esc(p['title'])}</a></h3><p>{esc(p['description'])}</p>
      <div class="actions"><a class="open" href="{esc(p['launch'])}">Open project <span aria-hidden="true">↗</span></a>{versions}<a href="{esc(p['source'])}">{esc(p.get('sourceLabel', 'Source'))}</a></div></div>
    </article>'''

categories=list(dict.fromkeys(p['category'] for p in projects))
buttons='<button class="filter active" data-filter="all" aria-pressed="true">All projects</button>' + ''.join(f'<button class="filter" data-filter="{esc(c)}" aria-pressed="false">{esc(c)}</button>' for c in categories)
featured=''.join(card(p) for p in projects if p['image'] or p.get('featured'))
other=''.join(card(p) for p in projects if not p['image'] and not p.get('featured'))
page='''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Games & experiments · David</title><meta name="description" content="David's browser games and experiments: evolving life, spaceflight, procedural worlds, and visual studies.">
<link rel="stylesheet" href="gallery.css"><link rel="canonical" href="https://actiondaveinri.github.io/spaceship/"></head>
<body><a class="skip" href="#projects">Skip to projects</a><div class="shell">
<header><div class="topline"><a class="brand" href="./">DAVID / EXPERIMENTS</a><a href="https://github.com/ActionDaveInRI">GitHub <span aria-hidden="true">↗</span></a></div>
<div class="intro"><div><p class="kicker">THE PROJECT SHELF</p><h1>Games & experiments</h1><p class="lede">Spaceflight, living systems, and procedural worlds.<br>Small projects with room to explore.</p></div><p class="shelf-count"><strong>PROJECT_COUNT</strong> projects<br><span>One home for each experiment.</span></p></div>
<div class="tools"><div class="filters" role="group" aria-label="Filter projects">''' + buttons + '''</div><label class="search"><span class="sr-only">Find a project</span><input type="search" placeholder="Find a project…" id="search" autocomplete="off"></label></div>
</header><main id="projects"><p id="result-count" class="result-count" aria-live="polite">PROJECT_COUNT projects</p>
<section id="featured" aria-labelledby="featured-title"><h2 id="featured-title" class="sr-only">Featured projects</h2><div class="grid">''' + featured + '''</div></section>
<section class="other" id="other" aria-labelledby="other-title"><div class="section-heading"><h2 id="other-title">More experiments</h2><p>Playable links and preserved builds. Screenshots pending.</p></div><div class="compact-grid">''' + other + '''</div></section>
<p id="empty" hidden>No projects match. Try another name or choose All projects.</p></main>
<footer><p>A collection of works in progress, studies, and earlier experiments.</p><a href="https://github.com/ActionDaveInRI/spaceship/blob/main/PROJECTS.md">Project directory on GitHub ↗</a></footer></div>
<script>
const search=document.querySelector('#search'),buttons=[...document.querySelectorAll('.filter')],cards=[...document.querySelectorAll('.project')];let category='all';
function filter(){const q=search.value.trim().toLowerCase();let count=0;for(const card of cards){const show=(category==='all'||card.dataset.category===category)&&card.dataset.search.includes(q);card.hidden=!show;if(show)count++;}document.querySelector('#result-count').textContent=`${count} ${count===1?'project':'projects'}`;document.querySelector('#empty').hidden=count!==0;for(const id of ['featured','other']){const section=document.getElementById(id);section.hidden=![...section.querySelectorAll('.project')].some(c=>!c.hidden);}}
search.addEventListener('input',filter);buttons.forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;buttons.forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});filter();}));
</script></body></html>'''
page=page.replace('PROJECT_COUNT',str(len(projects)))
style_version=hashlib.sha256((ROOT/'gallery.css').read_bytes()).hexdigest()[:12]
page=page.replace('href="gallery.css"',f'href="gallery.css?v={style_version}"')
(ROOT/'index.html').write_text(page)
print(f'Built gallery: {len(projects)} projects, {sum(bool(p["image"]) for p in projects)} screenshots.')

lines=['# Project directory', '', '[Open the screenshot gallery](https://actiondaveinri.github.io/spaceship/)', '', '| Project | Description | Details |', '|---|---|---|']
for p in projects:
    lines.append(f'| [{p["title"]}]({p["launch"]}) | {p["description"]} | [{p.get("sourceLabel", "Source")}]({p["source"]}) |')
lines += ['', '## Project history', '', 'Inkstar is the early generation of Inkdrift. [Play current Inkdrift](inkdrift/) or [open its archive](inkdrift/archive/). Historical game files and launch links are preserved.', '', 'Wayfarer and Silt + Signal include their complete recovered game source and original Git histories. [Wayfarer history](wayfarer/history/) preserves 30 source commits; [Silt + Signal history](silt-and-signal/history/) preserves 3. Each history includes a version manifest and a downloadable Git bundle.', '', '## Access and previews', '', 'Wayfarer v30 and Silt + Signal v3 run directly on GitHub Pages without ChatGPT sign-in. All runtime assets are local. Their original Sites builds remain available with their existing access settings. Browser saves remain local to each website address.', '', f'{sum(bool(p["image"]) for p in projects)} current gallery projects have actual screenshots; {sum(not p["image"] for p in projects)} await a usable capture. The Inkstar screenshot is also preserved in the Inkdrift archive.', '', 'Remaining previews are pending usable graphics captures. See [standalone migration verification](STANDALONE-QA.md) for the recovered games.', '']
(ROOT/'PROJECTS.md').write_text('\n'.join(lines))
