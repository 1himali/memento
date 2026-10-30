"""Turn meeting notes, issues, PRs and ADRs into structured items.

Notes use light, human-friendly markers (the way many teams already write ADRs):

    Decision [D-DB]: Use PostgreSQL for orders.
    Rejected: MongoDB - weak multi-document transactions
    Evidence: Load test on 27 Feb ...
    Constraint [C-X]: ...
    Assumption: ...
    Invalidated if: ...
    Supersedes: D-OLD
    Touches: db/connection.py

Free-form text can be converted into this format by an LLM (see llm.py).
"""
import re
from dataclasses import dataclass

TAG_RE = re.compile(
    r"^\s*(?:[-*]\s+)?(Decision|Constraint|Rejected|Evidence|Assumption|Invalidated if|Supersedes|Touches)"
    r"\s*(?:\[([A-Za-z0-9_\-]+)\])?\s*:\s*(.+?)\s*$",
    re.I,
)
META_RE = re.compile(r"^(Type|Date)\s*:\s*(.+?)\s*$", re.I)


@dataclass
class Item:
    tag: str
    id: str
    value: str
    line: int


def parse_source(name, text):
    """Return (metadata, blocks). A block is a group of tagged lines with no blank line between."""
    meta = {"name": name, "title": name, "type": "note", "date": ""}
    blocks, cur = [], []
    title_set = False
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line:
            if cur:
                blocks.append(cur)
                cur = []
            continue
        m = META_RE.match(line)
        if m:
            meta[m.group(1).lower()] = m.group(2)
            continue
        if line.startswith("# ") and not title_set:
            meta["title"] = line[2:].strip()
            title_set = True
            continue
        t = TAG_RE.match(line)
        if t:
            cur.append(Item(t.group(1).lower(), t.group(2) or "", t.group(3), lineno))
    if cur:
        blocks.append(cur)
    return meta, blocks


def split_rejected(value):
    """'MongoDB - weak transactions' -> ('MongoDB', 'weak transactions')."""
    m = re.match(r"^(.*?)\s*(?:\s-\s|\s—\s|\sbecause\s|:\s)\s*(.+)$", value)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return value.strip(), ""


def short(text, n=48):
    text = text.strip().rstrip(".")
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"
