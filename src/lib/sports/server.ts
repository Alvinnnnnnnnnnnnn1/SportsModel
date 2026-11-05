import 'server-only';
import { isLocalSportsRequest } from './access';
import { takeProcessLock, store } from './local-runtime';
import { createClient } from '@supabase/supabase-js';
import { HybridSportsAdapter } from './adapters';
import { SportsTransport, SportsAccessError } from './transport';
import { providers, sportsRequestSchema, type SportsProviderId } from './types';


type Runtime = { adapters: Record<SportsProviderId, HybridSportsAdapter> };
const globals = globalThis as typeof globalThis & { edgeLabSportsRuntime?: Runtime };
function runtime(): Runtime {
  if (process.env.EDGELAB_SPORTS_DATA_MODE !== 'local-single-process' || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || Number(process.env.WEB_CONCURRENCY ?? '1') !== 1) throw new SportsAccessError('DISABLED', 'Live sports data is disabled. Only explicitly configured local single-process operation is supported.');
  if (!globals.edgeLabSportsRuntime) {
    takeProcessLock();
    globals.edgeLabSportsRuntime = { adapters: Object.fromEntries(providers.map(id => [id, new HybridSportsAdapter(id, new SportsTransport(id, { store, ...(id === 'thesportsdb' ? {} : { dayBudget: Number(process.env[id === 'api-nba' ? 'API_NBA_DAILY_BUDGET' : 'API_BASKETBALL_DAILY_BUDGET'] ?? 70), minuteBudget: Number(process.env[id === 'api-nba' ? 'API_NBA_MINUTE_BUDGET' : 'API_BASKETBALL_MINUTE_BUDGET'] ?? 6) }) }), process.env.API_SPORTS_KEY)])) as Runtime['adapters'] };
  }
  return globals.edgeLabSportsRuntime;
}
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Vary': 'Authorization' } });
export async function handleSportsRequest(request: Request): Promise<Response> {
  try {
    if (!isLocalSportsRequest(request)) return response({ error: 'Local same-origin access required.' }, 403);
    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token) return response({ error: 'Authentication required.' }, 401);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !key) return response({ error: 'Private workspace is not configured.' }, 503);
    const client = createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return response({ error: 'Valid private session required.' }, 401);
    const text = await request.text(); if (text.length > 8000) return response({ error: 'Sports request is too large.' }, 413);
    let parsed: unknown; try { parsed = JSON.parse(text); } catch { return response({ error: 'Use valid JSON.' }, 400); }
    const checked = sportsRequestSchema.safeParse(parsed); if (!checked.success) return response({ error: 'Unsupported sports request.' }, 400);
    const services = runtime();
    const read = await services.adapters[checked.data.provider].inspect(checked.data, request.signal);
    // No headers or provider account details are exposed. Defence against an upstream secret echo.
    if (checked.data.operation === 'status') {
      const root = read.discovery as { response?: { requests?: unknown; subscription?: unknown } };
      read.discovery = { requests: root?.response?.requests ?? null, subscription: root?.response?.subscription ?? null };
    }
    const result = { snapshot: read, quota: services.adapters[checked.data.provider].transport.status() };
    const secret = process.env.API_SPORTS_KEY;
    const safe = secret ? JSON.parse(JSON.stringify(result).split(secret).join('[REDACTED]')) : result;
    return response(safe);
  } catch (reason) {
    if (reason instanceof SportsAccessError) return response({ code: reason.code, error: reason.message }, reason.code === 'INVALID_REQUEST' ? 400 : ['RATE_LIMITED', 'QUOTA_EXHAUSTED'].includes(reason.code) ? 429 : 503);
    return response({ error: 'Sports data could not be inspected. No result or financial change was saved.' }, 503);
  }
}
