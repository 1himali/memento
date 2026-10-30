# Issue 41: logins feel slow
Type: issue
Date: 2026-03-18

Decision [D-SESSION-OLD]: Cache session tokens in Redis so login checks skip the database.
Evidence: Profiling showed 70 percent of login latency is the session lookup query.
Touches: auth/session_store.py
