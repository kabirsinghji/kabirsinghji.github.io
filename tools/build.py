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
"tags" on an entry or item lists ids from the top-level "tagset"; they shape the homepage protein
(and never print on the PDF). "short" is the entry's label on the protein.
"""
import datetime
import html
import json
import math
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


# ──────────────────────────────────────────────────────────── protein ──
# The homepage "protein" is generated from the tags in cv.json ("tagset", and "tags" on each entry).
# Visible tags are named on the page; hidden ones still shape it, but only their kind is published.
KIND = {"activity": "a", "subject": "i", "quality": "q", "keyword": "k"}
LEAD_VERB = re.compile(r"^(Led|Leads?|Started|Taught|Teach\w*|Received|Won|Designed|Ran|Built|Develop\w*|Co-?founded|Founded|Organi[sz]ed|"
                       r"Coordinated|Mentored|Trained|Wrote|Edited|Reviewed|Presented|Created|Managed?|Model+ed|Analy[sz]ed|Conducted|"
                       r"Contributed|Selected|Awarded|Served?|Planned|Instructed|Represented|Translated|Supported|Investigat\w+|Stud\w+|"
                       r"Examin\w+|Explor\w+|Mapp?\w*|Help\w*|Design\w*|Running|Establish\w*|Recruit\w*|Host\w*|Moderat\w+|Assist\w*|"
                       r"Guid\w*|Oversaw|Overs\w+|Direct\w*|Deriving|Applying|Synthesi[sz]ing|Arguing|Examining)$", re.I)


def plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", to_html(s or "", strip_bold=True))).strip()


def short_of(text):
    t = re.split(r"(?<=\w)[.,;:]\s", plain(text), maxsplit=1)[0]
    return t if len(t) <= 38 else t[:36].rstrip() + "…"


def decimal_start(dates, fallback):
    s = start_of(dates)
    return round(s[0] + (max(s[1], 1) - 1) / 12, 3) if s else fallback


def protein_data(cv):
    tagset = cv.get("tagset") or []
    if not tagset:
        return None
    index = {t["id"]: i for i, t in enumerate(tagset)}
    tags = []
    for t in tagset:
        d = {"k": KIND.get(t.get("kind"), "k")}
        if t.get("visible"):
            d["n"] = t.get("name", "")
            if d["k"] == "a" and t.get("verb"):
                d["v"] = t["verb"]
            if d["k"] == "q" and t.get("verbs"):
                d["v"] = "Verbs: " + t["verbs"]
        else:
            d["h"] = 1
        tags.append(d)
    m = re.search(r"([A-Za-z]{3})[a-z]*\.?\s+((?:19|20)\d\d)", cv["meta"].get("asOf", ""))
    now = int(m.group(2)) + (MONTHS.get(m.group(1).title(), 6) - 1) / 12 if m else 2026.5
    undated = round(now - 1, 3)
    out = []

    def add(sec, obj, text, dates, t, verbs=()):
        g = [index[x] for x in obj.get("tags", []) if x in index]
        out.append({"s": obj.get("short") or short_of(text), "title": plain(text), "sec": sec["title"], "d": dates,
                    "v": list(verbs)[:3], "t": t, "g": g})

    for sec in cv["sections"]:
        t = sec["type"]
        for g in sec.get("groups", []):
            for e in g.get("entries", []):
                if shown(e, "site"):
                    vs = []
                    for b in bullets(e, "site"):
                        w = plain(b).split(" ", 1)[0]
                        if LEAD_VERB.match(w) and w.lower() not in vs:
                            vs.append(w.lower())
                    add(sec, e, e["heading"], plain(re.sub(r"\s*\n\s*", " ", e.get("dates") or "")), decimal_start(e.get("dates"), undated), vs)
            for p in g.get("items", []):
                if shown(p, "site"):
                    y = int(p.get("year") or 0)
                    add(sec, p, p["title"], ("Published " if g.get("status") == "published" else "In preparation, ") + (str(y) if y else ""),
                        y + .5 if y else undated)
        for it in sec.get("items", []):
            if not shown(it, "site"):
                continue
            if t == "presentations":
                ys = sorted({int(x.group()) for v in it.get("venues", []) for x in [re.search(r"(19|20)\d\d", v.get("year", ""))] if x})
                add(sec, it, it["title"], (str(ys[0]) + ("–" + str(ys[-1]) if ys[-1] != ys[0] else "")) if ys else "", ys[0] + .5 if ys else undated)
            elif it.get("text", "").strip():
                y = it.get("year") or (re.findall(r"\b(?:19|20)\d\d\b", it["text"]) or [None])[-1]
                add(sec, it, it["text"], str(y or ""), int(y) + .5 if y else undated)
    if not any(e["g"] for e in out):
        return None
    return {"now": round(max([now] + [e["t"] for e in out]) + .08, 3), "tags": tags, "entries": out}


def protein_section(data):
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    n = len(data["entries"])
    return f'''<section class="wrap sec" id="protein" aria-labelledby="pr-h">
  <div class="sec-h"><h2 id="pr-h">The CV as a protein</h2><p>Every dot is one of the {n} entries in the timeline below. The surface bulges toward the kinds of work I do, and its colours show what the work is about. Drag to turn it; tap a dot to see the entry.</p></div>
  <div class="protein" id="protein-stage">
    <canvas class="pr-gl" aria-hidden="true"></canvas>
    <canvas class="pr-ov" tabindex="0" role="img" aria-label="A turning 3D surface built from the entries in Kabir's CV. Use the arrow keys to turn it. The same entries are listed in the timeline below."></canvas>
    <div class="pr-axes"></div>
    <div class="pr-switches" role="group" aria-label="Show on the protein">
      <button type="button" class="pr-sw" data-k="axis" aria-pressed="true">Axis</button>
      <button type="button" class="pr-sw" data-k="nodes" aria-pressed="true">Nodes</button>
      <button type="button" class="pr-sw" data-k="names" aria-pressed="false">Names</button>
    </div>
    <div class="pr-hot"><p class="kicker">Hotspots &middot; what the work is about</p><div class="pr-chips"></div></div>
    <div class="pr-grow">
      <button type="button" class="pr-play" aria-label="Watch it grow"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg></button>
      <label class="sr-only" for="pr-year">Grow the protein up to a date</label>
      <input type="range" id="pr-year" step="0.01">
      <output for="pr-year"></output>
    </div>
    <div class="pr-pill" hidden></div>
    <aside class="pr-card" aria-live="polite" hidden>
      <button type="button" class="pr-x" aria-label="Close"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg></button>
      <p class="pr-meta"></p><h3></h3><p class="pr-verbs"></p><ul class="pr-tags"></ul><p class="pr-rel"></p>
    </aside>
    <p class="pr-nogl" hidden>This view needs WebGL, which this browser has turned off. Every entry is in the timeline below.</p>
  </div>
  <script type="application/json" id="protein-data">{blob}</script>
</section>
'''


# ──────────────────────────────────────────────────────────────── coin ──
# site.why in cv.json (edited in admin): {"shared", "molecules", "manuscripts"}, the two stories split
# into paragraphs by blank lines. A coin turns over between them (coin.js); one side carries CAP8's
# sequence round its rim, the other the first eight letters of the Gurmukhi alphabet.
COIN = {"s": ("KPYPFWDD", "CAP8", "MOLECULES"), "h": ("ੳਅੲਸਹਕਖਗ", "ਅੱਖਰ", "MANUSCRIPTS")}


def coin_face(side):
    rim, mid, sub = COIN[side]
    lang = ' lang="pa"' if side == "h" else ""
    letters = "".join(f'<text x="170" y="42" transform="rotate({45 * i} 170 170)">{c}</text>' for i, c in enumerate(rim))
    return (f'<span class="coin-face coin-face--{side}"><svg viewBox="0 0 340 340" aria-hidden="true" focusable="false">'
            f'<circle class="c-disc" cx="170" cy="170" r="168"/><circle class="c-line" cx="170" cy="170" r="160"/>'
            f'<circle class="c-dash" cx="170" cy="170" r="100"/><g class="c-rim"{lang}>{letters}</g>'
            f'<text class="c-mid" x="170" y="158"{lang}>{mid}</text><text class="c-sub" x="170" y="202">{sub}</text></svg></span>')


def why_paras(text):
    return "".join(f"<p>{to_html(p.strip())}</p>" for p in re.split(r"\n\s*\n", text or "") if p.strip())


def why_section(cv):
    w = cv.get("site", {}).get("why") or {}
    sci, his = why_paras(w.get("molecules")), why_paras(w.get("manuscripts"))
    if not (sci and his):
        return ""
    shared = f'\n    <figcaption class="why-shared">{to_html(w["shared"])}</figcaption>' if w.get("shared") else ""
    shared += f'\n    <p class="why-intro">{INTRO}</p>'
    return f'''<section class="wrap why" aria-labelledby="why-h">
  <h2 class="sr-only" id="why-h">Why molecules and manuscripts</h2>
  <figure class="why-fig">
    <div class="why-card">
      <button class="coin" type="button" aria-pressed="false" aria-label="Turn the coin over for the other story. One side shows the peptide CAP8, the other the first eight letters of the Gurmukhi alphabet.">
        <span class="coin-tip"><span class="coin-turn">{coin_face("s")}{coin_face("h")}</span></span>
      </button>
      <p class="coin-hint" aria-live="polite"></p>
    </div>{shared}
  </figure>
  <div class="why-stories">
    <div class="why-story why-story--s" data-side="molecules">{sci}</div>
    <div class="why-story why-story--h" data-side="manuscripts">{his}</div>
  </div>
</section>

'''


# ──────────────────────────────────────────────────────────── linkedin ──
# site.linkedin in cv.json lists post links (added in admin); tools/linkedin.py, run just before this
# script by the GitHub Action, reads each post's text and picture into data/linkedin.json.
LI_FIELDS = {"science": ("li--sci", "Science"), "history": ("li--his", "History")}


def li_date(post_id):
    # LinkedIn post ids carry their own timestamp: the top bits are milliseconds since 1970
    ms = int(post_id) >> 22
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).strftime("%b %Y")


def li_href(p):
    u = (p.get("url") or "").split("?")[0]
    if re.match(r"https://(www\.)?linkedin\.com/(posts|feed/update)/", u):
        return u
    return "https://www.linkedin.com/feed/update/urn:li:%s:%s/" % (p.get("kind", "activity"), p["id"])


def linkedin_section(cv):
    li = cv.get("site", {}).get("linkedin") or {}
    posts = [p for p in li.get("posts", []) if str(p.get("id", "")).isdigit()]
    if not posts:
        return ""
    cache = {}
    path = os.path.join(ROOT, "data", "linkedin.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            cache = json.load(f).get("posts", {})
    posts.sort(key=lambda p: int(p["id"]), reverse=True)
    esc = html.escape
    cards = []
    for p in posts[:max(1, min(6, int(li.get("show", 3))))]:
        got = cache.get(p["id"], {})
        text = " ".join((p.get("text") or got.get("text") or "").split())
        img = got.get("image", "")
        if img and not os.path.exists(os.path.join(ROOT, img)):
            img = ""
        cls, label = LI_FIELDS.get(p.get("field"), ("li--other", ""))
        kick = (label + " &middot; " if label else "") + li_date(p["id"])
        if img:
            media = f'<div class="li-media"><img src="{esc(img)}" alt="" loading="lazy"></div>'
        else:
            parts = re.split(r"(?<=[.!?])\s+", text, maxsplit=1) if text else ["A post on LinkedIn"]
            first, rest = parts[0], (parts[1] if len(parts) > 1 else "")
            if len(first) <= 140:
                quote, text = esc(first), rest.strip()     # the card goes on from the second sentence
            else:
                quote = esc(first[:137].rsplit(" ", 1)[0]) + "&hellip;"
            media = f'<div class="li-media li-media--quote"><p>{quote}</p></div>'
        body = f'<p class="li-text">{esc(text)}</p>' if text else ""
        cards.append(f'<a class="li-card {cls}" href="{esc(li_href(p))}" rel="noopener">{media}'
                     f'<div class="li-body"><p class="kicker li-kick">{kick}</p>{body}<span class="li-go">Read on LinkedIn &nearr;</span></div></a>')
    return f'''<section class="wrap sec" id="linkedin" aria-labelledby="li-h">
  <h2 class="sr-only" id="li-h">Latest posts on LinkedIn</h2>
  <div class="li-row" tabindex="0" aria-label="Latest LinkedIn posts">{"".join(cards)}</div>
</section>
'''


# ─────────────────────────────────────────────────────────── page parts ──
CSS_V = 13
# the menu, in order; { } (pager.js) steps through the same pages with Home in front
NAV = [("cv.html", "CV"), ("science.html", "Science"), ("history.html", "History"), ("about.html", "About")]
INTRO = ("I design therapeutic peptides with KumarLab, work on computational protein design at Imperial College London, "
         "and build mathematical models of systems too messy to measure directly at NJIT. As an Emerging Scholars Research "
         "Fellow at the Harvard Sikh Center, I study how the early Khalsa came to speak for the Sikh panth.")


def site_header(current=None):
    links = "".join('\n    <a href="{}"{}>{}</a>'.format(h, ' aria-current="page"' if h == current else "", n) for h, n in NAV)
    return f'''<header class="wrap top">
  <a class="brand" href="./">Kabir Singh</a>
  <nav class="nav" aria-label="Site">{links}
  </nav>
</header>'''


def site_footer(m):
    esc = html.escape
    return f'''<footer class="foot">
  <div class="wrap">
    <p class="meta">Last updated {esc(m.get("asOf", ""))}. Plain HTML; CV typeset in LaTeX.<br><a href="mailto:{esc(m.get("email", ""))}">{esc(m.get("email", ""))}</a> &middot; <a href="admin.html">Admin</a></p>
    <div class="sign-off">
      <p class="coin" lang="fa" dir="rtl" title="Deg o tegh o fateh o nusrat-i bedirang, yāft az Nānak Gurū Gobind Singh">دیگ و تیغ و فتح و نصرت بیدرنگ<br>یافت از نانک گورو گوبند سنگه</p>
      <p class="pa" lang="pa">ਅਕਾਲ ਸਹਾਇ</p>
    </div>
  </div>
</footer>'''


def timeline_section(cv):
    """Every CV entry by year, with the kind filters and the certifications (the CV page)."""
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
    return f'''<section class="wrap sec" id="timeline" aria-labelledby="tl-h">
  <div class="sec-h"><h2 id="tl-h">Since {first_year}</h2><p>Every entry on the CV, newest first, under the year it began. Filter by kind; certifications are listed at the end.</p></div>
  <div class="filters" role="group" aria-label="Filter the timeline">{btns}</div>
  <div id="years">{"".join(years)}</div>
  <div class="sec-h sec-h--small"><h2>Certifications &amp; licenses</h2></div>
  <ul class="certs">{cert_html}</ul>
</section>'''


TIMELINE_JS = """<script>
/* Timeline filter: hides rows of other kinds and any year left empty. */
(function () {
  var btns = [].slice.call(document.querySelectorAll('.filters button'));
  var years = [].slice.call(document.querySelectorAll('#years .year'));
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      var c = b.getAttribute('data-c');
      btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      years.forEach(function (y) {
        var any = false;
        [].forEach.call(y.querySelectorAll('.items > li'), function (li) {
          var on = c === 'all' || li.getAttribute('data-c') === c;
          li.hidden = !on; if (on) any = true;
        });
        y.hidden = !any;
      });
    });
  });
})();
</script>"""


def build_index(cv):
    m = cv["meta"]
    esc = html.escape
    linkedin_html = linkedin_section(cv)
    why_html = why_section(cv)
    intro_html = "" if why_html else f'\n    <p class="intro">{INTRO}</p>'   # with the coin, the paragraph sits under it
    coin_js = '\n<script src="coin.js?v=1" defer></script>' if why_html else ""
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

    linkedin = esc(m.get("linkedin", ""))

    return f'''<!DOCTYPE html>
<!-- GENERATED from data/cv.json by tools/build.py. Edit through admin.html; changes made here are overwritten on the next build. -->
<html lang="en" data-home="diptych">
<head>
<meta charset="utf-8">
<script src="home.js?v={HOME_JS_V}"></script>
<script src="arrival.js?v={ARRIVAL_JS_V}"></script>
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
<link rel="stylesheet" href="style.css?v={CSS_V}">
<script src="theme.js?v=1"></script>
<script src="peek.js?v=9" defer></script>
<script src="pager.js?v=1" defer></script>{coin_js}
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
{site_header()}
<main>

<section class="wrap hero" aria-label="Introduction">
  <div>
    <p class="kicker">Mathematical Biology &middot; NJIT Honors College &middot; Class of 2027</p>
    <div class="names"><h1>Kabir Singh</h1><p class="pa-name" lang="pa">ਕਬੀਰ ਸਿੰਘ</p></div>
    <p class="thesis">I study <em class="s">molecules</em> and <em class="h">manuscripts</em>.</p>{intro_html}
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

{linkedin_html}{why_html}<section class="wrap" aria-label="Two lines of work">
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

</main>

{site_footer(m)}
</body>
</html>
'''


def build_cv(cv):
    """cv.html: the whole record, with the protein drawn from it and the PDF."""
    m = cv["meta"]
    esc = html.escape
    pdata = protein_data(cv)
    protein_html = protein_section(pdata) if pdata else ""
    protein_js = '\n<script src="protein.js?v=1" defer></script>' if pdata else ""
    return f'''<!DOCTYPE html>
<!-- GENERATED from data/cv.json by tools/build.py. Edit through admin.html; changes made here are overwritten on the next build. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>CV — Kabir Singh</title>
<link rel="canonical" href="https://kabirsinghji.github.io/cv.html">
<meta name="description" content="Kabir Singh's CV: every entry, newest first, the whole record drawn as a protein, certifications, and the PDF.">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preload" href="fonts/spectral-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/hanken-grotesk-latin-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css?v={CSS_V}">
<script src="theme.js?v=1"></script>
<script src="peek.js?v=9" defer></script>
<script src="pager.js?v=1" defer></script>{protein_js}
</head>
<body class="cv-page">
{site_header("cv.html")}
<main>

<section class="wrap cv-head" aria-labelledby="cv-h">
  <div>
    <p class="kicker">Curriculum vitae &middot; as of {esc(m.get("asOf", ""))}</p>
    <h1 id="cv-h">CV</h1>
  </div>
  <p class="cv-pdf"><a class="pill" href="cv/cv.pdf">Download the PDF</a></p>
</section>

{protein_html}
{timeline_section(cv)}
</main>

{site_footer(m)}

{TIMELINE_JS}
</body>
</html>
'''


# ──────────────────────────────────────────────────── homepage designs ──
# The homepage comes in five designs: index.html (build_index, above) and the four built here.
# home.js picks one per visit, or the one the visitor kept. All five read the same cv.json, so a
# save in admin.html updates every design. home.css styles these four; style.css everything else.
HOME_JS_V = 2
HOME_CSS_V = 1
# arrival.js plays a short welcome on a visitor's first arrival (arrival/: the procession and the fold)
ARRIVAL_JS_V = 1
ORCID = "https://orcid.org/0009-0002-5159-5879"
SCHOLAR = "https://scholar.google.com/citations?user=-RpJmPsAAAAJ"
PA_DIGITS = str.maketrans("0123456789", "੦੧੨੩੪੫੬੭੮੯")
KICKER = "Mathematical Biology &middot; NJIT Honors College &middot; Class of 2027"


def design_page(design, body_class, body):
    return f'''<!DOCTYPE html>
<!-- GENERATED from data/cv.json by tools/build.py. Edit through admin.html; changes made here are overwritten on the next build. -->
<html lang="en" data-home="{design}">
<head>
<meta charset="utf-8">
<script src="home.js?v={HOME_JS_V}"></script>
<script src="arrival.js?v={ARRIVAL_JS_V}"></script>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kabir Singh</title>
<link rel="canonical" href="https://kabirsinghji.github.io/">
<meta name="description" content="Kabir Singh — Mathematical Biology, NJIT. Computational protein and peptide design, mathematical neuroscience, the history of medicine, and early modern Sikh history.">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="home.css?v={HOME_CSS_V}">
<script src="peek.js?v=9" defer></script>
</head>
<body class="{body_class}">
{body}
</body>
</html>
'''


def design_parts(cv):
    """What every design shares: projects by field, the menu, the contact links, the footer line."""
    m = cv["meta"]
    esc = html.escape
    projects = cv.get("site", {}).get("projects", [])
    sci = [p for p in projects if p.get("field") == "science"]
    his = [p for p in projects if p.get("field") == "history"]
    nav = "".join(f'<a href="{h}">{n}</a>' for h, n in NAV)
    contact = (f'<li><a class="pill" href="cv/cv.pdf">Full CV (PDF)</a></li>'
               f'<li><a href="mailto:{esc(m.get("email", ""))}">{esc(m.get("email", ""))}</a></li>'
               f'<li><a href="{esc(m.get("linkedin", ""))}">LinkedIn</a></li>'
               f'<li><a href="{ORCID}">ORCID</a></li><li><a href="{SCHOLAR}">Google Scholar</a></li>')
    meta = f'Last updated {esc(m.get("asOf", ""))} &middot; <a href="admin.html">Admin</a>'
    return sci, his, nav, contact, meta


def project_li(p):
    return '<li><a href="{}"><span class="t">{}</span><span class="st">{} &middot; {}</span></a></li>'.format(
        html.escape(p.get("href", "#")), to_html(p["title"]), to_html(p.get("years", "")), to_html(p.get("status", "")))


def first_published(cv):
    for sec in cv["sections"]:
        if sec["type"] == "publications":
            for g in sec.get("groups", []):
                if g.get("status") == "published":
                    pub = next((p for p in g.get("items", []) if shown(p, "site")), None)
                    if pub:
                        return pub
    return None


# Timescale: everything on one log axis of seconds, 10^-15 at the left edge to 10^11 at the right.
YEAR_S = 3.156e7
# (seconds, side of the axis, leader length px, label width px, colour, kicker, line, link)
TIME_MARKS = [
    (2e-15, "below", 150, 240, "green", "2 femtoseconds", "One step of the molecular dynamics I run", "science.html"),
    (1e-8, "below", 150, 250, "green", "Nanoseconds", "CAP8 holds the antibody’s binding pocket", "science.html"),
    (1e-3, "below", 240, 250, "sky", "A millisecond", "A neuron fires; I reduce the models that describe it", "science.html"),
    (600, "above", 150, 270, "orange", "The next ten minutes", "On the ambulance: EMT, NJIT First Aid Squad", "about.html"),
    (10 * YEAR_S, "above", 70, 270, "sky", "The next ten years", "In the lab: peptides from model to patient", "science.html"),
    (100 * YEAR_S, "above", 230, 290, "gold", "A century", "How American medicine learned to talk about dying", "history-of-medicine.html"),
    ("khalsa", "above", 310, 300, "gold", "", "How the early Khalsa came to speak for the panth", "sikh-studies.html"),
    (700 * YEAR_S, "above", 390, 300, "gold", "Centuries", "Mapping religion in the medieval Italian city", "medieval-italy.html"),
]
TIME_UNITS = [(1e-12, "ps"), (1e-9, "ns"), (1e-6, "µs"), (1, "second"), (3600, "hour"), (86400, "day"), (YEAR_S, "year")]


def time_x(seconds):
    return (math.log10(seconds) + 15) / 26 * 100


def build_timescale(cv):
    sci, his, nav, contact, meta = design_parts(cv)
    khalsa = datetime.date.today().year - 1699
    ticks = "".join(f'<span class="tick" style="left:{i / 26 * 100:.3f}%"></span>' for i in range(27))
    pows = "".join('<span class="pow{}" style="left:{:.3f}%">10<sup>{}</sup>{}</span>'.format(
        " pow--first" if e == -15 else "", (e + 15) / 26 * 100, str(e).replace("-", "−"), " s" if e == -15 else "")
        for e in range(-15, 10, 3))
    units = "".join(f'<span class="unit" style="left:{time_x(s):.2f}%">{u}</span>' for s, u in TIME_UNITS)
    marks, dots = [], []
    for s, side, h, w, c, kicker, line, href in TIME_MARKS:
        if s == "khalsa":
            s, kicker = khalsa * YEAR_S, f"1699 → now &middot; {khalsa} years"
        x = time_x(s)
        pos = f"left:{x:.2f}%;top:421px" if side == "below" else f"right:{100 - x:.2f}%;top:{420 - h}px"
        marks.append(f'<a class="mk mk--{side} c-{c}" href="{href}" style="{pos};height:{h}px;width:{w}px">'
                     f'<span class="k">{kicker}</span><span class="t">{line}</span></a>')
        big = " dot--big" if kicker.startswith("The next") else ""
        dots.append(f'<span class="dot{big} c-{c}" style="left:{x:.2f}%"></span>')
    return design_page("timescale", "v-time", f'''<header class="wrap top">
  <a class="brand" href="./"><b>Kabir Singh</b><span class="pa" lang="pa">ਕਬੀਰ ਸਿੰਘ</span></a>
  <nav class="nav" aria-label="Site">{nav}</nav>
</header>
<main class="wrap">

<section class="ts-hero" aria-labelledby="ts-h">
  <p class="kicker">{KICKER}</p>
  <h1 id="ts-h">Kabir Singh</h1>
  <p class="ts-line">From a <span class="c-green">two-femtosecond</span> simulation step to a <span class="c-gold">{khalsa}-year-old</span> question: my work spans 25 orders of magnitude of time.</p>
</section>

<section class="axis-scroll" aria-label="My work on one time axis, in seconds, log scale">
  <div class="axis">
    <div class="axis-line" aria-hidden="true"></div>
    <div aria-hidden="true">{ticks}{pows}{units}</div>
    {"".join(marks)}
    <div aria-hidden="true">{"".join(dots)}</div>
    <p class="axis-cap" aria-hidden="true">time in seconds, log scale &rarr;</p>
  </div>
</section>

<section class="hz" aria-label="Three horizons">
  <article class="c-orange">
    <h2>The next ten minutes</h2>
    <p>New Jersey EMT and NJIT First Aid Squad: medicine as one patient, right now.</p>
  </article>
  <article class="c-sky">
    <h2>The next ten years</h2>
    <ul>{"".join(project_li(p) for p in sci)}</ul>
    <a class="go" href="science.html">Scientific research &rarr;</a>
  </article>
  <article class="c-gold">
    <h2>The last few centuries</h2>
    <ul>{"".join(project_li(p) for p in his)}</ul>
    <a class="go" href="history.html">History research &rarr;</a>
  </article>
</section>

<footer class="ts-foot">
  <ul class="contact">{contact}</ul>
  <p class="meta">{meta}</p>
</footer>
</main>''')


def build_folio(cv):
    sci, his, _, contact, _ = design_parts(cv)
    esc = html.escape

    def marg(ps, right=False):
        out = []
        for i, p in enumerate(ps, 1):
            num = f'<span class="n pa" lang="pa">{str(i).translate(PA_DIGITS)}</span>'
            title = f'<em>{to_html(p["title"])}</em>'
            out.append('<li><a href="{}">{}<span class="y">{}</span></a></li>'.format(
                esc(p.get("href", "#")), f"{title} {num}" if right else f"{num} {title}", to_html(p.get("years", ""))))
        return "".join(out)

    leaves = [("./", "Home")] + NAV
    pa = lambda n: f'<span class="pa" lang="pa">{str(n).translate(PA_DIGITS)}</span>'
    leaf_nav = "".join('<a href="{}"{}>{} {}</a>'.format(h, ' aria-current="page"' if i == 0 else "", pa(i + 1), n)
                       for i, (h, n) in enumerate(leaves))
    (prev_h, prev_n), (next_h, next_n) = leaves[-1], leaves[1]
    return design_page("folio", "v-folio", f'''<div class="fo">
<header class="fo-head">
  <p class="mono">kabirsinghji.github.io &middot; leaf {pa(1)} of {pa(len(leaves))}</p>
  <nav aria-label="Leaves">{leaf_nav}</nav>
</header>

<main class="leaf">
  <div class="leaf-b1"><div class="leaf-b2">
    <div class="leaf-run">
      <span class="mono">Molecules &amp; manuscripts</span>
      <p class="pa inv" lang="pa">ਅਕਾਲ ਸਹਾਇ</p>
      <span class="pa folio-n" lang="pa" aria-label="Leaf one">੧</span>
    </div>
    <div class="leaf-cols">
      <aside class="marg" aria-label="Science">
        <h2><span class="pa" lang="pa">ਵਿਗਿਆਨ</span><span class="sc">science</span></h2>
        <ol>{marg(sci)}</ol>
        <a class="more" href="science.html">all science &rarr;</a>
      </aside>
      <div class="fo-center">
        <h1><span class="pa" lang="pa">ਕਬੀਰਸਿੰਘ</span><span class="sc">kabir singh</span></h1>
        <p class="fo-thesis">I study molecules and manuscripts: two sides of one coin.</p>
        <div class="ruled"><p><span class="cap">{INTRO[0]}</span>{INTRO[1:]}</p></div>
        <figure class="illum">
          <img src="sangat-woodcut.webp" alt="Early printed illustration of a Sikh sangat seated before a granthi, with the Mool Mantar in Gurmukhi" width="624" height="264" loading="lazy">
          <figcaption>The sangat hearing katha, early print</figcaption>
        </figure>
      </div>
      <aside class="marg marg--r" aria-label="History">
        <h2><span class="pa" lang="pa">ਇਤਿਹਾਸ</span><span class="sc">history</span></h2>
        <ol>{marg(his, right=True)}</ol>
        <a class="more" href="history.html">all history &rarr;</a>
        <img class="fo-photo" src="photo-arch.webp" alt="Portrait of Kabir Singh in a khaki turban and dark suit" width="716" height="895">
      </aside>
    </div>
    <footer class="leaf-foot">
      <p class="colophon">Colophon: revised {esc(cv["meta"].get("asOf", ""))} &middot; plain HTML, CV typeset in LaTeX &middot; <a href="admin.html">Admin</a></p>
      <ul class="contact">{contact}</ul>
    </footer>
  </div></div>
  <span class="corner" aria-hidden="true"></span>
</main>

<nav class="turn" aria-label="Turn the leaf">
  <a href="{prev_h}">&larr; {pa(len(leaves))} {prev_n}</a>
  <a class="next" href="{next_h}">Turn the leaf {pa(2)} {next_n} &rarr;</a>
</nav>
</div>''')


def build_pdb(cv):
    sci, his, _, _, meta = design_parts(cv)
    m = cv["meta"]
    esc = html.escape
    rows = []                                        # (line html, link or None)

    def rec(kw, rest="", cls="kh", href=None):      # rest is already HTML
        rows.append((f'<span class="{cls}">{kw}</span>{rest}', href))

    def remark(text, href=None):
        rows.append((f'<span class="kr">{esc(text)}</span>', href))

    def wrap(tokens, sep, width=51):
        lines, cur = [], ""
        for t in tokens:
            nxt = cur + sep + t if cur else t
            if cur and len(nxt) > width:
                lines.append(cur + sep.strip())
                cur = t
            else:
                cur = nxt
        return lines + [cur]

    today = datetime.date.today().strftime("%d-%b-%y").upper()
    rec("HEADER", esc(f"    {'PHYSICIAN-SCIENTIST (IN TRAINING)':<40}{today}   KSNG"))
    rec("TITLE", '     <span class="t">KABIR SINGH: MOLECULES AND MANUSCRIPTS</span>')
    rec("COMPND", "    MOL_ID: 1;")
    rec("COMPND", "   2 MOLECULE: MATHEMATICAL BIOLOGY UNDERGRADUATE;")
    rec("COMPND", "   3 AFFILIATION: NJIT, ALBERT DORMAN HONORS COLLEGE;")
    rec("COMPND", "   4 CLASS: 2027;")
    rec("SOURCE", '    GURMUKHI_NAME: <span class="pa" lang="pa">ਕਬੀਰ ਸਿੰਘ</span>;')
    rec("KEYWDS", "    CYCLIC PEPTIDE, PROTEIN DESIGN, MATHEMATICAL NEUROSCIENCE,")
    rec("KEYWDS", "   2 HISTORY OF MEDICINE, EARLY MODERN SIKH HISTORY")
    rec("EXPDTA", "    THEORETICAL MODEL; ARCHIVAL RESEARCH")
    rec("AUTHOR", '    <span class="t">K.SINGH</span>')
    pub = first_published(cv)
    if pub:
        doi = "https://doi.org/" + pub["doi"] if pub.get("doi") else "science.html"
        authors = [a.strip().replace(". ", ".").replace(" ", "").upper() for a in plain(pub["authors"]).split(",")]
        for i, line in enumerate(wrap(authors, ",")):
            rec("JRNL", esc(f"        AUTH {'' if i == 0 else i + 1:<2}{line}").replace("K.SINGH", '<span class="t">K.SINGH</span>'), "kj", doi)
        for i, line in enumerate(wrap(plain(pub["title"]).upper().split(), " ")):
            rec("JRNL", esc(f"        TITL {'' if i == 0 else i + 1:<2}") + f'<span class="t">{esc(line)}</span>', "kj", doi)
        rec("JRNL", esc(f"        REF    {plain(pub.get('venue', '')).upper()}"), "kj", doi)
        if pub.get("doi"):
            rec("JRNL", esc(f"        DOI    {pub['doi'].upper()}"), "kj", doi)
    remark("REMARK   2 RESOLUTION. 10 MINUTES (AMBULANCE) TO 10 YEARS (LAB).")
    remark("REMARK   3 TRANSLATIONAL MEDICINE SITS BETWEEN THE TWO.")
    remark("REMARK 200 LABS: KUMARLAB, NJIT; IMPERIAL COLLEGE LONDON.")
    remark("REMARK 200 FELLOW: HARVARD SIKH CENTER, EMERGING SCHOLARS.")
    remark("REMARK 350 22ND EDITOR-IN-CHIEF, JOURNAL OF YOUNG INVESTIGATORS.")
    remark("REMARK 350 EMT, NJIT FIRST AID SQUAD.")
    remark("REMARK 465 MISSING RESIDUES: SLEEP.")
    rows.append(('<span class="kr">REMARK 800 SITE_IDENTIFIER: </span><span class="t">TRANSLATIONAL MEDICINE</span>', None))
    rec("SEQRES", '   1 P    8  <span class="p">LYS PRO TYR PRO PHE TRP ASP ASP</span>             <span class="kr">CAP8</span>', "kj")
    rec("HETNAM", "     MOL MOLECULES   (SCIENCE)", "ka")
    rec("HETNAM", "     MSS MANUSCRIPTS (HISTORY)", "ka")
    atoms = [("S", "MOL", "A", "t", p) for p in sci] + [("H", "MSS", "B", "t th", p) for p in his]
    count = {"S": 0, "H": 0}
    for serial, (f, resn, chain, cls, p) in enumerate(atoms, 1):
        count[f] += 1
        year = re.search(r"\d{4}", plain(p.get("years", "")))
        cols = esc(f"{serial:>5}  {f + format(count[f], '02d'):<4}{resn} {chain}{year.group(0) if year else '':>4}    ")
        rec("HETATM", cols + f'<span class="{cls}">{esc(plain(p["title"]).upper())}</span>', "ka", p.get("href", "#"))
    rec("CONECT", "".join(f"{i:>5}" for i in range(1, len(atoms) + 1)))
    rows.append(('<span class="kr">REMARK 999 CONTACT: </span><span class="t">{}</span><span class="kr">  ORCID {}</span>'.format(
        esc(m.get("email", "")).upper(), ORCID.rsplit("/", 1)[-1]), "mailto:" + m.get("email", "")))
    rec("END", '<span class="caret" aria-hidden="true"></span>')

    lines = []
    for i, (body, href) in enumerate(rows, 1):
        cls = "ln ln--on" if i == 1 else "ln"
        inner = f'<span class="g">{i}</span><span class="c">{body}</span>'
        lines.append(f'<a class="{cls}" href="{esc(href)}">{inner}</a>' if href else f'<div class="{cls}">{inner}</div>')
    fake = {"cv.html": "cv.tex", "science.html": "science.pdb", "history.html": "history.txt", "about.html": "about.md"}
    tabs = '<a href="./" aria-current="page">kabir_singh.pdb</a>' + "".join(f'<a href="{h}">{fake.get(h, h)}</a>' for h, n in NAV)
    return design_page("pdb", "v-pdb", f'''<main class="ide">
<h1 class="sr-only">Kabir Singh</h1>
<div class="win">
  <nav class="tabs" aria-label="Site">{tabs}</nav>
  <div class="panes">
    <div class="code" aria-label="kabir_singh.pdb">
{chr(10).join(lines)}
    </div>
    <aside class="viewer" aria-label="Structure viewer">
      <div class="viewer-bar">
        <span>viewer &middot; anti-GlialCAM Fab + CAP8</span>
        <span class="legend"><span><i style="background:#8EA3D6"></i>light</span><span><i style="background:#CC8784"></i>heavy</span><span><i style="background:#7FCB9E"></i>CAP8</span></span>
      </div>
      <div class="viewer-stage"><img src="structures/cap8-glialcam-alpha.webp" alt="CAP8 (green) bound in the antigen-binding site of an anti-GlialCAM autoantibody" width="733" height="894"></div>
      <div class="author">
        <img src="photo-arch.webp" alt="Kabir Singh" width="716" height="895">
        <div><b>AUTHOR K.SINGH</b>Mathematical Biology, NJIT &middot; &rsquo;27</div>
        <a class="dl" href="cv/cv.pdf">cv.pdf &darr;</a>
      </div>
      <div class="prompt" aria-hidden="true"><p>&gt; select kabir, resn MOL+MSS</p><p>&gt; show everything<span class="caret"></span></p></div>
    </aside>
  </div>
  <div class="status">
    <span>PDB &middot; {len(rows)} records &middot; UTF-8</span>
    <span><a href="{esc(m.get("linkedin", ""))}">LinkedIn</a><a href="{ORCID}">ORCID</a><a href="{SCHOLAR}">Scholar</a><span class="meta">{meta}</span></span>
  </div>
</div>
</main>''')


# Landscape: the map is drawn in a 1200 × 720 box. Each project sits in the next free basin of its
# field: (x, y, rotation, contour shape, x scale, y scale, rings, label side). The last slot of each
# field is spare; projects beyond the slots are listed under the map.
LAND_SLOTS = {
    "science": [(300, 420, -12, "a", 1.2, 1.2, 6, "r"), (520, 300, 30, "b", .9, .7, 4, "r"), (210, 230, -35, "b", .85, .85, 4, "r"),
                (470, 570, 15, "a", .8, .6, 3, "r"), (140, 530, 50, "b", .7, .7, 3, "r"), (560, 140, 10, "a", .7, .55, 3, "r")],
    "history": [(930, 300, -20, "a", 1.05, .85, 5, "r"), (850, 560, 25, "b", .8, .8, 3, "r"), (1090, 640, -40, "a", .75, .55, 3, "l"),
                (1040, 190, 20, "b", .7, .6, 3, "l")],
}
BLOB = {"a": "M -100 -8 C -96 -62 -38 -98 18 -94 C 74 -90 108 -52 104 0 C 100 54 58 96 4 98 C -52 100 -104 48 -100 -8 Z",
        "b": "M -96 -20 C -84 -72 -20 -102 36 -88 C 92 -74 110 -18 100 30 C 90 80 34 104 -20 94 C -74 84 -108 30 -96 -20 Z"}
LAND_COLOUR = {"science": "#8BBEEA", "history": "#D9B96F"}


def contours(x, y, rot, shape, sx, sy, rings, colour, opacity=".7"):
    paths = []
    for i in range(rings):
        k = 1 - i * .78 / max(rings - 1, 1)          # outermost ring at full size, innermost at 0.22
        fill = f' fill="{colour}" fill-opacity=".18"' if i == rings - 1 else ""
        paths.append(f'<path transform="scale({sx * k:.3f} {sy * k:.3f})" vector-effect="non-scaling-stroke" d="{BLOB[shape]}"{fill}></path>')
    return f'<g transform="translate({x} {y}) rotate({rot})" stroke="{colour}" stroke-opacity="{opacity}">{"".join(paths)}</g>'


def build_landscape(cv):
    sci, his, nav, contact, meta = design_parts(cv)
    esc = html.escape
    rings, dots, labels, extra = [], [], [], []
    for field, ps in (("science", sci), ("history", his)):
        slots, colour = LAND_SLOTS[field], LAND_COLOUR[field]
        for p, (x, y, rot, shape, sx, sy, n, side) in zip(ps, slots):
            rings.append(contours(x, y, rot, shape, sx, sy, n, colour))
            dots.append(f'<circle cx="{x}" cy="{y}" r="5" fill="{colour}"></circle>')
            px, py = x / 12, y / 7.2
            pos = f"left:calc({px:.2f}% + 14px)" if side == "r" else f"right:calc({100 - px:.2f}% + 14px)"
            labels.append('<a class="lbl lbl--{} c-{}" href="{}" style="{};top:calc({:.2f}% - 20px)"><b>{}</b><span>{}</span></a>'.format(
                side, field, esc(p.get("href", "#")), pos, py, to_html(p["title"]), esc(plain(p.get("years", "")).upper())))
        extra += ps[len(slots):]
    also = ""
    if extra:
        also = '<p class="also">Also: ' + ", ".join(f'<a href="{esc(p.get("href", "#"))}">{to_html(p["title"])}</a>' for p in extra) + ".</p>"
    return design_page("landscape", "v-land", f'''<header class="wrap top">
  <a class="brand" href="./"><b>Kabir Singh</b><span class="pa" lang="pa">ਕਬੀਰ ਸਿੰਘ</span></a>
  <nav class="nav" aria-label="Site">{nav}</nav>
</header>
<main class="wrap">

<section class="ls-hero" aria-labelledby="ls-h">
  <div>
    <p class="kicker">A map of my work &middot; lower is further along</p>
    <h1 id="ls-h">Two slopes, <em>one</em> basin.</h1>
  </div>
  <p>I stumbled into research and into history. Every project here is a minimum I found along the way. Both sides drain toward the same place.</p>
</section>

<p class="map-hint" aria-hidden="true">Swipe the map &rarr;</p>
<section class="map-scroll" aria-label="My projects as minima on an energy landscape">
  <div class="map">
    <svg viewBox="0 0 1200 720" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="none" stroke-width="1">
        <g transform="translate(620 400)" stroke="#5E7088" stroke-opacity=".45">
          <path transform="scale(6.4 4.1)" vector-effect="non-scaling-stroke" d="{BLOB["a"]}"></path>
          <path transform="scale(5.7 3.6)" vector-effect="non-scaling-stroke" d="{BLOB["b"]}"></path>
        </g>
        <g transform="translate(330 400)" stroke="#8BBEEA" stroke-opacity=".32">
          <path transform="scale(3.3 2.75)" vector-effect="non-scaling-stroke" d="{BLOB["b"]}"></path>
          <path transform="scale(2.85 2.35)" vector-effect="non-scaling-stroke" d="{BLOB["a"]}"></path>
        </g>
        <g transform="translate(950 440)" stroke="#D9B96F" stroke-opacity=".32">
          <path transform="scale(2.6 2.5)" vector-effect="non-scaling-stroke" d="{BLOB["a"]}"></path>
          <path transform="scale(2.2 2.1)" vector-effect="non-scaling-stroke" d="{BLOB["b"]}"></path>
        </g>
        {"".join(rings)}
        {contours(680, 430, 8, "b", 1.35, 1.1, 8, "#ECEDEF", ".8")}
      </g>
      <path d="M 70 70 C 200 90 420 160 520 300 C 600 410 430 470 300 420 C 230 392 400 520 560 470 C 612 452 650 440 680 430" fill="none" stroke="#8BBEEA" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"></path>
      <path d="M 1150 70 C 1080 150 980 200 930 300 C 880 400 920 500 850 560 C 780 610 720 480 680 430" fill="none" stroke="#D9B96F" stroke-width="2" stroke-dasharray="2 7" stroke-linecap="round"></path>
      <circle cx="70" cy="70" r="5" fill="none" stroke="#8BBEEA" stroke-width="2"></circle>
      <circle cx="1150" cy="70" r="5" fill="none" stroke="#D9B96F" stroke-width="2"></circle>
      {"".join(dots)}
      <circle cx="680" cy="430" r="9" fill="#ECEDEF"></circle>
      <circle cx="680" cy="430" r="16" fill="none" stroke="#ECEDEF" stroke-opacity=".5"></circle>
    </svg>
    <p class="start c-science" style="left:calc(5.83% + 14px);top:calc(9.72% - 12px)">START &middot; 2023<br><span>a math major in a peptide lab</span></p>
    <p class="start c-history" style="right:calc(4.17% + 14px);top:calc(9.72% - 12px);text-align:right">START &middot; SWEDEN<br><span>studying abroad, met a historian</span></p>
    {"".join(labels)}
    <a class="global" href="about.html" style="left:56.67%;top:calc(59.72% + 26px)"><b>Translational medicine</b><span>GLOBAL MINIMUM &middot; WHERE I&rsquo;M HEADED</span></a>
    <p class="side c-science" style="left:24px" aria-hidden="true">MOLECULES</p>
    <p class="side c-history" style="right:24px" aria-hidden="true">MANUSCRIPTS</p>
  </div>
</section>
{also}
<footer class="ls-foot">
  <p class="note">Contours are illustrative, not to scale &middot; dotted lines: the path I took</p>
  <ul class="contact">{contact}</ul>
  <p class="meta">{meta}</p>
</footer>
</main>''')


# ──────────────────────────────────────────────────────────────── main ──
def main():
    with open(os.path.join(ROOT, "data", "cv.json"), encoding="utf-8") as f:
        cv = json.load(f)
    outputs = {"cv/cv.tex": build_tex(cv), "index.html": build_index(cv), "cv.html": build_cv(cv),
               "home-timescale.html": build_timescale(cv), "home-folio.html": build_folio(cv),
               "home-pdb.html": build_pdb(cv), "home-landscape.html": build_landscape(cv)}
    for rel, text in outputs.items():
        with open(os.path.join(ROOT, rel), "w", encoding="utf-8") as f:
            f.write(text)
        print("wrote", rel)


if __name__ == "__main__":
    sys.exit(main())
