#!/usr/bin/env python3
"""Build the CV PDF source and the homepage from one data file.

    data/cv.json  ──►  cv/cv.tex    (compiled to cv/cv.pdf by the GitHub Action)
                  └─►  index.html   (the homepage)

Run from the repository root:  python3 tools/build.py
Standard library only, so it runs as-is on GitHub's runners.

Markup allowed in any text field:
    **bold**   *italic*   [text](https://link)   ^{nd} (superscript)
In "dates", a new line is a line break on the PDF (a space on the site).
"show" on an entry, bullet or item: "both" (default), "cv" or "site".
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ─────────────────────────────────────────────────────────────── markup ──
_STARS = "\x01"                   # protects runs like ***** (a redaction)


def _protect(s, pattern, render, store, tag):
    """Swap each match for a placeholder so later passes leave it alone."""
    def sub(m):
        store.append(render(m))
        return "%s%d%s" % (tag, len(store) - 1, tag)
    return re.sub(pattern, sub, s)


def _restore(s, store, tag):
    return re.sub("%s(\\d+)%s" % (tag, tag), lambda m: store[int(m.group(1))], s)


def smart_quotes(s):
    s = re.sub(r'(^|[\s(\[“‘])"', r"\1“", s)
    s = s.replace('"', "”")
    s = re.sub(r"(\w)'(\w)", r"\1’\2", s)          # it's
    s = re.sub(r"'(\d\d)\b", r"’\1", s)            # '26
    return s


def to_html(s, strip_bold=False):
    if not s:
        return ""
    s = smart_quotes(s)
    s = re.sub(r"\*{3,}", lambda m: _STARS * len(m.group()), s)
    s = html.escape(s, quote=False)
    store = []
    s = _protect(s, r"\[([^\]]+)\]\(([^)\s]+)\)",
                 lambda m: '<a href="{}">{}</a>'.format(m.group(2).replace('"', "%22"), to_html_inline(m.group(1), strip_bold)), store, "\x02")
    s = to_html_inline(s, strip_bold)
    s = _restore(s, store, "\x02")
    return s.replace(_STARS, "*")


def to_html_inline(s, strip_bold=False):
    s = re.sub(r"\^\{([^}]*)\}", r"<sup>\1</sup>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\1" if strip_bold else r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])", r"<em>\1</em>", s)
    return s


_TEX_ESC = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
            "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "<": r"\textless{}", ">": r"\textgreater{}"}


def _tex_escape(s):
    return "".join(_TEX_ESC.get(c, c) for c in s)


def _tex_url(u):
    return u.replace("\\", "").replace("%", r"\%").replace("#", r"\#")


def to_tex(s):
    if not s:
        return ""
    s = smart_quotes(s)
    s = re.sub(r"\*{3,}", lambda m: _STARS * len(m.group()), s)
    store = []
    s = _protect(s, r"\[([^\]]+)\]\(([^)\s]+)\)",
                 lambda m: r"\href{%s}{%s}" % (_tex_url(m.group(2)), _tex_inline(m.group(1))), store, "\x02")
    s = _tex_inline(s)
    s = _restore(s, store, "\x02")
    return s.replace(_STARS, "*")


def _tex_inline(s):
    store = []
    s = _protect(s, r"\^\{([^}]*)\}", lambda m: r"\textsuperscript{%s}" % _tex_escape(m.group(1)), store, "\x03")
    s = _tex_escape(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"\\textbf{\1}", s)
    s = re.sub(r"(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])", r"\\textit{\1}", s)
    s = (s.replace("“", "``").replace("”", "''").replace("‘", "`").replace("’", "'")
          .replace("—", "---").replace("–", "--").replace("\u2009", r"\,").replace("\u00a0", "~"))
    s = s.replace(r"\textgreater{}\,", r"\textgreater\,").replace(r"\textless{}\,", r"\textless\,")
    s = re.sub(r"\b(Dr|Prof|Mr|Ms|Mrs)\. ", r"\1.~", s)
    s = re.sub(r"\b(Prev|vs|etc|e\.g|i\.e)\. ", r"\1.\\ ", s)
    s = re.sub(r"(?<![A-Za-z.])([A-Z])\. (?=[A-Z])", r"\1.~", s)      # initials: K. Singh
    return _restore(s, store, "\x03")


def shown(obj, where):
    return (obj.get("show") or "both") in ("both", where)


def bullets(entry, where):
    out = []
    for b in entry.get("bullets") or []:
        if isinstance(b, str):
            b = {"text": b}
        if shown(b, where) and b.get("text", "").strip():
            out.append(b["text"])
    return out


# ────────────────────────────────────────────────────────────── cv.tex ──
def build_tex(cv):
    m = cv["meta"]
    L = []
    w = L.append
    w("%==============================================================")
    w("%  Kabir Singh — Curriculum Vitae")
    w("%  GENERATED from data/cv.json by tools/build.py. Edit the CV")
    w("%  through admin.html (or data/cv.json), not this file: it is")
    w("%  rewritten on every build. Layout and styles: preamble.tex.")
    w("%==============================================================")
    w(r"\input{preamble}")
    w(r"\fancyfoot[L]{\footnotesize\itshape As of %s}" % to_tex(m.get("asOf", "")))
    w("")
    w(r"\begin{document}")
    w("")
    # header
    parts = [to_tex(m[k]) for k in ("location", "phone") if m.get(k)]
    if m.get("email"):
        parts.append(r"\href{mailto:%s}{%s}" % (m["email"], to_tex(m["email"])))
    if m.get("linkedin"):
        disp = re.sub(r"^https?://(www\.)?", "", m["linkedin"]).rstrip("/")
        parts.append(r"\href{%s}{%s}" % (_tex_url(m["linkedin"]), to_tex(disp)))
    w(r"\begin{center}")
    w(r"  {\LARGE\bfseries %s}\\[4pt]" % to_tex(m.get("name", "")))
    w(r"  {\small " + " $\\cdot$\n   ".join(parts) + "}")
    w(r"\end{center}")
    w(r"\vspace{2pt}")

    for sec in cv["sections"]:
        w("")
        w("%==============================================================")
        if sec.get("keep"):
            w(r"\needspace{%d\baselineskip}" % int(sec["keep"]))
        w(r"\section{%s}" % to_tex(sec["title"]))
        w("")
        t = sec["type"]
        if t == "entries":
            for g in sec.get("groups", []):
                ents = [e for e in g.get("entries", []) if shown(e, "cv")]
                if not ents:
                    continue
                if g.get("title"):
                    w(r"\subhead{%s}" % to_tex(g["title"]))
                for e in ents:
                    if e.get("keep"):
                        w(r"\needspace{%d\baselineskip}" % int(e["keep"]))
                    dates = "\\\\".join(to_tex(x.strip()) for x in (e.get("dates") or "").split("\n"))
                    w(r"\entry{%s}{%s}" % (to_tex(e["heading"]), dates))
                    bl = bullets(e, "cv")
                    if bl:
                        w(r"\begin{cvitems}")
                        for b in bl:
                            w(r"  \item " + ("{}" if b.startswith("[") and not re.match(r"\[[^\]]+\]\(", b) else "") + to_tex(b))
                        w(r"\end{cvitems}")
                    w("")
        elif t == "publications":
            first = True
            for g in sec.get("groups", []):
                items = [p for p in g.get("items", []) if shown(p, "cv")]
                if not items:
                    continue
                w(r"\vspace{%s}" % ("4pt" if first else "6pt"))
                first = False
                w(r"\textbf{%s}" % to_tex(g["title"]))
                w(r"\begin{cvitems}")
                for p in items:
                    s = "%s. %s. %s" % (to_tex(p["authors"]), to_tex(p["title"].rstrip(".")), to_tex(p.get("venue", "")))
                    if p.get("doi"):
                        s += r". \href{https://doi.org/%s}{doi:%s}" % (_tex_url(p["doi"]), _tex_escape(p["doi"]))
                    w("  \\item " + s)
                w(r"\end{cvitems}")
                w("")
        elif t == "presentations":
            for p in sec.get("items", []):
                if not shown(p, "cv"):
                    continue
                opt = "[%d]" % int(p["keep"]) if p.get("keep") else ""
                w(r"\pres%s{%s. %s.}" % (opt, to_tex(p["authors"]), to_tex(p["title"].rstrip("."))))
                w(r"\venues{")
                for v in p.get("venues", []):
                    w(r"  %s & %s & %s \\" % (to_tex(v["name"]), to_tex(v.get("format", "")), to_tex(v.get("year", ""))))
                w("}")
                w("")
        elif t in ("list", "flatlist"):
            env = "cvitems" if t == "list" else "flatlist"
            w(r"\begin{%s}" % env)
            for it in sec.get("items", []):
                if shown(it, "cv") and it.get("text", "").strip():
                    w(r"  \item " + to_tex(it["text"]))
            w(r"\end{%s}" % env)
            w("")

    if m.get("closing"):
        w("%==============================================================")
        w(r"\vspace{16pt}")
        w(r"\noindent\rule{\textwidth}{0.4pt}")
        w(r"\vspace{4pt}")
        w(r"\noindent\textit{%s}" % to_tex(m["closing"]))
        w("")
    w(r"\end{document}")
    return "\n".join(L) + "\n"


# ─────────────────────────────────────────────────────────── homepage ──
MONTHS = {m: i for i, m in enumerate("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1)}
MONTHS.update({"Spring": 1, "Summer": 6, "Summers": 6, "Fall": 9, "Autumn": 9, "Winter": 12})


def start_of(dates):
    """(year, month) of the first date in a dates string, or None."""
    m = re.search(r"([A-Za-z]+)?\.?\s*['’](\d\d)\b", dates or "")
    if m:
        return 2000 + int(m.group(2)), MONTHS.get((m.group(1) or "").title(), 0)
    m = re.search(r"\b(19|20)(\d\d)\b", dates or "")
    return (int(m.group()), 0) if m else None


def site_dates(d):
    return to_html(re.sub(r"\s*\n\s*", " ", d or ""))


CATS = [("research", "Research", "Research"), ("pub", "Publications", "Publication"), ("presentation", "Presentations", "Presentation"),
        ("award", "Awards", "Award"), ("talk", "Talks", "Talk"), ("feature", "Features", "Feature"), ("teaching", "Teaching", "Teaching"),
        ("service", "Service", "Service"), ("community", "Community", "Community"), ("leadership", "Leadership", "Leadership"),
        ("education", "Education", "Education")]


def timeline(cv):
    items = []

    def add(key, cat, title, dates, sub="", bl=(), cls="", plain=False):
        items.append(dict(key=key, cat=cat, title=title, sub=sub, bl=list(bl), dates=dates, cls=cls, plain=plain))

    certs = []
    for sec in cv["sections"]:
        kind, t = sec.get("site"), sec["type"]
        if t == "entries":
            for g in sec.get("groups", []):
                for e in g.get("entries", []):
                    if not shown(e, "site"):
                        continue
                    head = e["heading"]
                    sub = ""
                    if kind == "research":
                        mm = re.match(r"(.+?)\.\s+((?:PI|Mentor|Supervisor)s?:.+)$", head)
                        if mm:
                            head, sub = mm.group(1), mm.group(2)
                    cat = e.get("kind") or g.get("kind") or kind
                    cls = {"science": "c-sci", "history": "c-his"}.get(g.get("field", ""), "")
                    add(start_of(e.get("dates")), cat, to_html(head, strip_bold=True), site_dates(e.get("dates")),
                        to_html(sub), [to_html(b) for b in bullets(e, "site")], cls)
        elif t == "publications":
            for g in sec.get("groups", []):
                for p in g.get("items", []):
                    if not shown(p, "site"):
                        continue
                    sub = "%s. %s" % (to_html(p["authors"]), to_html(p.get("venue", "")))
                    if p.get("doi"):
                        sub += ' &middot; <a href="https://doi.org/%s">doi:%s</a>' % (html.escape(p["doi"]), html.escape(p["doi"]))
                    y = int(p.get("year") or 0) or None
                    add((y, 13 if g.get("status") == "published" else 0) if y else None, "pub", to_html(p["title"]),
                        "Published" if g.get("status") == "published" else "In preparation", sub)
        elif t == "presentations":
            for p in sec.get("items", []):
                if not shown(p, "site"):
                    continue
                byyear = {}
                for v in p.get("venues", []):
                    ym = re.search(r"(19|20)\d\d", v.get("year", ""))
                    y = int(ym.group()) if ym else None
                    label = to_html(v["name"])
                    if v.get("year", "") and not re.fullmatch(r"\d{4}", v["year"].strip()):
                        label += " (%s)" % html.escape(v["year"].split()[0])
                    byyear.setdefault(y, []).append("%s, %s" % (label, html.escape(v.get("format", "").lower())))
                for y, vs in byyear.items():
                    add((y, 1) if y else None, "presentation", to_html(p["title"]), str(y or ""), to_html(p["authors"]), vs)
        elif t == "list":
            for it in sec.get("items", []):
                if not shown(it, "site"):
                    continue
                y = it.get("year")
                if not y:
                    ym = re.findall(r"\b(?:19|20)\d\d\b", it["text"])
                    y = int(ym[-1]) if ym else None
                add((int(y), 0) if y else None, it.get("kind") or kind, to_html(it["text"]), str(y or ""), plain=True)
        elif t == "flatlist":
            certs += [to_html(it["text"]) for it in sec.get("items", []) if shown(it, "site")]
    return items, certs


def build_index(cv):
    m = cv["meta"]
    esc = html.escape
    projects = cv.get("site", {}).get("projects", [])

    def leaf(kind, field, kicker, question, img, alt, cap, href, go):
        lis = "".join('<li><a href="{}"><span class="t">{}</span><span class="y">{}</span><span class="st">{}</span></a></li>'.format(
            esc(p.get("href", "#")), to_html(p["title"]), to_html(p.get("years", "")), to_html(p.get("status", "")))
            for p in projects if p.get("field") == field)
        return f'''<article class="leaf leaf--{kind}">
      <figure><img src="{img}" alt="{alt}" loading="lazy"><figcaption>{cap}</figcaption></figure>
      <div class="leaf-body">
        <p class="kicker">{kicker}</p>
        <h2>{question}</h2>
        <ol>{lis}</ol>
        <a class="go" href="{href}">{go} &rarr;</a>
      </div>
    </article>'''

    # first published paper for the "Selected work" card
    pub = None
    for sec in cv["sections"]:
        if sec["type"] == "publications":
            for g in sec.get("groups", []):
                if g.get("status") == "published":
                    pub = next((p for p in g.get("items", []) if shown(p, "site")), None)
                    if pub:
                        break
    pub_card = ""
    if pub:
        href = "https://doi.org/" + esc(pub["doi"]) if pub.get("doi") else "science.html"
        pub_card = f'''<a class="card card--pub" href="{href}">
      <div class="card-body">
        <p class="kicker">Peer-reviewed &middot; {esc(str(pub.get("year", "")))}</p>
        <h3>{to_html(pub["title"])}</h3>
        <p>{to_html(pub["authors"])}</p>
        <p class="venue">{to_html(pub.get("venue", ""))}</p>
        <span class="more">Read the paper &nearr;</span>
      </div>
      <div class="img"><img src="structures/cap8-glialcam.webp" alt="CAP8 (green) bound in the antigen-binding site of an anti-GlialCAM autoantibody" loading="lazy" width="733" height="894"></div>
    </a>'''

    items, certs = timeline(cv)
    counts = {k: sum(1 for i in items if i["cat"] == k) for k, _, _ in CATS}
    btns = '<button type="button" aria-pressed="true" data-c="all">All<span>{}</span></button>'.format(len(items)) + "".join(
        '<button type="button" aria-pressed="false" data-c="{}">{}<span>{}</span></button>'.format(k, n, counts[k]) for k, n, _ in CATS if counts[k])
    singular = {k: s for k, _, s in CATS}
    groups = {}
    for i in items:
        groups.setdefault(i["key"][0] if i["key"] else None, []).append(i)
    years = []
    order = sorted([y for y in groups if y], reverse=True) + ([None] if None in groups else [])
    for y in order:
        rows = []
        for i in sorted(groups[y], key=lambda i: i["key"] or (0, 0), reverse=True):
            sub = f'<span class="sub">{i["sub"]}</span>' if i["sub"] else ""
            if i["bl"]:
                sub += '<ul class="bl">' + "".join(f"<li>{b}</li>" for b in i["bl"]) + "</ul>"
            title = f'<span class="plain">{i["title"]}</span>' if i["plain"] else f'<b>{i["title"]}</b>'
            rows.append(f'<li data-c="{i["cat"]}" class="{i["cls"]}"><span class="cat">{singular.get(i["cat"], i["cat"].title())}</span>'
                        f'<div>{title}{sub}</div><span class="d">{i["dates"]}</span></li>')
        label = str(y) if y else "Undated"
        years.append(f'<section class="year" aria-label="{label}"><h3><span>{label}</span></h3><ul class="items">{"".join(rows)}</ul></section>')
    first_year = min(y for y in groups if y) if any(groups) else ""
    cert_html = "".join(f"<li>{c}</li>" for c in certs)
    linkedin = esc(m.get("linkedin", ""))

    return f'''<!DOCTYPE html>
<!-- GENERATED from data/cv.json by tools/build.py. Edit through admin.html; changes made here are overwritten on the next build. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kabir Singh</title>
<link rel="canonical" href="https://kabirsinghji.github.io/">
<meta name="description" content="Kabir Singh — Mathematical Biology, NJIT. Computational protein and peptide design, mathematical neuroscience, the history of medicine, and early modern Sikh history.">
<meta property="og:title" content="Kabir Singh">
<meta property="og:description" content="Mathematical Biology at NJIT. Computational protein and peptide design, mathematical neuroscience, the history of medicine, and early modern Sikh history.">
<meta property="og:url" content="https://kabirsinghji.github.io/">
<meta property="og:image" content="https://kabirsinghji.github.io/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preload" href="fonts/spectral-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/hanken-grotesk-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css?v=9">
<script src="theme.js?v=1"></script>
<script src="peek.js?v=9" defer></script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Kabir Singh",
  "url": "https://kabirsinghji.github.io/",
  "image": "https://kabirsinghji.github.io/photo.webp",
  "description": "Mathematical Biology at NJIT. Computational protein and peptide design, mathematical neuroscience, the history of medicine, and early modern Sikh history.",
  "affiliation": {{ "@type": "CollegeOrUniversity", "name": "New Jersey Institute of Technology", "url": "https://www.njit.edu/" }},
  "sameAs": ["https://www.linkedin.com/in/kabir-singh-ji", "https://orcid.org/0009-0002-5159-5879", "https://scholar.google.com/citations?user=-RpJmPsAAAAJ"]
}}
</script>
</head>
<body class="home">
<header class="wrap top">
  <a class="brand" href="./">Kabir Singh</a>
  <nav class="nav" aria-label="Site">
    <a href="./" aria-current="page">CV</a>
    <a href="science.html">Scientific Research</a>
    <a href="history.html">History Research</a>
    <a href="about.html">About</a>
  </nav>
</header>
<main>

<section class="wrap hero" aria-label="Introduction">
  <div>
    <p class="kicker">Mathematical Biology &middot; NJIT Honors College &middot; Class of 2027</p>
    <div class="names"><h1>Kabir Singh</h1><p class="pa-name" lang="pa">ਕਬੀਰ ਸਿੰਘ</p></div>
    <p class="thesis">I study <em class="s">molecules</em> and <em class="h">manuscripts</em>.</p>
    <p class="intro">I design therapeutic peptides with KumarLab, work on computational protein design at Imperial College London, and build mathematical models of systems too messy to measure directly at NJIT. As an Emerging Scholars Research Fellow at the Harvard Sikh Center, I study how the early Khalsa came to speak for the Sikh panth.</p>
    <ul class="contact">
      <li><a class="pill" href="cv/cv.pdf">Full CV (PDF)</a></li>
      <li><a href="mailto:{esc(m.get("email", ""))}">{esc(m.get("email", ""))}</a></li>
      <li><a href="{linkedin}">LinkedIn</a></li>
      <li><a href="https://orcid.org/0009-0002-5159-5879">ORCID</a></li>
      <li><a href="https://scholar.google.com/citations?user=-RpJmPsAAAAJ">Google Scholar</a></li>
    </ul>
  </div>
  <figure class="arch"><img src="photo-arch.webp" alt="Portrait of Kabir Singh in a khaki turban and dark suit" width="716" height="895" fetchpriority="high"></figure>
</section>

<section class="wrap" aria-label="Two lines of work">
  <div class="diptych">
    {leaf("s", "science", "Science", "How do you design a peptide to do one specific thing to one specific target?",
          "research-lab-800.webp", "Kabir Singh at a workstation running PyMOL beside an RMSD-versus-energy docking plot", "Docking analysis, KumarLab", "science.html", "Scientific research")}
    {leaf("h", "history", "History", "How do institutions decide what counts as authoritative teaching?",
          "sangat-woodcut.webp", "Early printed illustration of a Sikh sangat seated before a granthi, with the Mool Mantar in Gurmukhi", "The sangat hearing katha, early print", "history.html", "History research")}
  </div>
</section>

<section class="wrap sec" aria-labelledby="sel-h">
  <div class="sec-h"><h2 id="sel-h">Selected work</h2></div>
  <div class="selected">
    {pub_card}
    <a class="card card--video" href="sikh-studies.html">
      <div class="img"><img src="hsc-pitch-poster.webp" alt="Title card: Dissemination and the Making of Khalsa Authority in a Contested Panth, Harvard Sikh Center" loading="lazy" width="1280" height="720"><span class="play" aria-hidden="true"></span></div>
      <div class="card-body">
        <p class="kicker">Video &middot; about seven minutes</p>
        <h3>Dissemination and the making of Khalsa authority in a contested panth</h3>
        <span class="more">Watch the introduction &rarr;</span>
      </div>
    </a>
  </div>
</section>

<section class="wrap sec" id="timeline" aria-labelledby="tl-h">
  <div class="sec-h"><h2 id="tl-h">Since {first_year}</h2><p>Every entry on the CV, newest first, under the year it began. Filter by kind; certifications are listed at the end.</p></div>
  <div class="filters" role="group" aria-label="Filter the timeline">{btns}</div>
  <div id="years">{"".join(years)}</div>
  <div class="sec-h sec-h--small"><h2>Certifications &amp; licenses</h2></div>
  <ul class="certs">{cert_html}</ul>
</section>

<section class="wrap sec" aria-labelledby="beyond-h">
  <div class="sec-h"><h2 id="beyond-h">Beyond research</h2></div>
  <div class="beyond">
    <div><h3>On call</h3><p>A New Jersey&ndash;licensed EMT, riding with the NJIT First Aid Squad and previously the Marlboro First Aid Squad.</p></div>
    <div><h3>In the gurdwara</h3><p>Teaching Sikh history at Khalsa School Virsa since 2020, and Stop the Bleed in hybrid English and Punjabi at New Jersey gurdwaras.</p></div>
    <div><h3>Gurmat Sangeet</h3><p>Classical Indian music in the Sikh devotional tradition; an ongoing practice rather than a project.</p></div>
    <div><h3>Off hours</h3><p>Wrestling and martial arts, Punjabi, ping-pong, and travel. Reading mostly history, epistemology, and comparative theology.</p></div>
  </div>
  <p class="more-link"><a href="about.html">More about me &rarr;</a></p>
</section>
</main>

<footer class="foot">
  <div class="wrap">
    <p class="meta">Last updated {esc(m.get("asOf", ""))}. Plain HTML; CV typeset in LaTeX.<br><a href="mailto:{esc(m.get("email", ""))}">{esc(m.get("email", ""))}</a> &middot; <a href="admin.html">Admin</a></p>
    <div class="sign-off">
      <p class="coin" lang="fa" dir="rtl" title="Deg o tegh o fateh o nusrat-i bedirang, yāft az Nānak Gurū Gobind Singh">دیگ و تیغ و فتح و نصرت بیدرنگ<br>یافت از نانک گورو گوبند سنگه</p>
      <p class="pa" lang="pa">ਅਕਾਲ ਸਹਾਇ</p>
    </div>
  </div>
</footer>

<script>
/* Timeline filter: hides rows of other kinds and any year left empty. */
(function () {{
  var btns = [].slice.call(document.querySelectorAll('.filters button'));
  var years = [].slice.call(document.querySelectorAll('#years .year'));
  btns.forEach(function (b) {{
    b.addEventListener('click', function () {{
      var c = b.getAttribute('data-c');
      btns.forEach(function (x) {{ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }});
      years.forEach(function (y) {{
        var any = false;
        [].forEach.call(y.querySelectorAll('.items > li'), function (li) {{
          var on = c === 'all' || li.getAttribute('data-c') === c;
          li.hidden = !on; if (on) any = true;
        }});
        y.hidden = !any;
      }});
    }});
  }});
}})();
</script>
</body>
</html>
'''


# ──────────────────────────────────────────────────────────────── main ──
def main():
    with open(os.path.join(ROOT, "data", "cv.json"), encoding="utf-8") as f:
        cv = json.load(f)
    outputs = {"cv/cv.tex": build_tex(cv), "index.html": build_index(cv)}
    for rel, text in outputs.items():
        with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
            f.write(text)
        print("wrote", rel)


if __name__ == "__main__":
    sys.exit(main())
