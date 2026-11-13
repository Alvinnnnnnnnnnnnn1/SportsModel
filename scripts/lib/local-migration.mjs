/** Disposable PGlite fixtures only. No env, credentials or network access.
 * ACL03 requires a non-superuser DDL executor: pg_has_role is always true for
 * superusers. Replay its exact bytes under a temporary admin fixture, then
 * remove that fixture's grants/role. Ordinary RLS tests still use anon/auth. */
export async function applyLocalMigration(db, name, sql) {
  if (name !== '202611130003_v6_source_rpc_acl.sql') {
    await db.exec(sql);
    return;
  }
  const actor = 'edgelab_local_acl_migrator';
  const tables = ['pilots', 'objects', 'snapshots', 'capabilities', 'quotas', 'reservations', 'audit']
    .map(name => `public.v6_source_${name}`).join(',');
  await db.exec(`
    create role ${actor} nologin nosuperuser createrole bypassrls inherit;
    grant usage on schema public to ${actor};
    grant select on ${tables} to ${actor};
    grant edgelab_v6_source to ${actor} with admin true, set false, inherit false;
    set role ${actor};
  `);
  try {
    await db.exec(sql);
  } finally {
    await db.exec(`
      rollback; reset role;
      revoke edgelab_v6_source from ${actor};
      revoke select on ${tables} from ${actor};
      revoke usage on schema public from ${actor};
      drop role ${actor};
    `);
  }
}
