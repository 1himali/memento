import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from memento.graph import Graph
from memento.projects import sources_dir


class MementoTests(unittest.TestCase):
    def setUp(self):
        self.g = Graph.from_directory(sources_dir("canteen"))

    def test_extraction_counts(self):
        types = [n.type for n in self.g.nodes.values()]
        self.assertEqual(types.count("decision"), 5)
        self.assertEqual(types.count("constraint"), 3)

    def test_replaced_decision(self):
        self.assertEqual(self.g.nodes["D-NOTIFY-OLD"].status, "superseded")
        self.assertEqual(self.g.nodes["D-NOTIFY"].status, "active")

    def test_reasoning_chain(self):
        rels = {(r["type"], r["node"]["type"]) for r in self.g.explain("D-DB")["relations"]}
        self.assertIn(("REJECTED", "alternative"), rels)
        self.assertIn(("SUPPORTED_BY", "evidence"), rels)
        self.assertIn(("DEPENDS_ON", "assumption"), rels)

    def test_live_build_from_empty(self):
        g = Graph()
        rep = g.add_source("a.md", "Decision [D-1]: Use SQLite.\nInvalidated if: A second canteen counter opens and orders triple.\n")
        self.assertEqual(len(rep["items"]), 1)
        rep = g.add_source("b.md", "Evidence: The manager says a second counter opens and orders will triple.\n")
        self.assertEqual(rep["under_review"][0]["decision"], "D-1")
        self.assertEqual(g.nodes["D-1"].status, "under_review")

    def test_shop_project_loads(self):
        g = Graph.from_directory(sources_dir("shop"))
        self.assertEqual(g.nodes["D-SESSION-OLD"].status, "superseded")


if __name__ == "__main__":
    unittest.main()
