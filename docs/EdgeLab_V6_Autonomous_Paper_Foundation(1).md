# EdgeLab V6 — Autonomous Paper Experiment Foundation

**Owner-approved direction:** 9 November 2026 (Australia/Melbourne)  
**Target repository:** https://github.com/Alvinnnnnnnnnnnnn1/SportsModel  
**Status:** Specification saved for Codex; repository changes and deployment **not completed**.  
**Reference documentation:** `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/daily-workflow.md`, `docs/roadmap.md`, `docs/sports-data.md`, `docs/odds-provider.md`, `docs/verification.md`.

## 1. Two independent parallel experiments

### A — ChatGPT V5: actual Sportsbet experimentation
- Continue the user's manual V5 NBA, NBL, ATP and WTA analysis, including singles, alternative props, unders, tennis markets and multis.
- **A$500 lifetime deposit cap; A$5 cash stake by default** unless the owner separately changes the real-cash policy.
- Actual placements require explicit owner confirmation; ticket receipts, accepted odds and settlement evidence are distinct from research quotes and sporting results.
- User's latest chat-reported experiment balance is the financial checkpoint. Never replace it using the sportsbook wallet figure visible in a screenshot.
- No real-money execution from EdgeLab. Preserve cash bankroll, deposit cap, historical audit and records.

### B — EdgeLab V6: autonomous PAPER-only experimentation
- **A$5,000 hypothetical initial bankroll**; **A$50 fixed hypothetical stake per pre-event eligible paper position**.
- Paper equity = initial bankroll + cumulative settled hypothetical P/L. Available paper funds = equity minus pending committed hypothetical stakes.
- Cap new paper exposure to available simulated funds and a configurable research maximum; never risk real funds or initiate deposits.
- All paper trades and outcomes, ROI, and performance are entirely separate from the V5 cash ledger.
- Begin a **new prospective performance series**; older synthetic demo records and incomplete historical paper claims are retained as legacy/nonqualifying evidence, not counted as V6 wins or profit.
- User authorises resetting inaccurate EdgeLab *paper/demo working data*, but only after backup and validation. Do not delete the owner's Supabase account, actual financial records, immutable source snapshots, recorded methodology approvals, deployed migrations, or audit logs. No destructive hosted migration without review/explicit approval.

## 2. Autonomous paper research — any market can win
- Research next-day fixtures in Australia/Melbourne time across **NBA, Australian NBL, ATP and WTA**.
- Independently compare NBA/NBL player points, rebounds, assists, threes, PRA/PR/PA/RA, alternate lines, overs and unders, spreads, totals, moneylines, tennis winners, set/game handicaps/totals and singles/multis.
- Screen whatever evidence-backed markets appear attractive; **no enforced prop-first or moneyline-first bias**, no fixed daily number of paper trades, no forced multis.
- Perform a second research pass; compare multiple lines and both overs and unders.
- Multi wagers require the actual quoted **combined** odds; do not multiply leg odds or joint probabilities as if correlated legs were independent.
- Never infer a calibrated hit probability from last-five or last-ten historical hit rates. Do not fabricate odds, probabilities, price observation times, forecast EV, source URLs, model version, injury status or bet identity.
- If a probability cannot be supported independently, preserve it as `null`; EV is `null` too. Maintain bookmaker break-even as `1/decimalOdds` when valid attributable odds exist.
- Separate source-verified fixture and odds observations, model outputs, unregistered proposals, eligible pre-event frozen paper registrations, sporting grades and theoretical financial settlements.

## 3. Required immutable paper evidence
For each eligible paper trade retain a stable unique ID; sport; fixture and exact start time UTC plus Melbourne display; league/tournament and exact team/player IDs; bookmaker; source URL; price; `observed_at` and `retrieved_at` distinctly; exact market, direction, threshold and all legs; combined multi price; forecast probability (or null), model method/version, uncertainty and source; pre-event `registered_at`; eligibility status; fixed A$50 hypothetical stake; model inputs snapshot/hash; and replay-safe import/settlement audit.

**Pre-event requirements:** no backdating, no using in-play or completed prices as pre-match odds, no retrospective model backfills, no price reuse for different lines. An unsupported price/identity/timestamp remains unregistered research rather than an eligible paper position.

## 4. Results and paper accounting
- Verify completed sporting events using official/attributable sources; grade each exact leg and clearance margin; handle void/push, DNP, withdrawals/retirements and bookmaker-specific terms conservatively.
- Only previously frozen pre-event positions with attributable source prices and valid identity count in **eligible** prospective paper P/L and ROI.
- For an A$50 paper single at decimal odds `O`: win profit = `round_half_up(50 * (O - 1), 2)` AUD; loss profit = −A$50; void/push = A$0. Equivalent rules only for valid combined multi quotes; unresolved or partially void multicases remain unresolved where odds adjustments are unknown.
- Paper settled ROI = sum of profit on decisive settled paper positions / sum of stakes on those positions. No nonzero ROI claim when no decisive settled stake exists. Paper bankroll growth % = profit / A$5,000, labelled separately.
- Track pending exposure, paper equity, available funds, realised P/L, ROI, win/loss/push/void, mean accepted snapshot price, maximum drawdown, sport/market/model breakdown. Show sample size and provenance gaps.
- Brier/log-loss/calibration require prospectively recorded point probabilities and comparable outcomes. Market benchmarks and CLV require same-market attributable timely odds; no claim of validated advantage on a small sample.

## 5. Two-track V5 reporting handoff
Every ChatGPT V5 daily cycle should contain a **very short EdgeLab paper performance section** copied from the latest independently verified EdgeLab paper checkpoint, never mingled with cash results:

