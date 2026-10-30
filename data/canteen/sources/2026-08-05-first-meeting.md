# First meeting: where do we keep the orders?
Type: meeting
Date: 2026-08-05

Decision [D-DB]: Use SQLite (a simple one-file database) to keep the orders, because we are three students with no server.
Rejected: MySQL - switching to it means paying for and managing a separate database server
Rejected: Firebase - nobody on the team knows it
Evidence: A test with 200 fake orders ran smoothly on SQLite.
Assumption: The canteen gets fewer than 300 orders a day.
Invalidated if: Orders go above 1,000 a day or a second canteen counter opens.
Touches: db.py
