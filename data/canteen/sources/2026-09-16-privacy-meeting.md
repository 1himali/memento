# Meeting: student privacy
Type: meeting
Date: 2026-09-16

Constraint [C-PHONE]: Canteen staff must never see students' phone numbers on their screen.
Evidence: Students asked us not to share their phone numbers with the staff.
Touches: staff_view.py
Decision [D-NOTIFY]: Send order-ready alerts inside the app instead of by SMS.
Supersedes: D-NOTIFY-OLD
Rejected: SMS alerts - each order alert costs money (about Rs 80 a day) and needs a phone number
Evidence: In-app alerts are free and worked in a test with 20 students.
Invalidated if: The college pays for an SMS plan.
Touches: notify.py