> **EdgeLab paper (as of YYYY-MM-DD AEDT):** Starting bankroll A$5,000 | fixed unit A$50 | settled n | W–L–V | net hypothetical P/L A$X | settled-stake ROI Y% | paper equity A$Q | pending paper exposure A$R. Source: [verified checkpoint and timestamp].

If no valid prospective registered paper positions are settled, show `P/L unavailable; ROI unavailable; insufficient verified data` — not an invented zero-return backtest. If latest checkpoint is unavailable or stale, say so rather than infer results.

V5's manual ChatGPT report should **not** automatically read a private Supabase database it cannot access. Implement a source-confirmed daily handoff export/copy action in EdgeLab once persistence and authentication are verified. The ChatGPT scheduled task can produce independently sourced reports but **does not by itself guarantee database persistence**.

## 6. Worker and safety boundaries
- Extend the existing Next.js 16/TypeScript/Supabase app, preserving `AGENTS.md` and its strict data/source/RLS policies.
- Avoid a hosted migration until locally reviewed and explicitly approved. Build a separate paper V6 domain and corresponding repository first.
- Develop a bounded scheduler and worker with quotas and authenticated owner-scoped storage. No unauthorised bookmaker scraping or bookmaker logins; do not silently introduce paid data or AI APIs.
- Use permitted official/authorised sports and market feeds, verify exact player/event identities, UTC source timestamps and Melbourne day boundaries. Existing API-NBA/API-Basketball/TheSportsDB providers have **limited, sample-dependent coverage**; tennis automation is not currently validated.
- Fetch and preserve official final results. Missing stats remain unresolved, never zero. Strict duplicate suppression and idempotent write/grade replays.
- Disable real-money betting and bankroll transfers in the entire worker code path. Hard caps, dry-run mode, kill switch, error logs and rate limits.
- Keep predicted probabilities separate from generative AI narrative; an LLM narrative alone is not a calibrated forecasting model.
- Existing Supabase/private paper approval boundary must not be bypassed without introducing an explicitly reviewed owner policy for eligible automated paper pre-registration; this is a *new* policy, not implied by earlier per-position approval.

## 7. UI and daily output
- Dedicated **Autonomous Paper** dashboard: separate A$5k nominal opening equity and A$50 unit, total realised hypothetical P/L, settled-stake ROI, bankroll growth, available paper cash, pending exposures, verified sample count, open/settled positions, drawdowns, source completeness and model versions.
- Ranked daily paper choices may use *any* objectively best researched market; no duplicate near-identical bets merely to increase volume. Maintain exact lines/odds/source, market and selection identities, model uncertainty, leg correlations, and timestamps.
- Maintain a copyable **EDGELAB DAILY V5 HANDOFF** with P/L and ROI front-and-centre, backed by immutable prospective paper records.
- Keep legacy demo and imported incomplete records clearly segregated from fresh paper performance. Do not move inaccurate legacy data into genuine results.

## 8. Deliver incrementally when GitHub/Codex writes are available
**Stage 1:** Pure TypeScript paper-accounting module, strongly validated paper position schema and baseline unit tests. No migration/destructive modifications.

**Stage 2:** Paper-only separate UI and research importer. Backup and legacy dataset isolation. Owner-scoped persistence with reviewed RLS, subject to a separately authorised hosted migration.

**Stage 3:** Bounded scheduled research worker, price and statistics feeds (only where coverage and terms are verified), pre-event immutable paper registration, source verification, retries/idempotency and official result grading.

**Stage 4:** Cross-run immutable snapshots, audit and export, calibration and ROI analytics, V5 daily summary, validation of live hosted/paper workflow.

**Stage 5:** Prospective out-of-sample evaluation and bookmaker benchmark comparisons. Only discuss real-money conversion as a separate later decision after meaningful validation, explicit authorisation and consideration of applicable bookmaker rules.

## 9. Codex acceptance tests
Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; document real tool outcomes and any untested production areas. Add tests for:
- paper/cash strict separation, A$500 versus A$5k distinction;
- fixed A$50 stake, insufficient hypothetical paper cash and simultaneous exposures;
- decimal rounding and settled-turnover ROI;
- duplicates/retries/replays, stale prices and fixture identity;
- event starts near Australian daylight-saving boundaries;
- multi leg margins, pending/void/push/DNP and sportsbook settlement exceptions;
- original snapshot immutability and retrospective-source exclusion;
- same-game correlation, missing joint odds and null probability handling;
- Supabase ownership/RLS, authentication, secrets and source quotas;
- legacy/demo reset after backup and preservation of historical owner records;
- machine-readable V5 handoff provenance, data freshness and missing-report treatment.

Create isolated commits / pull requests rather than destructive main-branch rewriting. Do not claim full autonomy or a working predictive edge until verified end-to-end. If tests or external writes fail, report precisely what remains incomplete.

## 10. Current state at this checkpoint
- The existing ChatGPT automation `Automation_206cea71e4648191a49bd43601ef9e49` (`EdgeLab $5k Paper Research`) was **successfully updated** to the A$5k paper bankroll, A$50 fixed hypothetical stakes, broad market selection, independent accounting and concise V5 handoff. It is enabled and scheduled daily around 7pm Melbourne time. Its actual durable persistence and prior run P/L must be verified per run.
- GitHub repository is readable via the connected GitHub plugin, but **branch creation and issue creation both failed HTTP 403, Resource not accessible by integration**. Thus no SportsModel code changes, database updates or deployment were completed here. No OpenAI API key is required for these GitHub connector operations; write authorisation is the blocker.
- The owner's explicit permission to overwrite inaccurate demo/paper data should NOT be interpreted as permission to delete actual cash/owner records or tamper with Supabase migration history.
