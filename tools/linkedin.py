#!/usr/bin/env python3
"""Fill the homepage's LinkedIn cards from the posts listed in data/cv.json.

cv.json → site.linkedin = {"show": 3, "posts": [{"url", "id", "kind", "field", "text"?}], "sync"?: ISO time}
For each post this reads LinkedIn's public embed page (the one an "Embed this post" iframe loads),
takes the post's text and first picture, and saves:
  data/linkedin.json   text, picture path and status per post (admin.html shows the status)
  linkedin/<id>.<ext>  the picture, kept in the repo because LinkedIn's image links expire
Only the newest posts (as many as the homepage shows) are read. A post is read when it is new,
when its last read failed, or when admin's Sync button set a newer "sync" time. Nothing here can
fail the build: if LinkedIn refuses, the post keeps its previous text (or none) and admin shows why.
"""
import datetime
import html
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "linkedin.json")
IMG_DIR = os.path.join(ROOT, "linkedin")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
# post pictures live under these media.licdn.com paths; avatars and logos do not
PICTURE = re.compile(r"feedshare|image-shrink|videocover|articleshare|article-cover|document-cover", re.I)
NOT_PICTURE = re.compile(r"profile-displayphoto|profile-framedphoto|company-logo|background", re.I)
# what LinkedIn's sign-in and error pages say about LinkedIn itself; never a post's text
GENERIC = re.compile(r"million\+ members|billion\+? members|Manage your professional identity|"
                     r"Welcome to your professional community|Sign in to view|Join now to see", re.I)


def now():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=25) as r:
        body = r.read(6_000_000)
        return (body, r.headers.get_content_type()) if binary else body.decode("utf-8", "replace")


def meta(page, prop):
    for pat in (r'<meta[^>]+(?:property|name)="%s"[^>]+content="([^"]*)"' % prop,
                r'<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="%s"' % prop):
        m = re.search(pat, page, re.I)
        if m:
            return html.unescape(m.group(1)).strip()
    return ""


def to_text(fragment):
    s = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.I)
    s = re.sub(r"</p>\s*<p[^>]*>", "\n\n", s, flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    lines = [re.sub(r"[ \t ]+", " ", l).strip() for l in s.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def read_post(page):
    """(text, picture url) from a LinkedIn embed or public post page."""
    text = ""
    m = re.search(r'<(p|div|span)[^>]*class="[^"]*attributed-text-segment-list__content[^"]*"[^>]*>(.*?)</\1>', page, re.S | re.I)
    if m:
        text = to_text(m.group(2))
    if not text:
        text = meta(page, "og:description") or meta(page, "description")
    pic = ""
    for u in re.findall(r'https://media\.licdn\.com/dms/image/[^"\'\s<>)]+', page):
        u = html.unescape(u)
        if PICTURE.search(u) and not NOT_PICTURE.search(u):
            pic = u
            break
    if not pic:
        og = meta(page, "og:image")
        if og and not NOT_PICTURE.search(og):
            pic = og
    if GENERIC.search(text):                  # a sign-in or error page, not the post
        return "", ""
    return text, pic


def fetch(post):
    urn = "urn:li:%s:%s" % (post.get("kind", "activity"), post["id"])
    tries = ["https://www.linkedin.com/embed/feed/update/%s" % urn]
    if "linkedin.com/posts/" in post.get("url", ""):
        tries.append(post["url"].split("?")[0])
    tries.append("https://www.linkedin.com/feed/update/%s/" % urn)
    text = pic = ""
    last_err = ""
    for u in tries:
        try:
            t, p = read_post(get(u))
        except (urllib.error.URLError, OSError, ValueError) as e:
            last_err = "HTTP %s" % e.code if hasattr(e, "code") else str(getattr(e, "reason", e))
            continue
        text, pic = text or t, pic or p
        if text and pic:
            break
    return text, pic, last_err


def save_picture(post_id, url):
    data, ctype = get(url, binary=True)
    ext = EXT.get(ctype)
    if not ext or len(data) < 1000:
        raise ValueError("not a picture (%s)" % ctype)
    os.makedirs(IMG_DIR, exist_ok=True)
    for old in os.listdir(IMG_DIR):          # a re-sync may change the format
        if old.split(".")[0] == post_id:
            os.remove(os.path.join(IMG_DIR, old))
    name = "%s.%s" % (post_id, ext)
    with open(os.path.join(IMG_DIR, name), "wb") as f:
        f.write(data)
    return "linkedin/" + name


def main():
    with open(os.path.join(ROOT, "data", "cv.json"), encoding="utf-8") as f:
        li = json.load(f).get("site", {}).get("linkedin") or {}
    posts = sorted((p for p in li.get("posts", []) if str(p.get("id", "")).isdigit()),
                   key=lambda p: int(p["id"]), reverse=True)[:max(1, min(6, int(li.get("show", 3))))]
    cache = {"syncedAt": "", "posts": {}}
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            cache = json.load(f)
    for e in cache["posts"].values():         # an earlier read that kept LinkedIn's own page text
        if GENERIC.search(e.get("text", "")):
            e.update(text="", ok=False)
    if not posts and not cache["posts"]:
        return 0
    force = bool(li.get("sync")) and li["sync"] > (cache.get("syncedAt") or "")
    keep = {p["id"] for p in posts}

    for p in posts:
        old = cache["posts"].get(p["id"], {})
        if old.get("ok") and not force:
            continue
        text, pic, err = fetch(p)
        if not text and old.get("ok"):          # a failed re-read keeps the earlier good copy
            print("linkedin %s: re-read failed (%s), keeping the earlier copy" % (p["id"], err))
            continue
        entry = {"text": text, "image": old.get("image", ""), "checked": now()}
        if pic:
            try:
                entry["image"] = save_picture(p["id"], pic)
            except (urllib.error.URLError, OSError, ValueError) as e:
                err = err or "picture: %s" % e
        entry["ok"] = bool(text)
        entry["note"] = "" if text else ("LinkedIn refused: %s" % err if err else "LinkedIn showed no text for it. It may be a repost or not public")
        cache["posts"][p["id"]] = entry
        print("linkedin %s: %s" % (p["id"], "ok" if text else entry["note"]) + (", picture" if entry["image"] else ""))

    for pid in [k for k in cache["posts"] if k not in keep]:    # posts removed in admin
        img = cache["posts"].pop(pid).get("image")
        if img and os.path.exists(os.path.join(ROOT, img)):
            os.remove(os.path.join(ROOT, img))
    if force:
        cache["syncedAt"] = li["sync"]
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:                    # never block the CV build over LinkedIn
        print("linkedin: skipped (%s)" % e)
        sys.exit(0)
