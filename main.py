"""Memento: collect a team's decisions live and see them as a graph.

    python main.py                 # opens the web app (canteen example)
    python main.py --empty         # start with an empty project for the live demo
    python main.py --project shop  # the advanced online-shop example
"""
import argparse

from memento import server
from memento.projects import PROJECTS

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--project", choices=list(PROJECTS), default="canteen")
    ap.add_argument("--empty", action="store_true", help="start with an empty project")
    a = ap.parse_args()
    server.serve(a.port, open_browser=not a.no_browser, project=a.project, empty=a.empty)
