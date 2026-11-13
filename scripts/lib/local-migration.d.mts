/** Test-only disposable database migration replay; never a hosted client. */
export function applyLocalMigration(
  db: { exec(sql: string): Promise<unknown> },
  name: string,
  sql: string,
): Promise<void>;
