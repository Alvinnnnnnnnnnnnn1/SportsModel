# Optional The Odds API readiness

EdgeLab's daily Research Handoff needs no odds API account or key. The existing mock providers and deliberately unconfigured adapters remain unchanged. No live provider request was made during this implementation or its tests; there is no polling job, public odds endpoint, bookmaker login or wager execution.

## Correct service and free-plan limits

This adapter targets **https://the-odds-api.com/** and the fixed host `https://api.the-odds-api.com`. The similarly named `theoddsapi.com` is a different service and is not supported. On 4 November 2026 the official Starter listing showed **500 free credits/month**, current sports/markets and most bookmakers; historical odds were excluded. No paid plan is needed or enabled. Recheck the [official plan listing](https://the-odds-api.com/) before optional configuration.

The bounded adapter requests only current `h2h`, `spreads` and `totals` for one sport, AU region and the `sportsbet` bookmaker key. It conservatively budgets one credit per requested featured market. Response headers `x-requests-remaining`, `x-requests-used`, and `x-requests-last` record observed usage. See the [official V4 documentation](https://the-odds-api.com/liveapi/guides/v4/) for endpoint/quota semantics.

[Sportsbet is listed as an AU bookmaker](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html). That is not proof of complete NBA/NBL/ATP/WTA player-prop coverage or a guarantee that a specific market/price is available. This readiness adapter intentionally excludes player props, historical endpoints and paid-only features. Additional markets need separate coverage/endpoint verification; see the [official market catalogue](https://the-odds-api.com/sports-odds-data/betting-markets.html).

## Configuration

All settings are optional and server-only. Leave the defaults in `.env.example` unchanged for the zero-cost handoff workflow:

```dotenv
THE_ODDS_API_KEY=
THE_ODDS_API_ENABLE_MANUAL_REQUESTS=false
THE_ODDS_API_FREE_PLAN_CONFIRMED=false
THE_ODDS_API_CREDIT_RESERVE=10
THE_ODDS_API_MAX_AGE_SECONDS=300
```

If later testing with a separately selected **free** account, put its key only in ignored `.env.local`, keep it private, and explicitly confirm the account is free before enabling manual reads. Never use a `NEXT_PUBLIC_` prefix. Do not send the key in chat, return an adapter/configuration object to a client, or log a request URL: the provider authenticates in its query string.

`src/lib/providers/the-odds-api.server.ts` is protected by Next's `server-only` import. Its factory reads environment configuration without making a request. The reusable adapter in `the-odds-api.ts` accepts injected HTTP transport for tests and exposes:

- `readiness()`: safe status/quota metadata without the key.
- `getMarkets(sports)`: explicitly synthetic mock markets in Demo; an empty result in private mode. It never implicitly consumes provider quota.
- `requestOnce(request, { confirmExternalRead: true })`: one server-side external read only when the key, enable flag and free-plan confirmation are all present. The current app does not call it or expose it as a route.

No constructor, render, import, timer or research prompt calls the optional provider. Any future UI endpoint must authenticate the current user and add a durable shared quota gate before exposure. This implementation provides readiness code, not a claim that live monitoring is connected.

## Data and quota safeguards

NBA/NBL use their exact provider keys. ATP/WTA require the actual in-season tournament key supplied from the provider catalogue; a generic key is not guessed. Response sport, event, bookmaker, market, outcome and point identities must match. Duplicate/ambiguous selections and invalid decimal odds are rejected as a whole preview, rather than partially registered or merged. Stable selection identities include the original line and exclude price changes.

The adapter records market-level source timestamps separately from deprecated bookmaker-level timestamps. Missing times stay null; retrieval time never substitutes for an original odds timestamp. Stale, future or unknown timestamps are flagged; legacy timestamps require review. Even fresh provider data does not establish a model edge or guarantee a currently available price.

Manual reads have a one-minute minimum cooldown, no automatic retries, a five-second timeout, redirect rejection and a two-MiB response bound. Simultaneous calls are blocked. A configured credit reserve prevents a subsequent request from crossing the observed balance. The first explicitly confirmed read can establish an unknown quota; missing quota headers afterward block further reads. Rate-limit responses respect a bounded `Retry-After` delay. Controlled errors omit raw provider errors and key-bearing URLs.

Quota/cooldown state is **process-local**, not a durable account-wide quota ledger. Another application, new process or account portal activity can change real usage. Do not treat this as unattended budget enforcement or enable frequent polling. A future integration should persist a single quota ledger and verify live coverage/headers with user authorization before being called operational.

## Verification

`tests/odds-readiness.test.ts` uses injected fake HTTP responses and synthetic fixtures only. It covers disabled/default behavior, Demo/private separation, explicit confirmation, exact host/path, key redaction, cooldown/concurrency, quota reserves/missing headers, rate limiting, errors, bounded bodies, identity/duplicate validation, sport/tournament keys, decimal/line validation, source times and stale/unknown states. No real key, provider account or live price was used. Run with:

```sh
npx vitest run tests/odds-readiness.test.ts
```
