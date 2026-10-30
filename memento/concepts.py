"""Tiny concept vocabulary used to compare plain-English text.

Different words for the same idea ("Redis", "caching", "Memcached") collapse to one
concept ("cache"). Two pieces of text are related when they share concepts. This is
deliberately simple, transparent and explainable: every match can be shown to the user.
Swap it for embeddings later without touching the rest of the system.
"""
import re

GROUPS = {
    "cache": ["cache", "caching", "cached", "redis", "memcached", "memcache"],
    "session": ["session", "token", "jwt", "cookie", "login", "signin", "sign-in", "credential"],
    "store": ["store", "stored", "storing", "save", "saved", "saving", "persist", "persisted", "persisting"],
    "log": ["log", "logging", "logger", "debug", "dump", "trace"],
    "payment": ["card", "payment", "stripe", "checkout", "cvv", "pan", "billing", "charge",
                "upi", "razorpay", "pin", "pay", "wallet"],
    "pii": ["pii", "email", "gmail", "personal", "ssn"],
    "region": ["region", "replica", "replicate", "replication", "backup", "mirror",
               "multi-region", "cross-region", "geo", "ap-south-1", "us-east-1", "eu-west-1"],
    "database": ["database", "db", "postgres", "postgresql", "sql", "mongodb", "mongo",
                 "dynamodb", "sqlite", "nosql", "datastore", "mysql", "firebase"],
    "transaction": ["transaction", "acid", "order", "inventory"],
    "ratelimit": ["ratelimit", "rate-limit", "rate", "limit", "throttle", "quota", "gateway"],
    "inapp": ["in-app", "inapp", "middleware"],
    "encrypt": ["encrypt", "encrypted", "encryption", "cipher", "kms"],
    "traffic": ["traffic", "load", "rps", "throughput", "scale", "scaling"],
    # canteen-app vocabulary
    "phone": ["phone", "mobile", "whatsapp"],
    "staff": ["staff", "counter", "kitchen", "cashier"],
    "display": ["show", "display", "shown", "screen", "visible", "print", "printed"],
    "sms": ["sms", "alert", "notify", "notification", "message"],
    "account": ["account", "signup", "sign-up", "register", "registration"],
    "cost": ["cost", "costs", "costly", "expensive"],
    "switch": ["switch", "switching", "migrate", "migration", "replace", "replacing"],
}

# A concept that is too common to count as evidence on its own.
GENERIC = {"store", "switch"}

LOOKUP = {word: concept for concept, words in GROUPS.items() for word in words}
_WORD = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def tokens(text):
    text = re.sub(r"\bin order to\b", " ", text.lower())
    text = re.sub(r"\bsign up\b", "sign-up", text)
    text = re.sub(r"\blog in\b", "login", text)
    text = text.replace("'s", "")
    return _WORD.findall(text)


def concepts_of(text):
    found = set()
    for tok in tokens(text):
        candidates = [tok, tok[:-1] if tok.endswith("s") else tok] + tok.split("-")
        for cand in candidates:
            if cand in LOOKUP:
                found.add(LOOKUP[cand])
                break
    return found


def is_meaningful_overlap(overlap):
    """Two shared concepts, at least one of them not generic."""
    return len(overlap) >= 2 and bool(overlap - GENERIC)
