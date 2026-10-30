# PR 58: security review follow-up
Type: pull request
Date: 2026-04-02

Constraint [C-SESSION]: Session tokens must never be stored in a shared cache such as Redis or Memcached.
Evidence: The security review showed that one Redis misconfiguration would expose every active session, and a stolen token gives full account takeover.
Touches: auth/session_store.py
Decision [D-SESSION]: Keep sessions in a dedicated encrypted session store, separate from the shared cache.
Supersedes: D-SESSION-OLD
Rejected: Signed cookies only - tokens cannot be revoked on logout
Rejected: Redis with a short TTL - still a shared cache, so it breaks the constraint
Invalidated if: The shared cache gains per-tenant encryption and the security team approves it.
Touches: auth/session_store.py
