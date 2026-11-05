import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { SportsAccessError, type BudgetState, type BudgetStore } from './transport';
const directory = path.join(process.cwd(), '.local/sports-provider');
/** Fail closed on unreadable state. Only counters are persisted, never keys,
 * private research, tickets or tokens. One live process owns this directory. */
export function takeProcessLock() {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'runtime.lock');
  try { const fd = openSync(file, 'wx', 0o600); writeFileSync(fd, String(process.pid)); closeSync(fd); }
  catch (reason) {
    if ((reason as NodeJS.ErrnoException).code !== 'EEXIST') throw reason;
    const pid = Number(readFileSync(file, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid < 1) throw new SportsAccessError('DISABLED', 'Invalid sports provider lock; inspect the local runtime directory.');
    if (pid === process.pid) return;
    try { process.kill(pid, 0); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') { unlinkSync(file); return takeProcessLock(); }
    }
    throw new SportsAccessError('DISABLED', 'Another local process owns the sports provider. Multiple workers are disabled.');
  }
}
export const store: BudgetStore = {
  read(provider) {
    const file = path.join(directory, `${provider}-budget.json`);
    try {
      const value: BudgetState = JSON.parse(readFileSync(file, 'utf8'));
      if (!/^\d{4}-\d\d-\d\d$/.test(value.utcDay) || !Number.isSafeInteger(value.used) || value.used < 0 || value.remainingDaily !== null && (!Number.isSafeInteger(value.remainingDaily) || value.remainingDaily < 0)) throw new Error('Invalid quota state');
      if (value.requestTimes && (!Array.isArray(value.requestTimes) || value.requestTimes.length > 100 || value.requestTimes.some(time => !Number.isFinite(time) || time < 0)) || value.blockedUntil !== undefined && (!Number.isFinite(value.blockedUntil) || value.blockedUntil < 0)) throw new Error('Invalid quota timing');
      return value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new SportsAccessError('DISABLED', 'Sports quota state cannot be safely read.'); }
  },
  write(provider, state) {
    const file = path.join(directory, `${provider}-budget.json`), temporary = `${file}.tmp`;
    writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 }); renameSync(temporary, file);
  },
};
