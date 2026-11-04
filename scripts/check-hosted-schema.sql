-- EdgeLab hosted schema verifier. SELECT ONLY: reads PostgreSQL catalogs,
-- never application records. This proves catalog configuration, not Auth/JWT
-- behavior or normal-user RLS enforcement. Run real-account tests separately.
-- Expected migration SHA-256 files (local provenance, not a remote history hash):
-- 202611030001_edgelab.sql: 550af08d2a33026e641103bda42444193723b701ed0152bff3ce344667a3d33b
-- 202611030002_harden_workspace_integrity.sql: d90a2fc096dfed2bc8c0aeb38ae4ba7f86783afa86fb1e905e824affadf3fb21
-- Compare function bodies exactly by SHA-256; structural metadata compares exact
-- object names and definitions. Every raw ACL difference remains a failure.
-- Expected ACLs model verified Supabase PUBLIC-schema default function grants
-- to anon/authenticated (without grant option), followed by migration revokes.
-- This verifier never modifies hosted permissions.
with expected as (select $edgelab_catalog${
  "roles": {
    "anon": {
      "canLogin": false,
      "bypassRls": false,
      "superuser": false
    },
    "authenticated": {
      "canLogin": false,
      "bypassRls": false,
      "superuser": false
    }
  },
  "tables": {
    "bets": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "events": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "sports": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "bet_legs": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "audit_history": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "notifications": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "research_runs": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "user_profiles": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "model_versions": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "odds_snapshots": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "paper_predictions": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "experiment_settings": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "research_candidates": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    },
    "financial_transactions": {
      "rls": true,
      "kind": "r",
      "forceRls": false,
      "ownerIsPrivileged": true
    }
  },
  "columns": {
    "bets.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "events.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": "gen_random_uuid()"
    },
    "sports.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": "gen_random_uuid()"
    },
    "bets.stake": {
      "type": "numeric(14,2)",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "s",
      "expression": "(((payload ->> 'stakeCents'::text))::numeric / (100)::numeric)"
    },
    "bet_legs.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "events.name": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "sports.code": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "bets.outcome": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 8,
      "generated": "s",
      "expression": "(payload ->> 'outcome'::text)"
    },
    "bets.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "bets.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "bets.strategy": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 9,
      "generated": "s",
      "expression": "(payload ->> 'strategy'::text)"
    },
    "bets.bookmaker": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 11,
      "generated": "s",
      "expression": "(payload ->> 'bookmaker'::text)"
    },
    "bets.placed_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 12,
      "generated": "",
      "expression": null
    },
    "events.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "sports.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "bet_legs.active": {
      "type": "boolean",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "",
      "expression": "true"
    },
    "bet_legs.bet_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "bet_legs.market": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 7,
      "generated": "s",
      "expression": "(payload ->> 'market'::text)"
    },
    "bets.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 15,
      "generated": "",
      "expression": "now()"
    },
    "bets.settled_at": {
      "type": "timestamp with time zone",
      "notNull": false,
      "identity": "",
      "position": 14,
      "generated": "",
      "expression": null
    },
    "bets.stake_type": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "s",
      "expression": "(payload ->> 'stakeType'::text)"
    },
    "events.sport_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "audit_history.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "bet_legs.outcome": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 11,
      "generated": "s",
      "expression": "(payload ->> 'outcome'::text)"
    },
    "bet_legs.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "bet_legs.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "bets.probability": {
      "type": "numeric",
      "notNull": false,
      "identity": "",
      "position": 10,
      "generated": "s",
      "expression": "((payload ->> 'probability'::text))::numeric"
    },
    "events.starts_at": {
      "type": "timestamp with time zone",
      "notNull": false,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "notifications.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "research_runs.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "user_profiles.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "bet_legs.event_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "bets.candidate_id": {
      "type": "uuid",
      "notNull": false,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "bets.confirmed_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 13,
      "generated": "",
      "expression": null
    },
    "bets.decimal_odds": {
      "type": "numeric(12,4)",
      "notNull": true,
      "identity": "",
      "position": 7,
      "generated": "s",
      "expression": "((payload ->> 'odds'::text))::numeric"
    },
    "events.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "",
      "expression": "now()"
    },
    "model_versions.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": "gen_random_uuid()"
    },
    "odds_snapshots.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": "gen_random_uuid()"
    },
    "bet_legs.selection": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 8,
      "generated": "s",
      "expression": "(payload ->> 'selection'::text)"
    },
    "bet_legs.threshold": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 9,
      "generated": "s",
      "expression": "(payload ->> 'line'::text)"
    },
    "model_versions.name": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "audit_history.action": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "paper_predictions.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "research_runs.status": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "s",
      "expression": "(payload ->> 'status'::text)"
    },
    "audit_history.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "",
      "expression": null
    },
    "audit_history.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "bet_legs.decimal_odds": {
      "type": "numeric(12,4)",
      "notNull": true,
      "identity": "",
      "position": 10,
      "generated": "s",
      "expression": "((payload ->> 'odds'::text))::numeric"
    },
    "model_versions.method": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "notifications.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "notifications.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "odds_snapshots.source": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "research_runs.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "research_runs.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "model_versions.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "odds_snapshots.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "research_candidates.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "audit_history.entity_id": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "audit_history.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 7,
      "generated": "",
      "expression": null
    },
    "notifications.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "research_runs.started_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "user_profiles.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": "now()"
    },
    "audit_history.entity_type": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "financial_transactions.id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "model_versions.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": "now()"
    },
    "odds_snapshots.provenance": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 7,
      "generated": "",
      "expression": null
    },
    "paper_predictions.outcome": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "s",
      "expression": "(payload ->> 'outcome'::text)"
    },
    "paper_predictions.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "paper_predictions.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "notifications.candidate_id": {
      "type": "uuid",
      "notNull": false,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "odds_snapshots.captured_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "",
      "expression": null
    },
    "user_profiles.display_name": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": "''::text"
    },
    "experiment_settings.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 1,
      "generated": "",
      "expression": null
    },
    "financial_transactions.kind": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "s",
      "expression": "(payload ->> 'kind'::text)"
    },
    "odds_snapshots.candidate_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "odds_snapshots.decimal_odds": {
      "type": "numeric(12,4)",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    },
    "research_candidates.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": null
    },
    "research_candidates.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "experiment_settings.currency": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": "'AUD'::text"
    },
    "experiment_settings.revision": {
      "type": "bigint",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "",
      "expression": "0"
    },
    "experiment_settings.timezone": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "",
      "expression": "'Australia/Melbourne'::text"
    },
    "paper_predictions.settled_at": {
      "type": "timestamp with time zone",
      "notNull": false,
      "identity": "",
      "position": 8,
      "generated": "",
      "expression": null
    },
    "research_candidates.event_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "research_candidates.strategy": {
      "type": "text",
      "notNull": true,
      "identity": "",
      "position": 8,
      "generated": "s",
      "expression": "(payload ->> 'strategy'::text)"
    },
    "financial_transactions.amount": {
      "type": "numeric(14,2)",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "s",
      "expression": "(((payload ->> 'amountCents'::text))::numeric / (100)::numeric)"
    },
    "experiment_settings.updated_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 7,
      "generated": "",
      "expression": "now()"
    },
    "financial_transactions.payload": {
      "type": "jsonb",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "financial_transactions.user_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": null
    },
    "paper_predictions.candidate_id": {
      "type": "uuid",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": null
    },
    "experiment_settings.funding_cap": {
      "type": "numeric(14,2)",
      "notNull": true,
      "identity": "",
      "position": 2,
      "generated": "",
      "expression": "500"
    },
    "paper_predictions.registered_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 7,
      "generated": "",
      "expression": null
    },
    "research_candidates.probability": {
      "type": "numeric",
      "notNull": false,
      "identity": "",
      "position": 7,
      "generated": "s",
      "expression": "((payload ->> 'probability'::text))::numeric"
    },
    "research_candidates.decimal_odds": {
      "type": "numeric(12,4)",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "s",
      "expression": "((payload ->> 'odds'::text))::numeric"
    },
    "experiment_settings.default_stake": {
      "type": "numeric(14,2)",
      "notNull": true,
      "identity": "",
      "position": 3,
      "generated": "",
      "expression": "5"
    },
    "financial_transactions.created_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 6,
      "generated": "",
      "expression": null
    },
    "research_candidates.registered_at": {
      "type": "timestamp with time zone",
      "notNull": true,
      "identity": "",
      "position": 9,
      "generated": "",
      "expression": null
    },
    "paper_predictions.hypothetical_stake": {
      "type": "numeric(14,2)",
      "notNull": true,
      "identity": "",
      "position": 5,
      "generated": "s",
      "expression": "(((payload ->> 'hypotheticalStakeCents'::text))::numeric / (100)::numeric)"
    },
    "research_candidates.model_version_id": {
      "type": "uuid",
      "notNull": false,
      "identity": "",
      "position": 4,
      "generated": "",
      "expression": null
    }
  },
  "indexes": {
    "bets.bets_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX bets_pkey ON bets USING btree (id)"
    },
    "events.events_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX events_pkey ON events USING btree (id)"
    },
    "sports.sports_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX sports_pkey ON sports USING btree (id)"
    },
    "bets.bets_owner_date": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX bets_owner_date ON bets USING btree (user_id, placed_at DESC)"
    },
    "bet_legs.bet_legs_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX bet_legs_pkey ON bet_legs USING btree (id)"
    },
    "bet_legs.legs_owner_bet": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX legs_owner_bet ON bet_legs USING btree (user_id, bet_id)"
    },
    "bets.bets_owner_outcome": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX bets_owner_outcome ON bets USING btree (user_id, outcome)"
    },
    "bets.bets_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX bets_user_id_id_key ON bets USING btree (user_id, id)"
    },
    "events.events_owner_sport": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX events_owner_sport ON events USING btree (user_id, sport_id)"
    },
    "events.events_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX events_user_id_id_key ON events USING btree (user_id, id)"
    },
    "sports.sports_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX sports_user_id_id_key ON sports USING btree (user_id, id)"
    },
    "research_runs.runs_owner_date": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX runs_owner_date ON research_runs USING btree (user_id, started_at DESC)"
    },
    "sports.sports_user_id_code_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX sports_user_id_code_key ON sports USING btree (user_id, code)"
    },
    "audit_history.audit_history_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX audit_history_pkey ON audit_history USING btree (id)"
    },
    "audit_history.audit_owner_entity": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX audit_owner_entity ON audit_history USING btree (user_id, entity_type, entity_id, created_at DESC)"
    },
    "bet_legs.bet_legs_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX bet_legs_user_id_id_key ON bet_legs USING btree (user_id, id)"
    },
    "notifications.notifications_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX notifications_pkey ON notifications USING btree (id)"
    },
    "research_runs.research_runs_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX research_runs_pkey ON research_runs USING btree (id)"
    },
    "user_profiles.user_profiles_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX user_profiles_pkey ON user_profiles USING btree (id)"
    },
    "model_versions.model_versions_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX model_versions_pkey ON model_versions USING btree (id)"
    },
    "odds_snapshots.odds_snapshots_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX odds_snapshots_pkey ON odds_snapshots USING btree (id)"
    },
    "odds_snapshots.snapshots_owner_date": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX snapshots_owner_date ON odds_snapshots USING btree (user_id, captured_at DESC)"
    },
    "notifications.notifications_owner_date": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX notifications_owner_date ON notifications USING btree (user_id, created_at DESC)"
    },
    "paper_predictions.papers_owner_outcome": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX papers_owner_outcome ON paper_predictions USING btree (user_id, outcome)"
    },
    "events.events_user_id_sport_id_name_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX events_user_id_sport_id_name_key ON events USING btree (user_id, sport_id, name)"
    },
    "paper_predictions.paper_predictions_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX paper_predictions_pkey ON paper_predictions USING btree (id)"
    },
    "research_candidates.candidates_owner_date": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX candidates_owner_date ON research_candidates USING btree (user_id, registered_at DESC)"
    },
    "audit_history.audit_history_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX audit_history_user_id_id_key ON audit_history USING btree (user_id, id)"
    },
    "notifications.notifications_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX notifications_user_id_id_key ON notifications USING btree (user_id, id)"
    },
    "research_runs.research_runs_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX research_runs_user_id_id_key ON research_runs USING btree (user_id, id)"
    },
    "experiment_settings.experiment_settings_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX experiment_settings_pkey ON experiment_settings USING btree (user_id)"
    },
    "model_versions.model_versions_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX model_versions_user_id_id_key ON model_versions USING btree (user_id, id)"
    },
    "odds_snapshots.odds_snapshots_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX odds_snapshots_user_id_id_key ON odds_snapshots USING btree (user_id, id)"
    },
    "research_candidates.research_candidates_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX research_candidates_pkey ON research_candidates USING btree (id)"
    },
    "financial_transactions.transactions_owner_date": {
      "ready": true,
      "valid": true,
      "unique": false,
      "primary": false,
      "definition": "CREATE INDEX transactions_owner_date ON financial_transactions USING btree (user_id, created_at)"
    },
    "financial_transactions.financial_transactions_pkey": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": true,
      "definition": "CREATE UNIQUE INDEX financial_transactions_pkey ON financial_transactions USING btree (id)"
    },
    "paper_predictions.paper_predictions_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX paper_predictions_user_id_id_key ON paper_predictions USING btree (user_id, id)"
    },
    "model_versions.model_versions_user_id_name_method_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX model_versions_user_id_name_method_key ON model_versions USING btree (user_id, name, method)"
    },
    "odds_snapshots.odds_snapshots_user_id_candidate_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX odds_snapshots_user_id_candidate_id_key ON odds_snapshots USING btree (user_id, candidate_id)"
    },
    "research_candidates.research_candidates_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX research_candidates_user_id_id_key ON research_candidates USING btree (user_id, id)"
    },
    "financial_transactions.financial_transactions_user_id_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX financial_transactions_user_id_id_key ON financial_transactions USING btree (user_id, id)"
    },
    "paper_predictions.paper_predictions_user_id_candidate_id_key": {
      "ready": true,
      "valid": true,
      "unique": true,
      "primary": false,
      "definition": "CREATE UNIQUE INDEX paper_predictions_user_id_candidate_id_key ON paper_predictions USING btree (user_id, candidate_id)"
    }
  },
  "policies": {
    "bets.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "events.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "sports.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "bet_legs.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "audit_history.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "notifications.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "research_runs.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "model_versions.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "odds_snapshots.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "user_profiles.profile_owner": {
      "check": "(id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "paper_predictions.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "experiment_settings.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "research_candidates.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    },
    "financial_transactions.owner_access": {
      "check": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "using": "(user_id = auth.uid())",
      "command": "*",
      "permissive": true
    }
  },
  "triggers": {
    "bets.bet_update_audit": {
      "type": 17,
      "when": null,
      "enabled": "O",
      "function": "edgelab_audit_bet()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "bets.bet_probability_guard": {
      "type": 19,
      "when": null,
      "enabled": "O",
      "function": "edgelab_guard_prediction()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "bets.edgelab_bet_projection": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_check_leg_projection()",
      "arguments": "",
      "deferrable": true,
      "initiallyDeferred": true
    },
    "audit_history.immutable_audit": {
      "type": 19,
      "when": null,
      "enabled": "O",
      "function": "edgelab_deny_rewrite()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "bet_legs.edgelab_leg_identity": {
      "type": 23,
      "when": null,
      "enabled": "O",
      "function": "edgelab_guard_leg_identity()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "odds_snapshots.immutable_odds": {
      "type": 19,
      "when": null,
      "enabled": "O",
      "function": "edgelab_deny_rewrite()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "bet_legs.edgelab_leg_projection": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_check_leg_projection()",
      "arguments": "",
      "deferrable": true,
      "initiallyDeferred": true
    },
    "model_versions.immutable_models": {
      "type": 19,
      "when": null,
      "enabled": "O",
      "function": "edgelab_deny_rewrite()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "bets.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "events.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "sports.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "bet_legs.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "paper_predictions.paper_snapshot_guard": {
      "type": 23,
      "when": null,
      "enabled": "O",
      "function": "edgelab_guard_prediction()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "research_candidates.immutable_candidates": {
      "type": 19,
      "when": null,
      "enabled": "O",
      "function": "edgelab_deny_rewrite()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "audit_history.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "notifications.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "research_runs.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "model_versions.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "odds_snapshots.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "experiment_settings.edgelab_settings_revision": {
      "type": 23,
      "when": null,
      "enabled": "O",
      "function": "edgelab_guard_settings_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "financial_transactions.immutable_transactions": {
      "type": 19,
      "when": null,
      "enabled": "O",
      "function": "edgelab_deny_rewrite()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "paper_predictions.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "research_candidates.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    },
    "financial_transactions.edgelab_direct_write_revision": {
      "type": 21,
      "when": null,
      "enabled": "O",
      "function": "edgelab_bump_direct_revision()",
      "arguments": "",
      "deferrable": false,
      "initiallyDeferred": false
    }
  },
  "functions": {
    "edgelab_audit_bet()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "ecf9ab367c439dc9da6877cd28845b4669bb9423dd97f3dc3de83ed99095538d",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_deny_rewrite()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "a4f234982c2a3302fade72c4e00cf44f9b60dd9844f61c5abcd657fb3b19789f",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_load_workspace()": {
      "strict": false,
      "returns": "jsonb",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "a6589becf433a2eaea76bceb4f57f44fa59e8b7f14f27f15001d95155c7fbc5b",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_guard_prediction()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "21a8a21d2a46971da18aa0e4188966ad8b3b7ed7a44f7aa5b348506aa74e6d01",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_guard_leg_identity()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "2ce3ef26fe65e1a8f0ee390aa27f5dadcec2d15e4f6229a3d1983f9c736ad6fb",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_bump_direct_revision()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "17ac2b8413b181308d7f653cb0400de9f3a99a368e98796cab3cdb2da86a6cb9",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_check_leg_projection()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "d13943272d50a8fe9fadd95833735ff5af9004d6d8fd943d0dff6397426f2696",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_guard_settings_revision()": {
      "strict": false,
      "returns": "trigger",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "fce2c509931a1623c73c06f51df24be88428a53400ad0426cff3122a961410a5",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_json_odds(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "a13fd3c7ea874c47ec6fe8e1be2a3f2fd753489a04a53c87c43e52cf39869ecf",
      "volatility": "i",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_json_uuid(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "2dbf65b696dadb1e0ae34ef86a9151477cbf704de70173753e866951d1a97888",
      "volatility": "i",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_json_cents(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "69f911464f05f06b66eadc28055c3a22d51546d81eedf681db378816ab25cfee",
      "volatility": "i",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_bet_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "b02a74db9fc25bac65d865102bbab65cdba868aaeb9ef3c10ed3df3a812c88c6",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_leg_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "bfd938dbf56c9eb571ef32bd8234e06c6193f2640e701513151d2afe38e663dd",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_run_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "ee8f949712e85d6c977ffdf05a66ed990c139f4b2142ef4f8a4135478c714236",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_audit_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "56dece922cec6d846b0c9ba564cec9a0ee56c3c57085da700f7f676df58185fd",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_json_timestamp(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "478e626d9d2e12b6b03e5ace93f46386433ef36d99bdc4903db6278e8f04aa07",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_paper_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "3b2c5a53c2b0699e07ba48541104eaa288cde6a8241c04dbba5f95016caacdbb",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_json_probability(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "642004924d0bc1be73fe7c9fe869078e7033b81f9eeba6f172e7b899ca30386d",
      "volatility": "i",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_candidate_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "76d31cbb3e849215511f1f177f4d715e38008eb52599b223af1e5aa2a1696816",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_private_provenance(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "5b924f0ab6e7522f49c94e6b02bfb0f1b0fe2710bd22527d888e039512989f23",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_transaction_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "7b05343cafe80c8a2540cf94fad2cc492355f11a24baf85694988aab3cc5563e",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_notification_snapshot(value jsonb)": {
      "strict": false,
      "returns": "boolean",
      "defaults": null,
      "language": "sql",
      "bodySha256": "ca67db4db9f4d859c57466bb38109c60fb2dc59c4ee5bceed01b20cd8926f029",
      "volatility": "s",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_save_workspace(workspace jsonb, expected_revision bigint)": {
      "strict": false,
      "returns": "bigint",
      "defaults": null,
      "language": "plpgsql",
      "bodySha256": "a62e38e138a5f0c295dd14af6ee3df814195c22ef62df082facc743b4eb4eefa",
      "volatility": "v",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    },
    "edgelab_valid_json_text(value jsonb, minimum integer, maximum integer, trimmed boolean)": {
      "strict": false,
      "returns": "boolean",
      "defaults": "true",
      "language": "sql",
      "bodySha256": "3e7a7ff481d4076b1541036e4ab576d2ece4497d45c9f65edd99e6b7a239a6cf",
      "volatility": "i",
      "configuration": [
        "search_path=\"\""
      ],
      "securityDefiner": false
    }
  },
  "constraints": {
    "bets.bets_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "bets.bets_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "bets.bets_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (((probability IS NULL) OR edgelab_valid_private_provenance((payload -> 'probabilityProvenance'::text))))"
    },
    "bets.bets_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'candidateId'::text))::uuid IS DISTINCT FROM candidate_id)))"
    },
    "bets.bets_check3": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'placedAt'::text))::timestamp with time zone IS DISTINCT FROM placed_at)))"
    },
    "bets.bets_check4": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'confirmedAt'::text))::timestamp with time zone IS DISTINCT FROM confirmed_at)))"
    },
    "bets.bets_check5": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'settledAt'::text))::timestamp with time zone IS DISTINCT FROM settled_at)))"
    },
    "bets.bets_check6": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (((settled_at IS NULL) OR (settled_at >= placed_at)))"
    },
    "bets.bets_check7": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((outcome = 'pending'::text) AND (settled_at IS NULL)) OR ((outcome <> 'pending'::text) AND (settled_at IS NOT NULL))))"
    },
    "events.events_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "sports.sports_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "bets.bets_stake_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((stake > (0)::numeric))"
    },
    "bet_legs.bet_legs_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "bets.bets_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "bet_legs.bet_legs_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "bets.bets_outcome_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((outcome = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text, 'void'::text])))"
    },
    "bets.bets_payload_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((jsonb_typeof(payload) = 'object'::text))"
    },
    "bets.bets_payload_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((jsonb_array_length((payload -> 'legs'::text)) > 0))"
    },
    "bets.bets_payload_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((payload -> 'oddsProvenance'::text) IS NULL) OR edgelab_valid_private_provenance((payload -> 'oddsProvenance'::text))))"
    },
    "bets.bets_payload_check3": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((payload -> 'probabilityProvenance'::text) IS NULL) OR edgelab_valid_private_provenance((payload -> 'probabilityProvenance'::text))))"
    },
    "bets.bets_payload_check4": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((payload ->> 'stakeCents'::text))::numeric = trunc(((payload ->> 'stakeCents'::text))::numeric)))"
    },
    "bets.bets_strategy_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((strategy = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])))"
    },
    "bets.bets_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "events.events_name_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((length(name) > 0))"
    },
    "sports.sports_code_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((code = ANY (ARRAY['NBA'::text, 'NBL'::text, 'ATP'::text, 'WTA'::text])))"
    },
    "bets.bets_stake_type_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((stake_type = ANY (ARRAY['cash'::text, 'bonus'::text])))"
    },
    "events.events_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "sports.sports_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "bets.bets_probability_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (((probability >= (0)::numeric) AND (probability <= (1)::numeric)))"
    },
    "bets.bets_decimal_odds_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((decimal_odds > (1)::numeric))"
    },
    "events.events_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "sports.sports_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "bet_legs.bet_legs_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "sports.sports_user_id_code_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, code)"
    },
    "bet_legs.bet_legs_outcome_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((outcome = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text, 'void'::text])))"
    },
    "bets.edgelab_bet_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_bet_snapshot(payload)) NOT VALID"
    },
    "audit_history.audit_history_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "bet_legs.bet_legs_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "notifications.notifications_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "research_runs.research_runs_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "user_profiles.user_profiles_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "audit_history.audit_history_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "notifications.notifications_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "research_runs.research_runs_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "audit_history.audit_history_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT ((payload ->> 'entityType'::text) IS DISTINCT FROM entity_type)))"
    },
    "audit_history.audit_history_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT ((payload ->> 'entityId'::text) IS DISTINCT FROM entity_id)))"
    },
    "audit_history.audit_history_check3": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT ((payload ->> 'action'::text) IS DISTINCT FROM action)))"
    },
    "audit_history.audit_history_check4": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'timestamp'::text))::timestamp with time zone IS DISTINCT FROM created_at)))"
    },
    "model_versions.model_versions_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "notifications.notifications_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'candidateId'::text))::uuid IS DISTINCT FROM candidate_id)))"
    },
    "notifications.notifications_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'createdAt'::text))::timestamp with time zone IS DISTINCT FROM created_at)))"
    },
    "odds_snapshots.odds_snapshots_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "research_runs.research_runs_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'startedAt'::text))::timestamp with time zone IS DISTINCT FROM started_at)))"
    },
    "bet_legs.edgelab_leg_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_leg_snapshot(payload)) NOT VALID"
    },
    "bets.bets_user_id_candidate_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, candidate_id) REFERENCES research_candidates(user_id, id)"
    },
    "events.events_user_id_sport_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, sport_id) REFERENCES sports(user_id, id)"
    },
    "odds_snapshots.odds_snapshots_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (source IS DISTINCT FROM (provenance ->> 'source'::text))))"
    },
    "user_profiles.user_profiles_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "bet_legs.bet_legs_decimal_odds_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((decimal_odds > (1)::numeric))"
    },
    "odds_snapshots.odds_snapshots_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (captured_at IS DISTINCT FROM ((provenance ->> 'timestamp'::text))::timestamp with time zone)))"
    },
    "bet_legs.bet_legs_user_id_bet_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, bet_id) REFERENCES bets(user_id, id)"
    },
    "bet_legs.bet_legs_user_id_event_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, event_id) REFERENCES events(user_id, id)"
    },
    "events.events_user_id_sport_id_name_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, sport_id, name)"
    },
    "audit_history.audit_history_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "notifications.notifications_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "paper_predictions.paper_predictions_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "research_runs.edgelab_run_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_run_snapshot(payload)) NOT VALID"
    },
    "research_runs.research_runs_status_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])))"
    },
    "research_runs.research_runs_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "notifications.notifications_payload_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT ((payload -> 'simulated'::text) IS DISTINCT FROM 'false'::jsonb)))"
    },
    "paper_predictions.paper_predictions_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "research_runs.research_runs_payload_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT ((payload -> 'simulated'::text) IS DISTINCT FROM 'false'::jsonb)))"
    },
    "audit_history.audit_history_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "audit_history.edgelab_audit_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_audit_snapshot(payload)) NOT VALID"
    },
    "model_versions.model_versions_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "notifications.notifications_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "odds_snapshots.odds_snapshots_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "paper_predictions.paper_predictions_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload #>> '{candidate,id}'::text[]))::uuid IS DISTINCT FROM candidate_id)))"
    },
    "paper_predictions.paper_predictions_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'registeredAt'::text))::timestamp with time zone IS DISTINCT FROM registered_at)))"
    },
    "paper_predictions.paper_predictions_check3": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'settledAt'::text))::timestamp with time zone IS DISTINCT FROM settled_at)))"
    },
    "paper_predictions.paper_predictions_check4": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (((settled_at IS NULL) OR (settled_at >= registered_at)))"
    },
    "paper_predictions.paper_predictions_check5": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((outcome = 'pending'::text) AND (settled_at IS NULL)) OR ((outcome <> 'pending'::text) AND (settled_at IS NOT NULL))))"
    },
    "research_runs.research_runs_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "experiment_settings.experiment_settings_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (user_id)"
    },
    "model_versions.model_versions_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "odds_snapshots.odds_snapshots_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "research_candidates.research_candidates_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "audit_history.audit_history_entity_type_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((entity_type = ANY (ARRAY['bet'::text, 'paper'::text, 'settings'::text, 'transaction'::text])))"
    },
    "research_candidates.research_candidates_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "odds_snapshots.odds_snapshots_provenance_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_private_provenance(provenance))"
    },
    "paper_predictions.edgelab_paper_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_paper_snapshot(payload)) NOT VALID"
    },
    "research_candidates.research_candidates_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (((probability IS NULL) OR edgelab_valid_private_provenance((payload -> 'probabilityProvenance'::text))))"
    },
    "research_candidates.research_candidates_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'registeredAt'::text))::timestamp with time zone IS DISTINCT FROM registered_at)))"
    },
    "odds_snapshots.odds_snapshots_decimal_odds_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((decimal_odds > (1)::numeric))"
    },
    "paper_predictions.paper_predictions_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "notifications.edgelab_notification_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_notification_snapshot(payload)) NOT VALID"
    },
    "paper_predictions.paper_predictions_outcome_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((outcome = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text, 'void'::text])))"
    },
    "paper_predictions.paper_predictions_payload_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_private_provenance((payload #> '{candidate,oddsProvenance}'::text[])))"
    },
    "financial_transactions.financial_transactions_pkey": {
      "type": "p",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "PRIMARY KEY (id)"
    },
    "paper_predictions.paper_predictions_payload_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((payload ->> 'hypotheticalStakeCents'::text))::numeric = trunc(((payload ->> 'hypotheticalStakeCents'::text))::numeric)))"
    },
    "paper_predictions.paper_predictions_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "financial_transactions.financial_transactions_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'id'::text))::uuid IS DISTINCT FROM id)))"
    },
    "experiment_settings.experiment_settings_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "financial_transactions.financial_transactions_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((NOT (((payload ->> 'createdAt'::text))::timestamp with time zone IS DISTINCT FROM created_at)))"
    },
    "research_candidates.edgelab_candidate_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_candidate_snapshot(payload)) NOT VALID"
    },
    "research_candidates.research_candidates_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "model_versions.model_versions_user_id_name_method_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, name, method)"
    },
    "notifications.notifications_user_id_candidate_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, candidate_id) REFERENCES research_candidates(user_id, id)"
    },
    "research_candidates.research_candidates_payload_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((jsonb_typeof(payload) = 'object'::text))"
    },
    "experiment_settings.experiment_settings_currency_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((currency = 'AUD'::text))"
    },
    "experiment_settings.experiment_settings_revision_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((revision >= 0))"
    },
    "experiment_settings.experiment_settings_timezone_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((timezone = 'Australia/Melbourne'::text))"
    },
    "odds_snapshots.odds_snapshots_user_id_candidate_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, candidate_id)"
    },
    "research_candidates.research_candidates_payload_check1": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_private_provenance((payload -> 'oddsProvenance'::text)))"
    },
    "research_candidates.research_candidates_payload_check2": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((payload -> 'probabilityProvenance'::text) IS NULL) OR edgelab_valid_private_provenance((payload -> 'probabilityProvenance'::text))))"
    },
    "research_candidates.research_candidates_strategy_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((strategy = ANY (ARRAY['A'::text, 'B'::text, 'C'::text])))"
    },
    "research_candidates.research_candidates_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "experiment_settings.edgelab_settings_currency_precision": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (((funding_cap > (0)::numeric) AND (funding_cap <= (1000000)::numeric) AND (default_stake > (0)::numeric) AND (default_stake <= (1000000)::numeric) AND (funding_cap <> 'NaN'::numeric) AND (default_stake <> 'NaN'::numeric))) NOT VALID"
    },
    "odds_snapshots.odds_snapshots_user_id_candidate_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, candidate_id) REFERENCES research_candidates(user_id, id)"
    },
    "financial_transactions.financial_transactions_kind_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((kind = ANY (ARRAY['deposit'::text, 'withdrawal'::text])))"
    },
    "experiment_settings.experiment_settings_funding_cap_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((funding_cap >= (0)::numeric))"
    },
    "financial_transactions.edgelab_transaction_snapshot_valid": {
      "type": "c",
      "deferred": false,
      "validated": false,
      "deferrable": false,
      "definition": "CHECK (edgelab_valid_transaction_snapshot(payload)) NOT VALID"
    },
    "research_candidates.research_candidates_probability_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK (((probability >= (0)::numeric) AND (probability <= (1)::numeric)))"
    },
    "financial_transactions.financial_transactions_amount_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((amount > (0)::numeric))"
    },
    "financial_transactions.financial_transactions_user_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"
    },
    "research_candidates.research_candidates_decimal_odds_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((decimal_odds > (1)::numeric))"
    },
    "experiment_settings.experiment_settings_default_stake_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((default_stake > (0)::numeric))"
    },
    "financial_transactions.financial_transactions_payload_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((((payload ->> 'amountCents'::text))::numeric = trunc(((payload ->> 'amountCents'::text))::numeric)))"
    },
    "financial_transactions.financial_transactions_user_id_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, id)"
    },
    "paper_predictions.paper_predictions_hypothetical_stake_check": {
      "type": "c",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "CHECK ((hypothetical_stake > (0)::numeric))"
    },
    "paper_predictions.paper_predictions_user_id_candidate_id_key": {
      "type": "u",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "UNIQUE (user_id, candidate_id)"
    },
    "paper_predictions.paper_predictions_user_id_candidate_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, candidate_id) REFERENCES research_candidates(user_id, id)"
    },
    "research_candidates.research_candidates_user_id_event_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, event_id) REFERENCES events(user_id, id)"
    },
    "research_candidates.research_candidates_user_id_model_version_id_fkey": {
      "type": "f",
      "deferred": false,
      "validated": true,
      "deferrable": false,
      "definition": "FOREIGN KEY (user_id, model_version_id) REFERENCES model_versions(user_id, id)"
    }
  },
  "tableGrants": {
    "bets.anon.DELETE": false,
    "bets.anon.INSERT": false,
    "bets.anon.SELECT": false,
    "bets.anon.UPDATE": false,
    "bets.anon.TRIGGER": false,
    "bets.anon.TRUNCATE": false,
    "events.anon.DELETE": false,
    "events.anon.INSERT": false,
    "events.anon.SELECT": false,
    "events.anon.UPDATE": false,
    "sports.anon.DELETE": false,
    "sports.anon.INSERT": false,
    "sports.anon.SELECT": false,
    "sports.anon.UPDATE": false,
    "events.anon.TRIGGER": false,
    "sports.anon.TRIGGER": false,
    "bet_legs.anon.DELETE": false,
    "bet_legs.anon.INSERT": false,
    "bet_legs.anon.SELECT": false,
    "bet_legs.anon.UPDATE": false,
    "bets.anon.REFERENCES": false,
    "events.anon.TRUNCATE": false,
    "sports.anon.TRUNCATE": false,
    "bet_legs.anon.TRIGGER": false,
    "bet_legs.anon.TRUNCATE": false,
    "events.anon.REFERENCES": false,
    "sports.anon.REFERENCES": false,
    "bet_legs.anon.REFERENCES": false,
    "audit_history.anon.DELETE": false,
    "audit_history.anon.INSERT": false,
    "audit_history.anon.SELECT": false,
    "audit_history.anon.UPDATE": false,
    "bets.authenticated.DELETE": false,
    "bets.authenticated.INSERT": true,
    "bets.authenticated.SELECT": true,
    "bets.authenticated.UPDATE": true,
    "notifications.anon.DELETE": false,
    "notifications.anon.INSERT": false,
    "notifications.anon.SELECT": false,
    "notifications.anon.UPDATE": false,
    "research_runs.anon.DELETE": false,
    "research_runs.anon.INSERT": false,
    "research_runs.anon.SELECT": false,
    "research_runs.anon.UPDATE": false,
    "user_profiles.anon.DELETE": false,
    "user_profiles.anon.INSERT": false,
    "user_profiles.anon.SELECT": false,
    "user_profiles.anon.UPDATE": false,
    "audit_history.anon.TRIGGER": false,
    "bets.authenticated.TRIGGER": false,
    "model_versions.anon.DELETE": false,
    "model_versions.anon.INSERT": false,
    "model_versions.anon.SELECT": false,
    "model_versions.anon.UPDATE": false,
    "notifications.anon.TRIGGER": false,
    "odds_snapshots.anon.DELETE": false,
    "odds_snapshots.anon.INSERT": false,
    "odds_snapshots.anon.SELECT": false,
    "odds_snapshots.anon.UPDATE": false,
    "research_runs.anon.TRIGGER": false,
    "user_profiles.anon.TRIGGER": false,
    "audit_history.anon.TRUNCATE": false,
    "bets.authenticated.TRUNCATE": false,
    "events.authenticated.DELETE": false,
    "events.authenticated.INSERT": true,
    "events.authenticated.SELECT": true,
    "events.authenticated.UPDATE": true,
    "model_versions.anon.TRIGGER": false,
    "notifications.anon.TRUNCATE": false,
    "odds_snapshots.anon.TRIGGER": false,
    "research_runs.anon.TRUNCATE": false,
    "sports.authenticated.DELETE": false,
    "sports.authenticated.INSERT": true,
    "sports.authenticated.SELECT": true,
    "sports.authenticated.UPDATE": true,
    "user_profiles.anon.TRUNCATE": false,
    "events.authenticated.TRIGGER": false,
    "model_versions.anon.TRUNCATE": false,
    "odds_snapshots.anon.TRUNCATE": false,
    "sports.authenticated.TRIGGER": false,
    "audit_history.anon.REFERENCES": false,
    "bet_legs.authenticated.DELETE": false,
    "bet_legs.authenticated.INSERT": true,
    "bet_legs.authenticated.SELECT": true,
    "bet_legs.authenticated.UPDATE": true,
    "bets.authenticated.REFERENCES": false,
    "events.authenticated.TRUNCATE": false,
    "notifications.anon.REFERENCES": false,
    "paper_predictions.anon.DELETE": false,
    "paper_predictions.anon.INSERT": false,
    "paper_predictions.anon.SELECT": false,
    "paper_predictions.anon.UPDATE": false,
    "research_runs.anon.REFERENCES": false,
    "sports.authenticated.TRUNCATE": false,
    "user_profiles.anon.REFERENCES": false,
    "bet_legs.authenticated.TRIGGER": false,
    "model_versions.anon.REFERENCES": false,
    "odds_snapshots.anon.REFERENCES": false,
    "paper_predictions.anon.TRIGGER": false,
    "bet_legs.authenticated.TRUNCATE": false,
    "events.authenticated.REFERENCES": false,
    "experiment_settings.anon.DELETE": false,
    "experiment_settings.anon.INSERT": false,
    "experiment_settings.anon.SELECT": false,
    "experiment_settings.anon.UPDATE": false,
    "paper_predictions.anon.TRUNCATE": false,
    "research_candidates.anon.DELETE": false,
    "research_candidates.anon.INSERT": false,
    "research_candidates.anon.SELECT": false,
    "research_candidates.anon.UPDATE": false,
    "sports.authenticated.REFERENCES": false,
    "experiment_settings.anon.TRIGGER": false,
    "research_candidates.anon.TRIGGER": false,
    "bet_legs.authenticated.REFERENCES": false,
    "experiment_settings.anon.TRUNCATE": false,
    "paper_predictions.anon.REFERENCES": false,
    "research_candidates.anon.TRUNCATE": false,
    "audit_history.authenticated.DELETE": false,
    "audit_history.authenticated.INSERT": true,
    "audit_history.authenticated.SELECT": true,
    "audit_history.authenticated.UPDATE": true,
    "financial_transactions.anon.DELETE": false,
    "financial_transactions.anon.INSERT": false,
    "financial_transactions.anon.SELECT": false,
    "financial_transactions.anon.UPDATE": false,
    "notifications.authenticated.DELETE": false,
    "notifications.authenticated.INSERT": true,
    "notifications.authenticated.SELECT": true,
    "notifications.authenticated.UPDATE": true,
    "research_runs.authenticated.DELETE": false,
    "research_runs.authenticated.INSERT": true,
    "research_runs.authenticated.SELECT": true,
    "research_runs.authenticated.UPDATE": true,
    "user_profiles.authenticated.DELETE": false,
    "user_profiles.authenticated.INSERT": true,
    "user_profiles.authenticated.SELECT": true,
    "user_profiles.authenticated.UPDATE": true,
    "audit_history.authenticated.TRIGGER": false,
    "experiment_settings.anon.REFERENCES": false,
    "financial_transactions.anon.TRIGGER": false,
    "model_versions.authenticated.DELETE": false,
    "model_versions.authenticated.INSERT": true,
    "model_versions.authenticated.SELECT": true,
    "model_versions.authenticated.UPDATE": true,
    "notifications.authenticated.TRIGGER": false,
    "odds_snapshots.authenticated.DELETE": false,
    "odds_snapshots.authenticated.INSERT": true,
    "odds_snapshots.authenticated.SELECT": true,
    "odds_snapshots.authenticated.UPDATE": true,
    "research_candidates.anon.REFERENCES": false,
    "research_runs.authenticated.TRIGGER": false,
    "user_profiles.authenticated.TRIGGER": false,
    "audit_history.authenticated.TRUNCATE": false,
    "financial_transactions.anon.TRUNCATE": false,
    "model_versions.authenticated.TRIGGER": false,
    "notifications.authenticated.TRUNCATE": false,
    "odds_snapshots.authenticated.TRIGGER": false,
    "research_runs.authenticated.TRUNCATE": false,
    "user_profiles.authenticated.TRUNCATE": false,
    "model_versions.authenticated.TRUNCATE": false,
    "odds_snapshots.authenticated.TRUNCATE": false,
    "audit_history.authenticated.REFERENCES": false,
    "financial_transactions.anon.REFERENCES": false,
    "notifications.authenticated.REFERENCES": false,
    "paper_predictions.authenticated.DELETE": false,
    "paper_predictions.authenticated.INSERT": true,
    "paper_predictions.authenticated.SELECT": true,
    "paper_predictions.authenticated.UPDATE": true,
    "research_runs.authenticated.REFERENCES": false,
    "user_profiles.authenticated.REFERENCES": false,
    "model_versions.authenticated.REFERENCES": false,
    "odds_snapshots.authenticated.REFERENCES": false,
    "paper_predictions.authenticated.TRIGGER": false,
    "experiment_settings.authenticated.DELETE": false,
    "experiment_settings.authenticated.INSERT": true,
    "experiment_settings.authenticated.SELECT": true,
    "experiment_settings.authenticated.UPDATE": true,
    "paper_predictions.authenticated.TRUNCATE": false,
    "research_candidates.authenticated.DELETE": false,
    "research_candidates.authenticated.INSERT": true,
    "research_candidates.authenticated.SELECT": true,
    "research_candidates.authenticated.UPDATE": true,
    "experiment_settings.authenticated.TRIGGER": false,
    "research_candidates.authenticated.TRIGGER": false,
    "experiment_settings.authenticated.TRUNCATE": false,
    "paper_predictions.authenticated.REFERENCES": false,
    "research_candidates.authenticated.TRUNCATE": false,
    "financial_transactions.authenticated.DELETE": false,
    "financial_transactions.authenticated.INSERT": true,
    "financial_transactions.authenticated.SELECT": true,
    "financial_transactions.authenticated.UPDATE": true,
    "experiment_settings.authenticated.REFERENCES": false,
    "financial_transactions.authenticated.TRIGGER": false,
    "research_candidates.authenticated.REFERENCES": false,
    "financial_transactions.authenticated.TRUNCATE": false,
    "financial_transactions.authenticated.REFERENCES": false
  },
  "columnGrants": {
    "bets.anon.INSERT": false,
    "bets.anon.SELECT": false,
    "bets.anon.UPDATE": false,
    "events.anon.INSERT": false,
    "events.anon.SELECT": false,
    "events.anon.UPDATE": false,
    "sports.anon.INSERT": false,
    "sports.anon.SELECT": false,
    "sports.anon.UPDATE": false,
    "bet_legs.anon.INSERT": false,
    "bet_legs.anon.SELECT": false,
    "bet_legs.anon.UPDATE": false,
    "bets.anon.REFERENCES": false,
    "events.anon.REFERENCES": false,
    "sports.anon.REFERENCES": false,
    "bet_legs.anon.REFERENCES": false,
    "audit_history.anon.INSERT": false,
    "audit_history.anon.SELECT": false,
    "audit_history.anon.UPDATE": false,
    "bets.authenticated.INSERT": true,
    "bets.authenticated.SELECT": true,
    "bets.authenticated.UPDATE": true,
    "notifications.anon.INSERT": false,
    "notifications.anon.SELECT": false,
    "notifications.anon.UPDATE": false,
    "research_runs.anon.INSERT": false,
    "research_runs.anon.SELECT": false,
    "research_runs.anon.UPDATE": false,
    "user_profiles.anon.INSERT": false,
    "user_profiles.anon.SELECT": false,
    "user_profiles.anon.UPDATE": false,
    "model_versions.anon.INSERT": false,
    "model_versions.anon.SELECT": false,
    "model_versions.anon.UPDATE": false,
    "odds_snapshots.anon.INSERT": false,
    "odds_snapshots.anon.SELECT": false,
    "odds_snapshots.anon.UPDATE": false,
    "events.authenticated.INSERT": true,
    "events.authenticated.SELECT": true,
    "events.authenticated.UPDATE": true,
    "sports.authenticated.INSERT": true,
    "sports.authenticated.SELECT": true,
    "sports.authenticated.UPDATE": true,
    "audit_history.anon.REFERENCES": false,
    "bet_legs.authenticated.INSERT": true,
    "bet_legs.authenticated.SELECT": true,
    "bet_legs.authenticated.UPDATE": true,
    "bets.authenticated.REFERENCES": false,
    "notifications.anon.REFERENCES": false,
    "paper_predictions.anon.INSERT": false,
    "paper_predictions.anon.SELECT": false,
    "paper_predictions.anon.UPDATE": false,
    "research_runs.anon.REFERENCES": false,
    "user_profiles.anon.REFERENCES": false,
    "model_versions.anon.REFERENCES": false,
    "odds_snapshots.anon.REFERENCES": false,
    "events.authenticated.REFERENCES": false,
    "experiment_settings.anon.INSERT": false,
    "experiment_settings.anon.SELECT": false,
    "experiment_settings.anon.UPDATE": false,
    "research_candidates.anon.INSERT": false,
    "research_candidates.anon.SELECT": false,
    "research_candidates.anon.UPDATE": false,
    "sports.authenticated.REFERENCES": false,
    "bet_legs.authenticated.REFERENCES": false,
    "paper_predictions.anon.REFERENCES": false,
    "audit_history.authenticated.INSERT": true,
    "audit_history.authenticated.SELECT": true,
    "audit_history.authenticated.UPDATE": true,
    "financial_transactions.anon.INSERT": false,
    "financial_transactions.anon.SELECT": false,
    "financial_transactions.anon.UPDATE": false,
    "notifications.authenticated.INSERT": true,
    "notifications.authenticated.SELECT": true,
    "notifications.authenticated.UPDATE": true,
    "research_runs.authenticated.INSERT": true,
    "research_runs.authenticated.SELECT": true,
    "research_runs.authenticated.UPDATE": true,
    "user_profiles.authenticated.INSERT": true,
    "user_profiles.authenticated.SELECT": true,
    "user_profiles.authenticated.UPDATE": true,
    "experiment_settings.anon.REFERENCES": false,
    "model_versions.authenticated.INSERT": true,
    "model_versions.authenticated.SELECT": true,
    "model_versions.authenticated.UPDATE": true,
    "odds_snapshots.authenticated.INSERT": true,
    "odds_snapshots.authenticated.SELECT": true,
    "odds_snapshots.authenticated.UPDATE": true,
    "research_candidates.anon.REFERENCES": false,
    "audit_history.authenticated.REFERENCES": false,
    "financial_transactions.anon.REFERENCES": false,
    "notifications.authenticated.REFERENCES": false,
    "paper_predictions.authenticated.INSERT": true,
    "paper_predictions.authenticated.SELECT": true,
    "paper_predictions.authenticated.UPDATE": true,
    "research_runs.authenticated.REFERENCES": false,
    "user_profiles.authenticated.REFERENCES": false,
    "model_versions.authenticated.REFERENCES": false,
    "odds_snapshots.authenticated.REFERENCES": false,
    "experiment_settings.authenticated.INSERT": true,
    "experiment_settings.authenticated.SELECT": true,
    "experiment_settings.authenticated.UPDATE": true,
    "research_candidates.authenticated.INSERT": true,
    "research_candidates.authenticated.SELECT": true,
    "research_candidates.authenticated.UPDATE": true,
    "paper_predictions.authenticated.REFERENCES": false,
    "financial_transactions.authenticated.INSERT": true,
    "financial_transactions.authenticated.SELECT": true,
    "financial_transactions.authenticated.UPDATE": true,
    "experiment_settings.authenticated.REFERENCES": false,
    "research_candidates.authenticated.REFERENCES": false,
    "financial_transactions.authenticated.REFERENCES": false
  },
  "functionGrants": {
    "edgelab_audit_bet().anon": true,
    "edgelab_deny_rewrite().anon": true,
    "edgelab_load_workspace().anon": false,
    "edgelab_guard_prediction().anon": true,
    "edgelab_audit_bet().authenticated": true,
    "edgelab_guard_leg_identity().anon": true,
    "edgelab_bump_direct_revision().anon": true,
    "edgelab_check_leg_projection().anon": true,
    "edgelab_deny_rewrite().authenticated": true,
    "edgelab_guard_settings_revision().anon": true,
    "edgelab_load_workspace().authenticated": true,
    "edgelab_guard_prediction().authenticated": true,
    "edgelab_valid_json_odds(value jsonb).anon": false,
    "edgelab_valid_json_uuid(value jsonb).anon": false,
    "edgelab_guard_leg_identity().authenticated": true,
    "edgelab_valid_json_cents(value jsonb).anon": false,
    "edgelab_bump_direct_revision().authenticated": true,
    "edgelab_check_leg_projection().authenticated": true,
    "edgelab_valid_bet_snapshot(value jsonb).anon": false,
    "edgelab_valid_leg_snapshot(value jsonb).anon": false,
    "edgelab_valid_run_snapshot(value jsonb).anon": false,
    "edgelab_valid_audit_snapshot(value jsonb).anon": false,
    "edgelab_valid_json_timestamp(value jsonb).anon": false,
    "edgelab_valid_paper_snapshot(value jsonb).anon": false,
    "edgelab_guard_settings_revision().authenticated": true,
    "edgelab_valid_json_probability(value jsonb).anon": false,
    "edgelab_valid_candidate_snapshot(value jsonb).anon": false,
    "edgelab_valid_json_odds(value jsonb).authenticated": true,
    "edgelab_valid_json_uuid(value jsonb).authenticated": true,
    "edgelab_valid_private_provenance(value jsonb).anon": false,
    "edgelab_valid_json_cents(value jsonb).authenticated": true,
    "edgelab_valid_transaction_snapshot(value jsonb).anon": false,
    "edgelab_valid_bet_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_leg_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_notification_snapshot(value jsonb).anon": false,
    "edgelab_valid_run_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_audit_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_json_timestamp(value jsonb).authenticated": true,
    "edgelab_valid_paper_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_json_probability(value jsonb).authenticated": true,
    "edgelab_valid_candidate_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_private_provenance(value jsonb).authenticated": true,
    "edgelab_valid_transaction_snapshot(value jsonb).authenticated": true,
    "edgelab_valid_notification_snapshot(value jsonb).authenticated": true,
    "edgelab_save_workspace(workspace jsonb, expected_revision bigint).anon": false,
    "edgelab_save_workspace(workspace jsonb, expected_revision bigint).authenticated": true,
    "edgelab_valid_json_text(value jsonb, minimum integer, maximum integer, trimmed boolean).anon": false,
    "edgelab_valid_json_text(value jsonb, minimum integer, maximum integer, trimmed boolean).authenticated": true
  },
  "explicitTableGrants": {
    "bets.authenticated.INSERT": false,
    "bets.authenticated.SELECT": false,
    "bets.authenticated.UPDATE": false,
    "events.authenticated.INSERT": false,
    "events.authenticated.SELECT": false,
    "events.authenticated.UPDATE": false,
    "sports.authenticated.INSERT": false,
    "sports.authenticated.SELECT": false,
    "sports.authenticated.UPDATE": false,
    "bet_legs.authenticated.INSERT": false,
    "bet_legs.authenticated.SELECT": false,
    "bet_legs.authenticated.UPDATE": false,
    "audit_history.authenticated.INSERT": false,
    "audit_history.authenticated.SELECT": false,
    "audit_history.authenticated.UPDATE": false,
    "notifications.authenticated.INSERT": false,
    "notifications.authenticated.SELECT": false,
    "notifications.authenticated.UPDATE": false,
    "research_runs.authenticated.INSERT": false,
    "research_runs.authenticated.SELECT": false,
    "research_runs.authenticated.UPDATE": false,
    "user_profiles.authenticated.INSERT": false,
    "user_profiles.authenticated.SELECT": false,
    "user_profiles.authenticated.UPDATE": false,
    "model_versions.authenticated.INSERT": false,
    "model_versions.authenticated.SELECT": false,
    "model_versions.authenticated.UPDATE": false,
    "odds_snapshots.authenticated.INSERT": false,
    "odds_snapshots.authenticated.SELECT": false,
    "odds_snapshots.authenticated.UPDATE": false,
    "paper_predictions.authenticated.INSERT": false,
    "paper_predictions.authenticated.SELECT": false,
    "paper_predictions.authenticated.UPDATE": false,
    "experiment_settings.authenticated.INSERT": false,
    "experiment_settings.authenticated.SELECT": false,
    "experiment_settings.authenticated.UPDATE": false,
    "research_candidates.authenticated.INSERT": false,
    "research_candidates.authenticated.SELECT": false,
    "research_candidates.authenticated.UPDATE": false,
    "financial_transactions.authenticated.INSERT": false,
    "financial_transactions.authenticated.SELECT": false,
    "financial_transactions.authenticated.UPDATE": false
  },
  "explicitColumnGrants": {},
  "explicitFunctionGrants": {
    "edgelab_audit_bet().anon.EXECUTE": false,
    "edgelab_audit_bet().public.EXECUTE": false,
    "edgelab_deny_rewrite().anon.EXECUTE": false,
    "edgelab_deny_rewrite().public.EXECUTE": false,
    "edgelab_guard_prediction().anon.EXECUTE": false,
    "edgelab_audit_bet().authenticated.EXECUTE": false,
    "edgelab_guard_leg_identity().anon.EXECUTE": false,
    "edgelab_guard_prediction().public.EXECUTE": false,
    "edgelab_bump_direct_revision().anon.EXECUTE": false,
    "edgelab_check_leg_projection().anon.EXECUTE": false,
    "edgelab_guard_leg_identity().public.EXECUTE": false,
    "edgelab_deny_rewrite().authenticated.EXECUTE": false,
    "edgelab_bump_direct_revision().public.EXECUTE": false,
    "edgelab_check_leg_projection().public.EXECUTE": false,
    "edgelab_guard_settings_revision().anon.EXECUTE": false,
    "edgelab_load_workspace().authenticated.EXECUTE": false,
    "edgelab_guard_prediction().authenticated.EXECUTE": false,
    "edgelab_guard_settings_revision().public.EXECUTE": false,
    "edgelab_guard_leg_identity().authenticated.EXECUTE": false,
    "edgelab_bump_direct_revision().authenticated.EXECUTE": false,
    "edgelab_check_leg_projection().authenticated.EXECUTE": false,
    "edgelab_guard_settings_revision().authenticated.EXECUTE": false,
    "edgelab_valid_json_odds(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_json_uuid(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_json_cents(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_bet_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_leg_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_run_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_audit_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_json_timestamp(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_paper_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_json_probability(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_candidate_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_private_provenance(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_transaction_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_valid_notification_snapshot(value jsonb).authenticated.EXECUTE": false,
    "edgelab_save_workspace(workspace jsonb, expected_revision bigint).authenticated.EXECUTE": false,
    "edgelab_valid_json_text(value jsonb, minimum integer, maximum integer, trimmed boolean).authenticated.EXECUTE": false
  }
}$edgelab_catalog$::jsonb as value),
actual as (
with app_tables as (
  select c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relkind
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in (select jsonb_array_elements_text('["audit_history","bet_legs","bets","events","experiment_settings","financial_transactions","model_versions","notifications","odds_snapshots","paper_predictions","research_candidates","research_runs","sports","user_profiles"]'::jsonb))
), app_functions as (
  select p.*,l.lanname from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace join pg_catalog.pg_language l on l.oid=p.prolang
  where n.nspname='public' and p.proname like 'edgelab_%'
)
select jsonb_build_object(
 'tables',coalesce((select jsonb_object_agg(relname,jsonb_build_object('kind',relkind,'rls',relrowsecurity,'forceRls',relforcerowsecurity,'ownerIsPrivileged',pg_get_userbyid((select relowner from pg_catalog.pg_class where oid=app_tables.oid)) not in ('anon','authenticated'))) from app_tables),'{}'::jsonb),
 'columns',coalesce((select jsonb_object_agg(t.relname||'.'||a.attname,jsonb_build_object('position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'expression',regexp_replace(replace(pg_get_expr(d.adbin,d.adrelid,false),'public.',''),'[[:space:]]+',' ','g'))) from app_tables t join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped left join pg_catalog.pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum),'{}'::jsonb),
 'constraints',coalesce((select jsonb_object_agg(t.relname||'.'||c.conname,jsonb_build_object('type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'definition',regexp_replace(replace(pg_get_constraintdef(c.oid,false),'public.',''),'[[:space:]]+',' ','g'))) from app_tables t join pg_catalog.pg_constraint c on c.conrelid=t.oid where c.contype<>'n' and c.contype<>'t'),'{}'::jsonb),
 'indexes',coalesce((select jsonb_object_agg(t.relname||'.'||c.relname,jsonb_build_object('unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'definition',regexp_replace(replace(pg_get_indexdef(i.indexrelid,0,false),'public.',''),'[[:space:]]+',' ','g'))) from app_tables t join pg_catalog.pg_index i on i.indrelid=t.oid join pg_catalog.pg_class c on c.oid=i.indexrelid),'{}'::jsonb),
 'policies',coalesce((select jsonb_object_agg(t.relname||'.'||p.polname,jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(case when r=0 then 'public' else pg_get_userbyid(r) end order by case when r=0 then 'public' else pg_get_userbyid(r) end) from unnest(p.polroles) r),'using',regexp_replace(replace(pg_get_expr(p.polqual,p.polrelid,false),'public.',''),'[[:space:]]+',' ','g'),'check',regexp_replace(replace(pg_get_expr(p.polwithcheck,p.polrelid,false),'public.',''),'[[:space:]]+',' ','g'))) from app_tables t join pg_catalog.pg_policy p on p.polrelid=t.oid),'{}'::jsonb),
 'functions',coalesce((select jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_object('language',p.lanname,'returns',format_type(p.prorettype,null),'securityDefiner',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'configuration',p.proconfig,'defaults',pg_get_expr(p.proargdefaults,0,false),'bodySha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'))) from app_functions p),'{}'::jsonb),
 'triggers',coalesce((select jsonb_object_agg(t.relname||'.'||g.tgname,jsonb_build_object('function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','type',g.tgtype,'enabled',g.tgenabled,'deferrable',g.tgdeferrable,'initiallyDeferred',g.tginitdeferred,'when',regexp_replace(replace(pg_get_expr(g.tgqual,g.tgrelid,false),'public.',''),'[[:space:]]+',' ','g'),'arguments',encode(g.tgargs,'hex'))) from app_tables t join pg_catalog.pg_trigger g on g.tgrelid=t.oid and not g.tgisinternal join pg_catalog.pg_proc p on p.oid=g.tgfoid),'{}'::jsonb),
 'tableGrants',coalesce((select jsonb_object_agg(t.relname||'.'||r.role||'.'||v.privilege,has_table_privilege(r.role,t.oid,v.privilege)) from app_tables t cross join (values ('anon'),('authenticated')) r(role) cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)),'{}'::jsonb),
 'columnGrants',coalesce((select jsonb_object_agg(t.relname||'.'||r.role||'.'||v.privilege,has_any_column_privilege(r.role,t.oid,v.privilege)) from app_tables t cross join (values ('anon'),('authenticated')) r(role) cross join (values ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)),'{}'::jsonb),
 'roles',coalesce((select jsonb_object_agg(rolname,jsonb_build_object('superuser',rolsuper,'bypassRls',rolbypassrls,'canLogin',rolcanlogin)) from pg_catalog.pg_roles where rolname in ('anon','authenticated')),'{}'::jsonb),
 'explicitTableGrants',coalesce((select jsonb_object_agg(t.relname||'.'||case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end||'.'||a.privilege_type,a.is_grantable) from app_tables t join pg_catalog.pg_class c on c.oid=t.oid cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')),'{}'::jsonb),
 'explicitColumnGrants',coalesce((select jsonb_object_agg(t.relname||'.'||c.attname||'.'||case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end||'.'||a.privilege_type,a.is_grantable) from app_tables t join pg_catalog.pg_attribute c on c.attrelid=t.oid and c.attnum>0 and not c.attisdropped cross join lateral aclexplode(c.attacl) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')),'{}'::jsonb),
 'explicitFunctionGrants',coalesce((select jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||').' ||case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end||'.'||a.privilege_type,a.is_grantable) from app_functions p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 or pg_get_userbyid(a.grantee) in ('anon','authenticated')),'{}'::jsonb),
 'functionGrants',coalesce((select jsonb_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||').' ||r.role,has_function_privilege(r.role,p.oid,'EXECUTE')) from app_functions p cross join (values ('anon'),('authenticated')) r(role)),'{}'::jsonb)
) as catalog_snapshot
),
expected_items as (select category.key as category,item.key as object_name,item.value from expected cross join lateral jsonb_each(expected.value) category cross join lateral jsonb_each(category.value) item),
actual_items as (select category.key as category,item.key as object_name,item.value from actual cross join lateral jsonb_each(actual.catalog_snapshot) category cross join lateral jsonb_each(category.value) item),
differences as (
 select coalesce(e.category,a.category) as category,coalesce(e.object_name,a.object_name) as object_name,e.value as expected,a.value as actual
 from expected_items e full join actual_items a on a.category=e.category and a.object_name=e.object_name
 where e.value is distinct from a.value
)
select jsonb_build_object(
 'passed',not exists(select 1 from differences),
 'scope','Schema catalogs only; no application data, Auth/JWT checks or privileged RLS test claims',
 'functionBodiesVerified',(select count(*) from actual_items where category='functions'),
 'objectCounts',(select jsonb_object_agg(category.key,jsonb_object_length_compat.count) from actual cross join lateral jsonb_each(actual.catalog_snapshot) category cross join lateral (select count(*) from jsonb_object_keys(category.value)) jsonb_object_length_compat),
 'unvalidatedChecks',(select count(*) from actual_items where category='constraints' and value->>'type'='c' and value->>'validated'='false'),
 'differences',coalesce((select jsonb_agg(jsonb_build_object('category',category,'object',object_name,'expected',expected,'actual',actual) order by category,object_name) from differences),'[]'::jsonb),
 'rawDifferences',coalesce((select jsonb_agg(jsonb_build_object('category',category,'object',object_name,'expected',expected,'actual',actual) order by category,object_name) from differences),'[]'::jsonb),
 'platformBaseline','Verified Supabase PUBLIC-schema default function grants to anon/authenticated without grant option; approved migrations revoke them on workspace RPCs and validators. Trigger-only functions retain their existing PUBLIC execution privileges.'
) as edgelab_schema_verification;
