# Issue 93: emails leaked in support exports
Type: issue
Date: 2026-08-05

Constraint [C-LOGPII]: Application logs must never contain customer emails or phone numbers.
Evidence: In July a support export contained raw customer emails taken from debug logs.
Touches: logging/logger.py
Decision [D-LOGS]: Emit structured JSON logs and redact PII before anything is written.
Rejected: Plain-text debug logging - it leaked emails into the support export
Touches: logging/logger.py
