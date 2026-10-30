# Meeting: choosing the production database
Type: meeting
Date: 2026-03-02

Decision [D-DB]: Use PostgreSQL as the primary database for orders and inventory.
Supersedes: D-SQLITE
Rejected: MongoDB - weak multi-document transactions for orders and inventory
Rejected: DynamoDB - vendor lock-in and unpredictable cost at our write volume
Evidence: Load test on 27 Feb: PostgreSQL held 1,200 order writes per second with correct stock counts, while MongoDB double-sold stock in 3 of 20 runs.
Assumption: Traffic stays under 1,000 requests per second for the first year.
Invalidated if: Sustained traffic exceeds 5,000 requests per second, or orders stop needing multi-row transactions.
Touches: db/connection.py
