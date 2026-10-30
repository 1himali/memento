# ADR 004: where to rate limit
Type: ADR
Date: 2026-06-09

Decision [D-RATE]: Rate-limit per API key at the gateway, not inside the application.
Rejected: In-app rate limiting middleware - counters diverge across app instances
Rejected: Per-IP limits only - whole offices share one IP address
Evidence: Gateway test: per-key limits stayed exact across 6 instances, in-app counters drifted by up to 40 percent.
Assumption: One gateway fronts all services.
Invalidated if: We run several gateways without shared counters.
Touches: api/gateway_config.yaml
