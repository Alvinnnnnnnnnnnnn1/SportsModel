# Optional hybrid sports data — 6 November 2026

## Security and local setup

The app runs without sports keys. Defaults make no sports requests and incur no additional cost. Keep the existing Supabase session and environment configuration.

For optional manual inspection, privately save these in `.env.local`:

```dotenv
EDGELAB_SPORTS_DATA_MODE=local-single-process
API_SPORTS_KEY=your_existing_free_plan_key
API_NBA_DAILY_BUDGET=70
API_NBA_MINUTE_BUDGET=6
API_BASKETBALL_DAILY_BUDGET=70
API_BASKETBALL_MINUTE_BUDGET=6
```

The key is optional for TheSportsDB and never belongs in `NEXT_PUBLIC_*`, chat, browser code, research JSON or Git. Restart the one local dev server after changing configuration. No subscription is created or upgraded. Confirm free API access in the provider dashboard independently; a Basketball subscription does not establish API-NBA access.

**Research → Daily workspace → Results and settlements → Optional sports-data inspection** makes a request only after its read-only button is pressed. The POST proxy requires a normal authenticated Supabase user, a loopback HTTP host and same-origin browser access. It uses public Supabase credentials for token validation, never a service role. It rejects public/serverless operation, unexpected endpoints, credential parameters, arbitrary URLs and redirects.

## Runtime and quotas

TheSportsDB: one serial queue, at least 3 seconds between starts, maximum 20 starts per rolling minute. API-NBA and API-Basketball: separate serial queues and budgets capped at 70/day and 6/minute, at least 10 seconds between starts. Environment values may lower these budgets. Invalid values fail closed. Credits reserve before transport, including failed attempts. UTC calendar day reset is at 00:00 UTC; daily remaining headers and provider minute limits are honoured.

The ignored `.local/sports-provider/` directory stores only quota counters, request times, cooldowns and an exclusive process lock. State survives restarts; an unreadable quota file disables access. A second running process is rejected; a dead process lock can be reclaimed. Do not erase counters to reset quota. This is a **single local process** design, not a distributed/serverless limiter. Provider-wide quotas can also be consumed outside EdgeLab; the shared public SportsDB key has no availability guarantee. Live headers and account status take precedence.

Identical in-flight requests share one fetch. Cancellation detaches a subscriber; with no subscribers the shared fetch/queued call aborts. Fetch timeout is 12 seconds. There is at most one retry, only for HTTP 429; Retry-After is honoured and waits above one minute return an explicit cooldown. Other failures use a 15-second negative cache. No timers poll in the background.

Cache defaults: identities/leagues/seasons 24 hours, fixture reads 15 minutes, game statistics 2 hours, status 1 minute; up to 200 entries/provider. Caches are in process and disappear on restart. Approved final evidence is retained through existing immutable result receipts/audits; an unreviewed provider response is not a permanent official record. Provider inspection displays freshness, quotas, last success, null fields and warnings. It saves no research or financial records.

## Provider operations and identity

TheSportsDB uses free **v1 key 123** only. General team search is deliberately unavailable; `arsenal` is the restricted connectivity example. Other allowlisted reads are country/sport leagues, day/past fixtures, exact event lookup and event stats. Free response caps can truncate discovery/schedules; absence in a truncated response does not establish that an event does not exist.

API-NBA uses `https://v2.nba.api-sports.io`; API-Basketball uses `https://v1.basketball.api-sports.io`. Discover leagues and seasons first; select games by IDs actually returned. Inspect games before player_stats when resolving identities. Exact-game statistics requests also load a missing exact fixture once, preventing a large season discovery from losing a selected game during bounded-cache eviction. The adapters keep provider-qualified game/player IDs, league, season, UTC fixture time, retrieval time and nullable source-observation time. Missing source-observation time is never replaced by retrieval time. Internal IDs stay null until resolved. API-NBA team season statistics use `season_team_stats`; game team statistics use `team_stats`.

Selection policy prefers API-NBA for verified NBA coverage, API-Basketball for verified NBL coverage; it makes no automatic request when coverage is unverified. TheSportsDB remains a limited fixture/result fallback. ATP/WTA use attributable manual evidence; these adapters do not establish tennis result or statistical coverage. Original Sportsbet quotes, accepted ticket odds and actual payouts remain separate owner/source inputs.

You may explicitly **Save reviewed provider identities** after inspecting a matched final game. This creates an append-only historical mapping journal and audit, with no position/result/funding write. Repeating the same mapping is a no-op; any changed original position hash invalidates it. **Check Results** can then reuse those mappings for up to three unique fixtures per click, sharing one game and one box score across positions. Missing mappings, free-plan denials and unknown fields stay unresolved; existing unsaved drafts/imports are retained. There is no scheduled polling.

Manual identity bindings require every registered leg's UUID plus exact provider/event/player IDs, exact fixture/player names and exact start time. Ambiguity stays manual rather than fuzzy-matching. Current game/name formatting may require manual results when source labels differ. Conflicting or duplicate observations are not selected opportunistically. No provider's descriptive statistics establish a predictive probability.

## Safe grading

