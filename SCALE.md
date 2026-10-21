# Scaling SARH Orders to 5 Million Orders

## Context

The current application uses React, Node.js/Express, Prisma, and PostgreSQL. It supports authenticated order management, server-side pagination, filtering, sorting, and idempotent order creation. The target is approximately five million orders, with operations agents working across two countries and a development team of three.

## What I Would Keep

- **PostgreSQL:** Keep it as the source of truth for orders, users, line items, and idempotency records. Five million rows alone do not justify replacing a relational database.
- **Server-side querying:** Keep filtering, sorting, and pagination in the API. Never return the entire dataset to the browser.
- **Database constraints:** Keep unique constraints and transactions as the final protection against duplicate order creation.
- **Authentication and authorization:** Continue enforcing identity and role permissions on the server.

## What I Would Change

### Database and Query Performance

- Review production query plans using `EXPLAIN (ANALYZE, BUFFERS)` with representative data.
- Add or adjust composite indexes based on actual query patterns, such as status plus creation date. Verify that indexes support the chosen sort order and search strategy.
- Replace deep offset pagination with cursor-based pagination for frequently accessed large result sets.
- Evaluate PostgreSQL full-text search or trigram indexes if substring search across customer names and emails becomes expensive.
- Introduce connection pooling, statement timeouts, and sensible query limits.
- Consider table partitioning only if measured maintenance, retention, or query requirements justify the added complexity.

### Reliability and Security

- Store idempotency records with a documented retention policy and ensure order creation is atomic.
- Add structured logs, request IDs, error monitoring, and metrics for latency, error rates, database load, and duplicate-key conflicts.
- Use a managed secret-injection mechanism in production, TLS, rate limits, and a reviewed token/session strategy.
- Back up the database and regularly test recovery procedures.

### Multi-Country Operations

- Deploy the application close to its primary database and measure latency from both countries.
- Store timestamps in UTC and display them in each agent's local timezone.
- Define explicit data access policies, audit sensitive operations, and evaluate legal or residency requirements before choosing deployment regions.
- Keep a single authoritative write database initially to avoid cross-region write conflicts.

## What I Would Not Do Yet

- I would not introduce microservices solely because the dataset has five million orders.
- I would not add Elasticsearch, Kafka, or Redis before identifying a measured requirement they solve.
- I would not add multi-region active-active writes without a clear consistency and conflict-resolution design.
- I would not partition tables or add replicas without workload measurements and a tested operational plan.

## Team Plan

With three developers, I would assign ownership across API/database performance, frontend and agent workflows, and security/operations/testing, while sharing code review and release responsibility. Establish baseline load tests, define performance targets with stakeholders, and scale the architecture incrementally based on evidence.

## Rollout

1. Measure representative queries and establish latency and throughput baselines.
2. Optimize indexes and pagination; test with production-like data volumes.
3. Add observability, load tests, backup recovery tests, and deployment automation.
4. Reassess read replicas, caching, search infrastructure, and partitioning only when measurements show a concrete bottleneck.