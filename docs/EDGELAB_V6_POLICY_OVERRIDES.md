# EdgeLab V6 — Owner-approved paper policy overrides

Updated 11 November 2026. This document is an explicit amendment to the 9 November 2026 V6 Foundation. The requirements below supersede any conflicting requirements in that earlier foundation. Read together with `EDGELAB_V6_CODEX_MASTER.md`. Only PAPER activity is affected; the V5 cash experiment remains unchanged.

- Initial nominal hypothetical paper bankroll: **A$5,000**.
- Fixed hypothetical stake: **A$50 per independently qualified pre-event paper position**.
- **No daily, weekly, monthly, per-sport, per-game, or aggregate maximum count for distinct qualified positions**. No daily stake ceiling and no maximum concurrent paper exposures. Register all distinct selections meeting the frozen objective research rules. Zero qualifying bets is a valid result.
- **Do not block** otherwise eligible paper registrations because available simulated balance is below A$50 or becomes negative. This is an **uncapped-notional research cohort**, **not** a fully funded A$5,000 live-capital strategy.
- Show actual simulated accounting transparently: starting reference A$5,000, total realised hypothetical P/L, pending stake commitment, equity, available balance (may be negative), and virtual excess exposure. Do not fabricate deposits or mix metrics with a fully funded counterfactual.
- No unrestricted repeated duplicate entries for the same event, canonical market, side, threshold and decision window. Preserve different valid lines or markets; handle their dependence in inference, backtests and evaluation.
- No arbitrary Top-N or portfolio-diversification gate. Source quality, exact market mapping, pre-event authenticity, independently supported probability where required, and idempotency remain hard gates.
- Define a distinct predeclared **exploratory** paper class only if desired. If probability is unavailable, record probability and EV as `null`; never describe such a position as positive-EV or include it in probability calibration.
- Never place a real wager, connect a Sportsbet account, move money, or modify V5's real-money record/financial policies. No hosted database migration, production deployment or paid service without separate owner approval.
- No paid API or OpenAI API dependence. Use only permitted read-only odds/data feeds. Public visibility does not establish permission to automate collection; test/record rights and fail safely.
- Keep prospective original prices, timestamps, model forecasts and registration immutable; append corrections, do not rewrite original history.
