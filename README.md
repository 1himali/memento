# Memento: the system that remembers why

Memento collects a team's decisions as they talk and turns them into a live **decision graph**:
decisions, the rules they must obey, rejected options, evidence and assumptions, all linked and
traceable to the document they came from.

By Laxika Bisht and Himali M Suresh, CHRIST (Deemed to be University), Pune Lavasa Campus.

## Run it (Python 3.9+, nothing to install)

    python main.py                   # opens http://127.0.0.1:8000 (canteen example)
    python main.py --empty           # start with an empty project for the live demo
    python main.py --project shop    # the advanced online-shop example
    python -m unittest discover -s tests

## What the app does (one screen)

* **Play the team's story:** five meetings of three students building a canteen ordering app. The chat
  plays, Memento reads the notes, and the graph builds itself.
* **Capture your own:** choose Decision, Rejected option, Evidence, Rule, Assumption or Change-if, type it,
  save the note, and the new dots appear.
* **Paste a whole note:** notes use light markers (`Decision:`, `Rejected:`, `Evidence:`, `Constraint:`,
  `Assumption:`, `Invalidated if:`, `Supersedes:`, `Touches:`).
* **Inspect:** click any dot to see its text, source document and line, and everything linked to it.
* **Replaced decisions:** the old decision stays visible (faded) and is marked as replaced.
* **Under review:** new evidence that matches a decision's "change if" condition makes it pulse amber.

## How it works

    notes -> extract.py (read tagged lines) -> graph.py (nodes + typed links, merge, replace, review check)
          -> server.py (small web server) -> web/ (live graph, capture panel, inspector)

`concepts.py` maps different words for one idea to a shared concept; it is used to match new evidence
against the "change if" conditions.

## Files

    main.py          start the app
    memento/         extract, graph, concepts, projects, server
    web/             index.html, style.css, app.js (no external libraries)
    data/canteen/    simple example: 5 documents + the story
    data/shop/       advanced example: 8 documents
    tests/           unit tests
