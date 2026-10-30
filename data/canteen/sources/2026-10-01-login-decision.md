# ADR: who can create an account
Type: ADR
Date: 2026-10-01

Constraint [C-COLLEGE]: Only college email addresses may be used to create accounts.
Evidence: Last term an outsider ordered food using a student's account.
Touches: auth.py
Decision [D-LOGIN]: Students sign in with their college email and a one-time code.
Rejected: Open sign-up with any email - strangers could place orders on student accounts
Invalidated if: The college stops giving email addresses to students.
Touches: auth.py
