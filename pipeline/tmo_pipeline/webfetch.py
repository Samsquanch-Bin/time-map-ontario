"""Fetch web pages from GitHub Actions for research the build session can't reach.

Reads ``data/research/pages.yaml`` (a list of URLs, optionally with ``follow``
patterns) and saves each response to ``data/research/web/<slug>.html`` plus an
``index.json`` listing every link found. Pages matching a ``follow`` regex are
fetched one level deeper.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

import yaml

from .research import RESEARCH_DIR, USER_AGENT, slugify


class _Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and a.get("href"):
            self._href, self._text = a["href"], []
        for k in ("src", "data-src", "content"):
            v = a.get(k)
            if v and re.search(r"\.(jpe?g|png|tiff?|jp2)(\?|$)|iiif|manifest", v, re.I):
                self.links.append((v, f"<{tag} {k}>"))

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data.strip())

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join(t for t in self._text if t)[:120]))
            self._href = None


def extract_links(html: str, base: str) -> list[dict[str, str]]:
    p = _Links()
    p.feed(html)
    seen, out = set(), []
    for href, text in p.links:
        url = urljoin(base, href)
        if url not in seen:
            seen.add(url)
            out.append({"url": url, "text": text})
    return out


def run(config: Path = RESEARCH_DIR / "pages.yaml", out_dir: Path = RESEARCH_DIR / "web") -> None:
    import requests

    cfg = yaml.safe_load(config.read_text()) or {}
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    out_dir.mkdir(parents=True, exist_ok=True)
    index = {"retrieved": dt.date.today().isoformat(), "pages": []}
    max_follow = int(cfg.get("max_follow", 60))
    for entry in cfg.get("pages", []):
        url, follow = entry["url"], entry.get("follow")
        queue, followed = [(url, 0)], 0
        while queue:
            u, depth = queue.pop(0)
            try:
                r = s.get(u, timeout=60)
                ctype = r.headers.get("content-type", "")
                body = r.text if "html" in ctype or "json" in ctype or "xml" in ctype else ""
            except Exception as exc:  # noqa: BLE001
                index["pages"].append({"url": u, "error": str(exc)[:300]})
                print(f"error {u}: {exc}")
                continue
            name = slugify(u.split("://", 1)[-1])[:100]
            if body:
                (out_dir / f"{name}.html").write_text(body)
            links = extract_links(body, u) if "html" in ctype else []
            index["pages"].append({"url": u, "status": r.status_code, "content_type": ctype, "bytes": len(r.content), "file": f"{name}.html" if body else None, "links": links})
            print(f"{r.status_code} {u} ({len(links)} links)")
            if follow and depth == 0:
                for link in links:
                    if re.search(follow, link["url"]) and followed < max_follow:
                        queue.append((link["url"], 1))
                        followed += 1
            time.sleep(1)
    (out_dir / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
