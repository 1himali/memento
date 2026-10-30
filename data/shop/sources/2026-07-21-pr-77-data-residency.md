# PR 77: data residency
Type: pull request
Date: 2026-07-21

Constraint [C-RESIDENCY]: Customer PII (emails and phone numbers) in the users database must stay in the ap-south-1 region.
Evidence: Legal advised that customer data has to remain in India.
Touches: db/replication.py
Decision [D-REGION]: Pin the primary database and its backups to ap-south-1 (Mumbai).
Rejected: Multi-region replication - copies PII outside India
Invalidated if: Legal approves a cross-border data transfer agreement.
Touches: db/replication.py