Mock-tested exact full-game player market names: Player points/rebounds/assists/threes, Made three-pointers, Player made threes, Points + rebounds, Points + assists, Rebounds + assists, PRA, Points + rebounds + assists. Explicit over/under/at-least thresholds, alternate lines and per-leg clearance calculations are supported. Only final events with known participation and complete required statistics can produce proposals. Missing data never becomes zero. Period props, ambiguous labels, pushes, DNP, postponement, retirement and exceptional bookmaker terms remain manual.

Multi-leg outcomes use complete individual results, not probability multiplication. Correlation-unvalidated joint probability/EV remain null. The actual combined quote stays separate from any theoretical price; no theoretical combined price is generated.

Provider proposals load the editable result form. They leave original settlement/completion time and actual payout null, and terms unconfirmed. Retrieval time is retained separately, never substituted for the missing original time. Review evidence, explicitly enter a supported result/settlement timestamp, confirm exact full-game/overtime terms and supply actual payout where relevant, then use the existing final batch approval. No provider request financially settles or places a wager.

## Live coverage evidence

See [TheSportsDB report](reports/sportsdb-coverage.json) and [API-Sports report](reports/api-sports-coverage.json) when present. Reports distinguish real transport findings from synthetic adapter tests. A null response or subscription denial does not justify claiming working player-prop coverage.

Official references: [TheSportsDB free v1 guide](https://www.thesportsdb.com/docs_api_guide), [API-NBA documentation](https://api-sports.io/documentation/nba/v2), [Basketball documentation](https://api-sports.io/documentation/basketball/v1), [provider NBA endpoint guide](https://www.api-football.com/news/post/2026-2027-nba-season-guide-to-using-data-with-api-sports). The documentation pages/specs were partly challenge-protected during review; actual subscription coverage must be established from limited read-only requests, not marketing or examples.

### Actual sampled coverage

All dates below are source/sample dates, not proof of every fixture or season. Audits ran on 6 November Melbourne (5 November UTC). No application records were read or written.

| Provider / endpoint | Actual finding | Classification |
| --- | --- | --- |
| TheSportsDB `searchteams.php?t=Arsenal` | HTTP 200, one Arsenal team, ID 133604 | Verified supported, restricted example only |
| TheSportsDB `search_all_leagues.php` | NBA 4387, Australian NBL 4434 discovered | Verified sampled discovery |
| TheSportsDB `eventspastleague.php` | One final-score fixture per league, dated 5 Nov | Partial: truncated free schedules |
| TheSportsDB `lookupeventstats.php` | `eventstats:null` for both samples | Unsupported in sampled games; no player-prop claim |
| TheSportsDB upcoming/day/event lookup | Allowlisted adapters; not live-tested in this audit | Untested |
| TheSportsDB ATP/WTA statistics | No demonstrated usable coverage | Unsupported by current grading integration |
| API-NBA `/status` | Active Free, 100/day reported | Verified subscription/access |
| API-NBA `/leagues`, `/seasons` | 6 leagues, 12 seasons | Verified sampled discovery |
| API-NBA `/games` season 2023 | 1,390 game records; exact fixture recovered for statistics | Partial: tested historical season |
| API-NBA `/players/statistics` game 12478 | 36 normalised rows; all five required fields present | Verified for this historical sample; zero-minute players still require DNP review |
| API-NBA `/teams`, `/teams/statistics`, `/players`, `/games/statistics`, `/standings` | 60 / 1 / 25 / 2 / 30 returned rows respectively | Verified sampled reads, not complete population guarantees |
| API-NBA current-season + date filters | Provider rejected season 2026; explicit old date filter also restricted | Restricted; errors retained in report |
| API-NBA recent-date-only 4 Nov 2026 | Successful empty response | Current player coverage unverified; not inferred from historical success |
| API-Basketball `/status`, `/leagues?country=Australia` | Active Free 100/day; 16 leagues, NBL ID 1 | Verified sampled access/discovery |
| API-Basketball NBL 2023–24 games | 154 records | Partial: tested historical season |
| API-Basketball historical game 394747 player stats | 18 rows; points/rebounds/assists/threes/minutes present | Verified for sampled game |
| API-Basketball game team stats / player roster | 2 team rows / 16 players for sampled historical scope | Verified sampled reads |
| API-Basketball whole-season 2026–27 game query | Rejected by free-plan request | Restricted query; not proof all current endpoints fail |
| API-Basketball recent-date-only + exact NBL game 501228 | Game start 4 Nov 2026 09:00 UTC, NBL 2026–27, final; 19 player rows with required fields | Verified for this recent NBL sample only |
| ATP/WTA automated final player statistics | No adapter coverage established | Manual/source fallback |

The audit reserved **18 API-NBA** and **12 API-Basketball** requests in EdgeLab's persistent budget, including rejected reads and the exact-fixture join correction. Final provider headers reported **86 NBA / 90 Basketball** daily credits remaining and **9/minute** remaining. The app still caps starts at 6/minute and 70/day. There were **7 successful public TheSportsDB reads** including Arsenal; the six-request league audit used >=3-second spacing. No live 429 was encountered; Retry-After, exhausted budgets, restart restoration, cancellation and deduplication were tested with mocked transport. Free subscription limits are request-specific: do not extrapolate from broad coverage flags or one successful season/date.
