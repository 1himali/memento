"""The decision graph: nodes, typed edges, ingestion and explanation."""
import os
import re

from .concepts import concepts_of, is_meaningful_overlap, tokens
from .extract import parse_source, short, split_rejected

EDGE_TYPES = ["SUPPORTED_BY", "REJECTED", "CONSTRAINED_BY", "DEPENDS_ON",
              "SUPERSEDES", "IMPLEMENTED_IN", "INVALIDATED_IF"]


class Node:
    def __init__(self, id, type, text, source=None, label=None, extra=None):
        self.id = id
        self.type = type            # decision | constraint | alternative | evidence | assumption | code
        self.text = text
        self.label = label or short(text)
        self.status = "active"      # active | superseded | under_review
        self.source = source or {}
        self.extra = extra or {}

    def to_dict(self):
        return {"id": self.id, "type": self.type, "label": self.label, "text": self.text,
                "status": self.status, "source": self.source, "extra": self.extra}


class Graph:
    def __init__(self):
        self.nodes = {}
        self.edges = []          # (source_id, target_id, type)
        self.sources = {}
        self._auto = 0
        self._pending_supersedes = []

    # ---------- building ----------
    @classmethod
    def from_directory(cls, path):
        g = cls()
        files = []
        for root, _dirs, names in os.walk(path):
            for n in names:
                if n.endswith(".md"):
                    full = os.path.join(root, n)
                    with open(full, encoding="utf-8") as fh:
                        text = fh.read()
                    m = re.search(r"^Date:\s*(\S+)", text, re.M)
                    rel = os.path.relpath(full, path).replace(os.sep, "/")
                    files.append((m.group(1) if m else "", rel, text))
        for _date, rel, text in sorted(files):
            g.add_source(rel, text)
        return g

    def add_edge(self, a, b, kind):
        if (a, b, kind) not in self.edges:
            self.edges.append((a, b, kind))

    def _next_id(self, prefix):
        self._auto += 1
        return "%s-%d" % (prefix, self._auto)

    def _upsert(self, ntype, nid, text, src, report, label=None, extra=None):
        existing = self.nodes.get(nid)
        if existing:
            existing.extra.setdefault("also_in", []).append(src)
            report["merged"].append(nid)
            return nid
        self.nodes[nid] = Node(nid, ntype, text, src, label, extra)
        report["added"].append(nid)
        return nid

    def _find_similar_decision(self, text):
        mine = set(tokens(text))
        for n in self.nodes.values():
            if n.type == "decision":
                theirs = set(tokens(n.text))
                if mine and len(mine & theirs) / len(mine | theirs) >= 0.8:
                    return n.id
        return None

    def _count(self, parent, kind):
        return sum(1 for a, _b, k in self.edges if a == parent and k == kind) + 1

    def add_source(self, name, text):
        meta, blocks = parse_source(name, text)
        self.sources[name] = meta
        before = set(self.nodes)
        report = {"source": name, "title": meta["title"], "added": [], "merged": [], "under_review": []}
        new_evidence = []

        for block in blocks:
            subject = None
            last_decision = None
            decisions, constraints = [], []
            for it in block:
                src = {"name": name, "title": meta["title"], "type": meta["type"],
                       "date": meta["date"], "line": it.line}
                if it.tag == "decision":
                    nid = it.id or self._find_similar_decision(it.value) or self._next_id("D")
                    self._upsert("decision", nid, it.value, src, report)
                    last_decision = subject = nid
                    decisions.append(nid)
                elif it.tag == "constraint":
                    nid = it.id or self._next_id("C")
                    self._upsert("constraint", nid, it.value, src, report)
                    subject = nid
                    constraints.append(nid)
                elif it.tag == "rejected" and last_decision:
                    name_, reason = split_rejected(it.value)
                    nid = "ALT-%s-%d" % (last_decision, self._count(last_decision, "REJECTED"))
                    self._upsert("alternative", nid, it.value, src, report, label=name_,
                                 extra={"reason": reason, "name": name_})
                    self.add_edge(last_decision, nid, "REJECTED")
                elif it.tag == "evidence":
                    nid = "EV-%s-%d" % (subject or name, self._count(subject or name, "SUPPORTED_BY"))
                    if nid in self.nodes:
                        nid = "EV-%s-L%d" % (subject or name, it.line)
                    self._upsert("evidence", nid, it.value, src, report)
                    if subject:
                        self.add_edge(subject, nid, "SUPPORTED_BY")
                    else:
                        new_evidence.append(nid)
                elif it.tag == "assumption" and last_decision:
                    nid = "AS-%s-%d" % (last_decision, self._count(last_decision, "DEPENDS_ON"))
                    self._upsert("assumption", nid, it.value, src, report)
                    self.add_edge(last_decision, nid, "DEPENDS_ON")
                elif it.tag == "invalidated if" and last_decision:
                    self.nodes[last_decision].extra.setdefault("invalid_if", []).append(it.value)
                elif it.tag == "supersedes" and last_decision:
                    for old in re.split(r"[,\s]+", it.value.strip()):
                        if old:
                            self._pending_supersedes.append((last_decision, old))
                elif it.tag == "touches" and subject:
                    for f in [x.strip() for x in it.value.split(",") if x.strip()]:
                        fid = "file:" + f
                        self._upsert("code", fid, f, src, {"added": [], "merged": []}, label=f)
                        if fid not in report["added"] and fid not in before:
                            report["added"].append(fid)
                        if self.nodes[subject].type == "decision":
                            self.add_edge(subject, fid, "IMPLEMENTED_IN")
                        else:
                            self.add_edge(fid, subject, "CONSTRAINED_BY")
            for d in decisions:
                for c in constraints:
                    self.add_edge(d, c, "CONSTRAINED_BY")

        # evidence lines in standalone blocks may invalidate older decisions
        evidence_lines = list(new_evidence)
        for eid in evidence_lines:
            self._check_invalidation(eid, before, report)

        self._resolve_supersedes()
        report["added"] = [i for i in dict.fromkeys(report["added"])]
        report["items"] = [{"id": i, "type": self.nodes[i].type, "label": self.nodes[i].label}
                           for i in report["added"] if i in self.nodes and self.nodes[i].type != "code"]
        return report

    def _resolve_supersedes(self):
        keep = []
        for new, old in self._pending_supersedes:
            if old in self.nodes and new in self.nodes:
                self.nodes[old].status = "superseded"
                self.add_edge(new, old, "SUPERSEDES")
            else:
                keep.append((new, old))
        self._pending_supersedes = keep

    def _check_invalidation(self, evidence_id, before, report):
        ev = self.nodes[evidence_id]
        ev_concepts = concepts_of(ev.text)
        for d in self.nodes.values():
            if d.type != "decision" or d.id not in before or d.status == "superseded":
                continue
            for cond in d.extra.get("invalid_if", []):
                overlap = ev_concepts & concepts_of(cond)
                if is_meaningful_overlap(overlap):
                    d.status = "under_review"
                    d.extra["review_reason"] = ev.text
                    self.add_edge(d.id, evidence_id, "INVALIDATED_IF")
                    report["under_review"].append({"decision": d.id, "condition": cond,
                                                   "evidence": ev.text, "matched": sorted(overlap)})
                    break

    # ---------- reading ----------
    def out(self, nid, kind=None):
        return [self.nodes[b] for a, b, k in self.edges if a == nid and (kind is None or k == kind) and b in self.nodes]

    def into(self, nid, kind=None):
        return [self.nodes[a] for a, b, k in self.edges if b == nid and (kind is None or k == kind) and a in self.nodes]

    def decisions_of(self, node_id):
        """Decisions that own an alternative or are constrained by a constraint."""
        node = self.nodes[node_id]
        if node.type == "alternative":
            return self.into(node_id, "REJECTED")
        if node.type == "constraint":
            return self.into(node_id, "CONSTRAINED_BY")
        return []

    def files_of(self, node_id):
        node = self.nodes[node_id]
        files = set()
        if node.type == "constraint":
            files |= {n.text for n in self.into(node_id, "CONSTRAINED_BY") if n.type == "code"}
        for d in self.decisions_of(node_id):
            if d.type == "decision":
                files |= {n.text for n in self.out(d.id, "IMPLEMENTED_IN")}
        if node.type == "decision":
            files |= {n.text for n in self.out(node_id, "IMPLEMENTED_IN")}
        return files

    def files_mentioned(self, text):
        low = text.lower()
        return {n.text for n in self.nodes.values() if n.type == "code" and n.text.lower() in low}

    def to_dict(self):
        return {"nodes": [n.to_dict() for n in self.nodes.values()],
                "edges": [{"source": a, "target": b, "type": k} for a, b, k in self.edges
                          if a in self.nodes and b in self.nodes]}

    def explain(self, nid):
        node = self.nodes.get(nid)
        if not node:
            return None
        rels = []
        for a, b, k in self.edges:
            if a == nid and b in self.nodes:
                rels.append({"type": k, "direction": "out", "node": self.nodes[b].to_dict()})
            elif b == nid and a in self.nodes:
                rels.append({"type": k, "direction": "in", "node": self.nodes[a].to_dict()})
        return {"node": node.to_dict(), "relations": rels}
