# Meeting: payments design review
Type: meeting
Date: 2026-05-14

Constraint [C-CARD]: Card numbers must never be stored in our database or written to logs.
Evidence: Legal advised that any card data on our servers moves us into full PCI audit scope.
Touches: payments/checkout.py
Decision [D-CHECKOUT]: Use Stripe hosted checkout so card details never reach our servers.
Rejected: Custom card form - would put us in full PCI audit scope
Evidence: Hosted checkout keeps us at the lightest PCI level (SAQ A).
Touches: payments/checkout.py
