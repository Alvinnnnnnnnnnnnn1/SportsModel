# Actual Vercel Preview acceptance — 13 November 2026

The approved manual **Preview** is deployed and READY. Hosted acceptance is **partial**, not a blanket security sign-off: the existing owner was tested, but a distinct second account was unavailable. No application data was written.

| Deployment fact | Actual value |
| --- | --- |
| Preview | https://sports-model-foasnqidg-alvinnnnnnnnnnnnn1s-projects.vercel.app |
| Deployment ID | `dpl_8LCTi6jb1rK99Hm6scYDB5ujuWSd` |
| Existing project | `sports-model` / `prj_EzTK6B2NMuhSCQdg0IqksRBSNWMY` |
| Tested/deployed application SHA | `2cd0d2805f1e2d5faeed91f33ca92587966b8812` |
| Branch metadata | `feature/v6-autonomous-paper` |
| Deployment source/environment | CLI / Preview, `target=null`, READY |
| Build environment | Existing Node 26.x project setting; default build machine |

The root checkout remained at `7bfbb06469d96835c1bf0f084513860eb5ab4eb4` during deployment. A detached worktree at the exact application SHA supplied the upload. The upload plan contained 435 tracked files from that commit, with no untracked inputs, `.local`, `.git` or environment files. No package dependencies or app implementation changed. The feature's Git auto-deployment guard remained enabled; it did not block the explicitly authorised manual CLI Preview.

## Configuration and Production isolation

Only these **Preview-scoped** settings were added: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `V6_EVIDENCE_MODE=cloud`, and sensitive server-only `V6_HISTORY_BATCH_ID`. Values were supplied via stdin, not command arguments. The owner anchor was taken from the existing local configuration; it is not a worker credential. No provider keys, service-role key, source capability or protection-bypass secret were installed.

The owner requested Vercel CLI access and completed its browser device sign-in. The isolated checkout was linked to the existing project, without creating another project. Vercel's link command generated its ordinary ignored local OIDC environment file; that file was excluded from upload. No credential values appear in the acceptance reports.

Before/after Vercel management checks agree:

- Production alias remains `sports-model-mauve.vercel.app`, deployment `dpl_3pqYroTdgVHEvUAVntxSX6poaXkb`, SHA `73861e15b7b765e2578d08f7d97d9bed5222bf81` from the feature branch.
- Configured Production Branch remains **main**. Its distinction from the currently served manually redeployed feature commit is confirmed, not repaired implicitly.
- The original two Production environment entries retain their IDs and Production scopes. No Production environment mutation, branch change, promotion or merge was performed.
- Existing Vercel SSO protection remains `all_except_custom_domains`. No protection bypass was configured or used. Tests reached the application behind a real, user-completed Vercel session.

## Actual hosted results

Tests used visible Chrome, normal Supabase owner authentication, HTTPS routing and actual read-only workspace RPCs. There were no API interceptions, mocked JWTs or service-role clients. Browser credentials and raw RPC bodies were kept in browser memory; no storage-state exports, screenshots or traces were saved.

| Check | Actual hosted result |
| --- | --- |
| Existing owner authentication and RLS anchor gate | PASS: HTTP 503, exactly `Cloud research evidence not yet connected`, cloud mode |
| Anonymous application request, within Vercel protection | PASS: 401 JSON |
| Invalid bearer token | PASS: 401 JSON; genuinely expired/revoked valid tokens were not exercised |
| Foreign Origin / cross-site fetch | PASS: 403 JSON for each |
| Arbitrary file query | PASS: 400 JSON |
| Dashboard POST | PASS: 405, no mutation |
| All five V6 routes | PASS: `/v6`, `/v6/research`, `/v6/models`, `/v6/positions`, `/v6/health` show the explicit unconnected state |
| Existing private V5 routes | PASS: Overview, Ledger, Research, Paper, Analytics, Notifications, Settings and Imports loaded; no forms submitted |
| Owner session after browser reload | PASS |
| Core and history unchanged | PASS: full read-only RPC fingerprints match before/after; revisions 5 / 13, one core wager, zero funding transactions |
| Browser runtime exceptions | PASS: zero |
| Response safety | Probed JSON errors contained none of the checked token/secret/private-path markers; no wildcard CORS observed |
| Distinct authenticated wrong owner | **UNVERIFIED**: owner could not use an existing second account; no account created |
| Hosted sports POST origin guard | **UNVERIFIED**: initial harness used GET, which correctly returned 405 for this POST-only route |
| Genuine cloud research retrieval/persistence | **UNVERIFIED / NOT PROVISIONED**: source schema is absent; nothing was invented to fill the dashboard |

The old `Local same-origin access required` error did not occur on legitimate owner V6 requests. It remains appropriate for the separate loopback-only sports proxy. Existing local origin/security tests cover that proxy; GET 405 alone is not proof of its hosted POST guard.

## Test-harness findings and evidence retention

The original report contains **23 passed checks and two false-negative harness assumptions**. It is preserved verbatim under ignored `.local/v6/preview-acceptance-20261113/hosted-browser.json`, with `complete=false`. The later stop was intentional after the owner said the second account was unavailable, not a demonstrated application error. No full hosted acceptance is claimed.

1. The original checker required `X-EdgeLab-Revision`. That header is conditional on `VERCEL_GIT_COMMIT_SHA`; this manual CLI deployment omitted it. Exact deployed identity is independently established by the clean worktree/upload plan plus Vercel management deployment metadata. Cloud mode was returned correctly. The corrected checker can accept a separately captured sanitized management receipt, while still rejecting an incorrect non-null revision header.
2. The original checker used GET for `/api/sports`. The corrected checker uses POST `{}`; remote origin rejection precedes authentication, parsing and any provider request. That corrected hosted probe has **not** been run. Do not relabel the old GET probe as a passing POST test.

Sanitized before/after management receipts, original browser report, reviewed summary, read-only catalog/history receipts and upload-plan evidence remain private/ignored. This document contains no raw owner identifiers or source data. `scripts/check-v6-hosted-preview-browser.mjs` preserves read-only operation and supports `--owner-only`; partial runs remain incomplete. When the owner is ready for another acceptance run:

```sh
node scripts/check-v6-hosted-preview-browser.mjs \
  --url https://sports-model-foasnqidg-alvinnnnnnnnnnnnn1s-projects.vercel.app \
  --runtime /private/tmp/edgelab-cloud-validation \
  --deployment-receipt .local/v6/preview-acceptance-20261113/vercel-after.json \
  --report .local/v6/preview-acceptance-20261113/hosted-browser-followup.json
```

This requires owner and distinct existing second-account sign-ins in the checker's visible QA windows. It is not necessary to repeat account setup, save settings or import anything. A normal browser session in another window cannot be used by the checker. Do not use `vercel curl`, `--verify` or disable SSO to bypass this requirement; those routes may create a protection-bypass secret.

## Source storage and unchanged local pilot

[Approval S review](v6-source-storage-approval.md) found a real role-ownership compatibility blocker in the unchanged source SQL. It is **not ready to apply as written**. No hosted DDL, source upload, capability issuance or cloud worker activation occurred. Original PAPER A/B/C remain separate and unapproved.

The existing Mac LaunchAgent remains loaded with its 60-second interval and last exit 0, waiting for the future approved window. Its source config/receipt and dataset hashes remain unchanged. Odds counters remain 10 reserved / 10 used / 490 remaining. First genuine capture remains **14 November 2026, 19:00 Australia/Melbourne**; maximum 50 additional credits, cumulative ceiling 60, reserve 100. There was no sports-provider request, cloud collector or Mac handover in this task.
