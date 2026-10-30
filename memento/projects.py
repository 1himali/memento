"""The example projects that ship with Memento."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PROJECTS = {
    "canteen": {
        "label": "Campus canteen app (3 students)",
        "dir": os.path.join(ROOT, "data", "canteen"),
        "example_note": (
            "# Counter manager update\nType: meeting\nDate: 2026-10-20\n\n"
            "Evidence: The canteen manager says a second counter opens next week and orders will triple.\n"
        ),
        "about": "Three students build an ordering app for their college canteen.",
    },
    "shop": {
        "label": "Online shop backend (advanced)",
        "dir": os.path.join(ROOT, "data", "shop"),
        "example_note": (
            "# Vendor update: Redis Enterprise\nType: meeting\nDate: 2026-10-20\n\n"
            "Evidence: Redis Enterprise now supports per-tenant encryption at rest for the shared cache, "
            "and the security team has approved it.\n"
        ),
        "about": "A small online shop with sessions, payments and data-residency rules.",
    },
}


def sources_dir(key):
    return os.path.join(PROJECTS[key]["dir"], "sources")


def story_path(key):
    return os.path.join(PROJECTS[key]["dir"], "story.json")
